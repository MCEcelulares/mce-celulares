// Os testes não usam MySQL, Redis nem os outros serviços reais.
jest.mock('ioredis', () => require('ioredis-mock'));

jest.mock('../src/config/database', () => ({
  sequelize: {
    authenticate: jest.fn(),
    close: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../src/models', () => ({
  Carrinho: { findOne: jest.fn(), create: jest.fn() },
  ItemCarrinho: { create: jest.fn() },
  Pedido: { create: jest.fn(), findByPk: jest.fn(), findAndCountAll: jest.fn() },
  ItemPedido: { bulkCreate: jest.fn() },
  EnderecoPedido: { create: jest.fn() },
  UsuarioPedido: { create: jest.fn() },
}));

jest.mock('../src/clients/catalogoClient', () => ({
  buscarProduto: jest.fn(),
  baixarEstoque: jest.fn(),
  reporEstoque: jest.fn(),
}));

jest.mock('../src/clients/identidadeClient', () => ({
  buscarUsuario: jest.fn(),
  buscarEndereco: jest.fn(),
}));
