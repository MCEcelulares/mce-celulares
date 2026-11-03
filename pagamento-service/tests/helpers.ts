import jwt from 'jsonwebtoken';

export const tokenDe = (id_usuario: number, permissoes: string[] = []) =>
  jwt.sign(
    { id_usuario, email: `u${id_usuario}@mce.test`, admin: false, cargos: [], permissoes },
    process.env.TESTE_JWT_PRIVATE_KEY as string,
    { algorithm: 'RS256', expiresIn: '1h' }
  );

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const pedidoVendas = (extra: Record<string, unknown> = {}) => ({
  id_pedido: 77,
  status: 'AGUARDANDO_PAGAMENTO',
  valor_total: 125,
  valor_frete: 0,
  expira_em: '2026-10-28T12:30:00.000Z',
  itens: [
    { id_item: 1, id_produto: 10, nome_produto: 'iPhone 15', quantidade: 2, preco_unitario: 12.5 },
    { id_item: 2, id_produto: 11, nome_produto: 'Capa', quantidade: 1, preco_unitario: 100 },
  ],
  cliente: { id_usuario: 5, nome: 'Rafael', email: 'rafael@mce.test', telefone: '45999990000' },
  ...extra,
});

export const pagamentoCom = (extra: Record<string, unknown> = {}) => {
  const pagamento: Record<string, unknown> = {
    id_pagamento: 1,
    id_pedido: 77,
    id_usuario: 5,
    metodo_pagamento: 'PIX',
    valor: '125.00',
    data_pagamento: null,
    status: 'PENDENTE',
    id_externo: null,
    url_pagamento: null,
    ...extra,
  };
  pagamento.update = jest.fn(async (novo: Record<string, unknown>) => {
    Object.assign(pagamento, novo);
  });
  return pagamento;
};
