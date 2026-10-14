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

export const limitarLogin = limitador(
  numero(process.env.RATE_LIMIT_LOGIN_MAX, 10),
  15,
  'Muitas tentativas de login. Tente novamente em alguns minutos.'
);

export const limitarCadastro = limitador(
  numero(process.env.RATE_LIMIT_CADASTRO_MAX, 20),
  60,
  'Muitos cadastros a partir deste IP. Tente novamente mais tarde.'
);
