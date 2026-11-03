import { z } from 'zod';
import { enviarEmail } from './emailService';
import { ErroHttp } from '../middlewares/errorHandler';
import { contatoSchema } from '../validators/contatoValidators';
import { registrarEvento } from '../utils/metricas';
import { logger } from '../utils/logger';

type Contato = z.infer<typeof contatoSchema>;

export async function enviarContato(contato: Contato): Promise<void> {
  const destino = process.env.EMAIL_CONTATO_LOJA;
  if (!destino) {
    logger.error('EMAIL_CONTATO_LOJA não configurado');
    throw new ErroHttp(503, 'Envio de contato indisponível no momento');
  }

  const linhas = [
    `Nome: ${contato.nome}`,
    `E-mail: ${contato.email}`,
    contato.telefone ? `Telefone: ${contato.telefone}` : null,
    '',
    contato.mensagem,
  ].filter((linha): linha is string => linha !== null);

  try {
    await enviarEmail({
      para: destino,
      assunto: `[Contato] ${contato.assunto || 'Nova mensagem do site'}`,
      texto: linhas.join('\n'),
      responderPara: contato.email,
    });
    registrarEvento('contato_enviado');
  } catch (err) {
    registrarEvento('contato_falha');
    logger.error({ err }, 'falha ao enviar e-mail de contato');
    throw new ErroHttp(502, 'Não foi possível enviar a mensagem. Tente novamente mais tarde.');
  }
}
