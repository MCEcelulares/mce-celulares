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
  Pedido: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    sum: jest.fn(),
    count: jest.fn(),
  },
  ItemPedido: { bulkCreate: jest.fn(), findAll: jest.fn(), destroy: jest.fn() },
  EnderecoPedido: { create: jest.fn(), destroy: jest.fn() },
  UsuarioPedido: { create: jest.fn(), destroy: jest.fn() },
}));

jest.mock('../src/clients/catalogoClient', () => ({
  buscarProduto: jest.fn(),
  reservarEstoque: jest.fn(),
  devolverReserva: jest.fn(),
}));

jest.mock('../src/clients/identidadeClient', () => ({
  buscarUsuario: jest.fn(),
  buscarEndereco: jest.fn(),
}));
