import { rateLimit } from 'express-rate-limit';

const numero = (valor: string | undefined, padrao: number) => (valor ? Number(valor) : padrao);

function limitador(limite: number, janelaMinutos: number, mensagem: string) {
  return rateLimit({
    windowMs: janelaMinutos * 60 * 1000,
    limit: limite,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { erro: mensagem },
    skip: () => process.env.RATE_LIMIT_DESLIGADO === 'true',
  });
}

export const limitarContato = limitador(
  numero(process.env.RATE_LIMIT_CONTATO_MAX, 5),
  60,
  'Muitas mensagens enviadas a partir deste IP. Tente novamente mais tarde.'
);
