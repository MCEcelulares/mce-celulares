import { generateKeyPairSync } from 'crypto';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

process.env.JWT_PUBLIC_KEY = publicKey;
process.env.TESTE_JWT_PRIVATE_KEY = privateKey;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.METRICS_TOKEN = 'token-de-teste';
process.env.SERVICE_TOKEN = 'token-de-servico-teste';
process.env.CACHE_TTL_SEGUNDOS = '60';
