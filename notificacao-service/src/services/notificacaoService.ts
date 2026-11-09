import { Op, UniqueConstraintError } from 'sequelize';
import { NotificacaoLog } from '../models';
import { enviarEmail } from './emailService';
import { ErroHttp } from '../middlewares/errorHandler';
import { PedidoCriado, PagamentoConfirmado } from '../validators/eventoValidators';
import { registrarEvento, registrarEntrega } from '../utils/metricas';
import { logger } from '../utils/logger';

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Envio {
  idPedido: number;
  tipo: string;
  destinatario: string;
  assunto: string;
  texto: string;
  ocorridoEm: string;
}

const TENTATIVAS_ENVIO = 3;
const pausa = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Tenta de novo em falhas transitórias do SMTP, com pausa crescente (cabe no SLO 4: p95 < 10s).
async function enviarComTentativas(email: Parameters<typeof enviarEmail>[0]) {
  const intervalo = Number(process.env.EMAIL_RETRY_MS ?? 500);
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await enviarEmail(email);
    } catch (err) {
      if (tentativa >= TENTATIVAS_ENVIO) throw err;
      logger.warn({ tentativa }, 'falha ao enviar e-mail, tentando novamente');
      await pausa(intervalo * tentativa);
    }
  }
}

// A restrição UNIQUE (id_pedido, tipo) garante que o mesmo e-mail não é enviado duas vezes (ADR-008).
// Exceções: se a tentativa anterior terminou em FALHA, ou ficou PENDENTE por tempo demais (o processo caiu no meio
// do envio), um evento republicado tenta enviar de novo (e a rotina de reenvio faz o mesmo sozinha).
// Um envio normal leva segundos (3 tentativas com timeout). PENDENTE por bem mais que isso é um envio que não terminou.
function pendentePresa(log: NotificacaoLog, agora: Date = new Date()): boolean {
  const minutos = Number(process.env.NOTIFICACAO_PENDENTE_MINUTOS ?? 10);
  if (log.status !== 'PENDENTE' || !log.criado_em) return false;
  return agora.getTime() - new Date(log.criado_em).getTime() > minutos * 60_000;
}

async function registrarTentativa({ idPedido, tipo, destinatario, assunto, texto }: Envio) {
  try {
    return await NotificacaoLog.create({ id_pedido: idPedido, tipo, destinatario, assunto, texto, status: 'PENDENTE' });
  } catch (err) {
    if (!(err instanceof UniqueConstraintError)) throw err;
    const existente = await NotificacaoLog.findOne({ where: { id_pedido: idPedido, tipo } });
    if (existente && (existente.status === 'FALHA' || pendentePresa(existente))) {
      await existente.update({ status: 'PENDENTE', erro: null, destinatario, assunto, texto, criado_em: new Date() });
      return existente;
    }
    return null;
  }
}

// Envia (com as tentativas rápidas de enviarComTentativas) e grava o resultado. Cada chamada conta como uma rodada.
async function executarEnvio(
  log: NotificacaoLog,
  { idPedido, tipo, destinatario, assunto, texto, ocorridoEm }: Omit<Envio, 'ocorridoEm'> & { ocorridoEm?: string }
) {
  const rodadas = (log.tentativas ?? 0) + 1;
  try {
    await enviarComTentativas({ para: destinatario, assunto, texto });
    await log.update({ status: 'ENVIADO', enviado_em: new Date(), tentativas: rodadas });
    registrarEvento('email_enviado');
    if (ocorridoEm) registrarEntrega(tipo, ocorridoEm);
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    await log.update({ status: 'FALHA', erro: motivo.slice(0, 255), tentativas: rodadas });
    registrarEvento('email_falha');
    logger.error({ err, idPedido, tipo, rodadas }, 'falha ao enviar e-mail');
  }
}

async function enviarUmaVez(envio: Envio) {
  const log = await registrarTentativa(envio);
  if (!log) {
    registrarEvento('evento_duplicado');
    logger.info({ idPedido: envio.idPedido, tipo: envio.tipo }, 'notificação já registrada, evento ignorado');
    return;
  }
  await executarEnvio(log, envio);
}

