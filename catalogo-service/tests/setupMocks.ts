jest.mock('ioredis', () =>
  process.env.USAR_REDIS_REAL === 'true' ? jest.requireActual('ioredis') : require('ioredis-mock')
);
