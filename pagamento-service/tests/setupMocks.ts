// Os testes não usam MySQL, Redis, Vendas nem Mercado Pago reais.
jest.mock('ioredis', () => require('ioredis-mock'));

jest.mock('../src/config/database', () => ({
  sequelize: { authenticate: jest.fn(), close: jest.fn() },
}));

jest.mock('../src/models', () => ({
  Pagamento: { findOne: jest.fn(), findAndCountAll: jest.fn(), create: jest.fn(), update: jest.fn() },
}));

jest.mock('../src/clients/vendasClient', () => ({
  buscarPedido: jest.fn(),
  atualizarStatus: jest.fn(),
}));

jest.mock('../src/gateways', () => ({
  obterGateway: jest.fn(),
}));
