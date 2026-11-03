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

// Teto geral por IP. Alto de propósito: as chamadas internas de outros serviços chegam do mesmo IP.
export const limitarGeral = limitador(
  numero(process.env.RATE_LIMIT_GERAL_MAX, 600),
  1,
  'Muitas requisições. Tente novamente em instantes.',
  true
);

export const limitarCriacaoPedido = limitador(
  numero(process.env.RATE_LIMIT_PEDIDO_MAX, 20),
  15,
  'Muitos pedidos criados a partir deste IP. Tente novamente mais tarde.'
);
