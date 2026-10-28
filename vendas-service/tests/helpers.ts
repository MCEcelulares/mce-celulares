import jwt from 'jsonwebtoken';

export const tokenDe = (id_usuario: number, permissoes: string[] = []) =>
  jwt.sign(
    { id_usuario, email: `u${id_usuario}@mce.test`, admin: false, cargos: [], permissoes },
    process.env.TESTE_JWT_PRIVATE_KEY as string,
    { algorithm: 'RS256', expiresIn: '1h' }
  );

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const servico = { Authorization: 'Bearer token-de-servico-teste' };

export const produtoCatalogo = (extra: Record<string, unknown> = {}) => ({
  id_produto: 10,
  nome: 'iPhone 15',
  preco: 100,
  estoque: 50,
  ativo: true,
  ...extra,
});

export const itemCarrinho = (id: number, idProduto: number, quantidade: number, preco = '10.50') => {
  const item: Record<string, unknown> = {
    id_item_carrinho: id,
    id_produto: idProduto,
    quantidade,
    preco_unitario: preco,
  };
  item.update = jest.fn(async (novo: Record<string, unknown>) => {
    Object.assign(item, novo);
  });
  item.destroy = jest.fn().mockResolvedValue(undefined);
  return item;
};

export const carrinhoCom = (itens: unknown[], extra: Record<string, unknown> = {}) => ({
  id_carrinho: 1,
  id_usuario: 5,
  ativo: true,
  itens,
  update: jest.fn().mockResolvedValue(undefined),
  ...extra,
});

export const pedidoCom = (extra: Record<string, unknown> = {}) => {
  const pedido: Record<string, unknown> = {
    id_pedido: 77,
    data: '2026-10-28T12:00:00.000Z',
    status: 'AGUARDANDO_PAGAMENTO',
    valor_total: '125.00',
    valor_frete: '0.00',
    metodo_envio: null,
    prazo_entrega_dias: null,
    codigo_rastreio: null,
    id_envio_externo: 'EXT-1',
    itens: [
      { id_item: 1, id_produto: 10, nome_produto: 'iPhone 15', quantidade: 2, preco_unitario: '12.50' },
      { id_item: 2, id_produto: 11, nome_produto: 'Capa', quantidade: 1, preco_unitario: '100.00' },
    ],
    endereco: {
      endereco: 'Rua A', numero: '10', complemento: null, bairro: 'Centro', cidade: 'Cascavel', estado: 'PR', cep: '85800000',
    },
    cliente: { id_usuario: 5, nome: 'Rafael', email: 'rafael@mce.test', telefone: '45999990000', cpf: '52998224725' },
    ...extra,
  };
  pedido.update = jest.fn(async (novo: Record<string, unknown>) => {
    Object.assign(pedido, novo);
  });
  return pedido;
};
