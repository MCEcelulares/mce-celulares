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

// Imagens de teste vão para uma pasta temporária própria desta execução.
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

process.env.UPLOADS_DIR = mkdtempSync(join(tmpdir(), 'catalogo-uploads-'));
process.env.IMAGENS_URL_BASE = '/catalogo/imagens';
process.env.RATE_LIMIT_DESLIGADO = 'true';
