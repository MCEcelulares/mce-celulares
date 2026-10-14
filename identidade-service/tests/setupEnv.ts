import dotenv from 'dotenv';
import { generateKeyPairSync } from 'crypto';

dotenv.config();

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

process.env.JWT_PRIVATE_KEY = privateKey;
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_DESLIGADO = 'true';
process.env.METRICS_TOKEN = 'token-de-teste';
process.env.GOOGLE_CLIENT_ID = 'teste';
