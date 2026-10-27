import { UniqueConstraintError } from 'sequelize';
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
// Exceção: se a tentativa anterior terminou em FALHA, um evento republicado tenta enviar de novo.
async function registrarTentativa({ idPedido, tipo, destinatario }: Envio) {
  try {
    return await NotificacaoLog.create({ id_pedido: idPedido, tipo, destinatario, status: 'PENDENTE' });
  } catch (err) {
    if (!(err instanceof UniqueConstraintError)) throw err;
    const existente = await NotificacaoLog.findOne({ where: { id_pedido: idPedido, tipo } });
    if (existente?.status === 'FALHA') {
      await existente.update({ status: 'PENDENTE', erro: null, destinatario });
      return existente;
    }
    return null;
  }
}

async function enviarUmaVez(envio: Envio) {
  const { idPedido, tipo, destinatario, assunto, texto, ocorridoEm } = envio;
  const log = await registrarTentativa(envio);
  if (!log) {
    registrarEvento('evento_duplicado');
    logger.info({ idPedido, tipo }, 'notificação já registrada, evento ignorado');
    return;
  }

  try {
    await enviarComTentativas({ para: destinatario, assunto, texto });
    await log.update({ status: 'ENVIADO', enviado_em: new Date() });
    registrarEvento('email_enviado');
    registrarEntrega(tipo, ocorridoEm);
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    await log.update({ status: 'FALHA', erro: motivo.slice(0, 255) });
    registrarEvento('email_falha');
    logger.error({ err, idPedido, tipo }, 'falha ao enviar e-mail');
  }
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
  const logs = await NotificacaoLog.findAll({ where: { id_pedido: idPedido }, order: [['id_notificacao', 'ASC']] });
  if (logs.length === 0) {
    throw new ErroHttp(404, 'Nenhuma notificação para esse pedido');
  }
  return logs;
}