// ---- Reenvio automático (FALHA e PENDENTE preso) ----
const maximoDeRodadas = () => Number(process.env.NOTIFICACAO_REENVIO_MAX_TENTATIVAS ?? 5);

// Espera antes da próxima rodada: dobra a cada rodada já feita (2, 2, 4, 8... min), com teto de 60 min.
export function esperaEmMinutos(rodadas: number): number {
  return Math.min(2 ** Math.max(rodadas, 1), 60);
}

// Reenvia as notificações que falharam, uma de cada vez. Devolve quantas foram reenviadas (com sucesso ou não).
export async function reenviarNotificacoes(agora: Date = new Date()): Promise<number> {
  const candidatas = await NotificacaoLog.findAll({
    where: {
      status: { [Op.in]: ['FALHA', 'PENDENTE'] },
      tentativas: { [Op.lt]: maximoDeRodadas() },
      assunto: { [Op.ne]: null },
      texto: { [Op.ne]: null },
    },
    order: [['criado_em', 'ASC']],
    limit: 20,
  });

  let reenviadas = 0;
  for (const log of candidatas) {
    const pronta =
      log.status === 'PENDENTE'
        ? pendentePresa(log, agora)
        : agora.getTime() - new Date(log.criado_em).getTime() >= esperaEmMinutos(log.tentativas) * 60_000;
    if (!pronta) continue;

    // Reivindica com UPDATE condicional: com várias instâncias, só uma envia.
    const [reivindicadas] = await NotificacaoLog.update(
      { status: 'PENDENTE', erro: null, criado_em: agora },
      { where: { id_notificacao: log.id_notificacao, status: log.status, criado_em: log.criado_em } }
    );
    if (reivindicadas === 0) continue;

    await executarEnvio(log, {
      idPedido: log.id_pedido,
      tipo: log.tipo,
      destinatario: log.destinatario,
      assunto: log.assunto as string,
      texto: log.texto as string,
    });
    reenviadas++;
  }
  return reenviadas;
}

export async function processarPedidoCriado(dados: PedidoCriado, ocorridoEm: string) {
  await enviarUmaVez({
    idPedido: dados.idPedido,
    tipo: 'PEDIDO_CRIADO',
    destinatario: dados.cliente.email,
    assunto: `Recebemos o seu pedido #${dados.idPedido}`,
    texto: [
      `Olá, ${dados.cliente.nome}!`,
      '',
      `Recebemos o seu pedido #${dados.idPedido}, no valor de ${moeda(dados.valorTotal)}.`,
      'Assim que o pagamento for confirmado, avisaremos por aqui.',
      '',
      'MCE Celulares',
    ].join('\n'),
    ocorridoEm,
  });
}

export async function processarPagamentoConfirmado(dados: PagamentoConfirmado, ocorridoEm: string) {
  await enviarUmaVez({
    idPedido: dados.idPedido,
    tipo: 'PAGAMENTO_CONFIRMADO',
    destinatario: dados.cliente.email,
    assunto: `Pagamento confirmado — pedido #${dados.idPedido}`,
    texto: [
      `Olá, ${dados.cliente.nome}!`,
      '',
      `Confirmamos o pagamento de ${moeda(dados.valor)} (${dados.metodoPagamento}) do pedido #${dados.idPedido}.`,
      'Em breve você receberá novidades sobre a entrega.',
      '',
      'MCE Celulares',
    ].join('\n'),
    ocorridoEm,
  });
}

export async function listarPorPedido(idPedido: number) {
  const logs = await NotificacaoLog.findAll({
    where: { id_pedido: idPedido },
    attributes: { exclude: ['texto'] },
    order: [['id_notificacao', 'ASC']],
  });
  if (logs.length === 0) {
    throw new ErroHttp(404, 'Nenhuma notificação para esse pedido');
  }
  return logs;
}
