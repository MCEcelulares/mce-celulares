// Os testes não usam MySQL nem Redis reais.
jest.mock('ioredis', () => require('ioredis-mock'));

jest.mock('../src/config/database', () => ({
  sequelize: { authenticate: jest.fn().mockResolvedValue(undefined), close: jest.fn() },
}));

jest.mock('../src/models', () => ({
  Produto: {
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  Categoria: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Marca: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
}));
