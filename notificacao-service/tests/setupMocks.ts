// Os testes não usam MySQL, Redis nem SMTP reais.
jest.mock('ioredis', () => require('ioredis-mock'));

jest.mock('../src/config/database', () => ({
  sequelize: { authenticate: jest.fn().mockResolvedValue(undefined), close: jest.fn() },
}));

jest.mock('../src/models', () => ({
  NotificacaoLog: { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn() },
}));

jest.mock('../src/services/emailService', () => ({
  enviarEmail: jest.fn().mockResolvedValue(undefined),
}));
