import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateKeyPairSync } from 'crypto';

dotenv.config();

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

process.env.JWT_PUBLIC_KEY = publicKey;
process.env.JWT_PRIVATE_KEY_TESTE = privateKey; // só os testes assinam tokens (no serviço real só existe a chave pública)
process.env.SERVICE_TOKEN = 'token-de-servico-de-teste';
process.env.METRICS_TOKEN = 'token-de-teste';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogo-imagens-'));
process.env.IMAGENS_URL_BASE = '/catalogo/imagens';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
