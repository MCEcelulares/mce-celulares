import { rateLimit } from 'express-rate-limit';

const numero = (valor: string | undefined, padrao: number) => (valor ? Number(valor) : padrao);

function limitador(limite: number, janelaMinutos: number, mensagem: string, ignorarSaude = false) {
  return rateLimit({
    windowMs: janelaMinutos * 60 * 1000,
    limit: limite,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { erro: mensagem },
    skip: (req) =>
      process.env.RATE_LIMIT_DESLIGADO === 'true' || (ignorarSaude && req.path.startsWith('/health')),
  });
}

export const limitarGeral = limitador(
  numero(process.env.RATE_LIMIT_GERAL_MAX, 1000),
  1,
  'Muitas requisições. Tente novamente em instantes.',
  true
);

export const limitarUpload = limitador(
  numero(process.env.RATE_LIMIT_UPLOAD_MAX, 30),
  15,
  'Muitos envios de imagem a partir deste IP. Tente novamente mais tarde.'
);
