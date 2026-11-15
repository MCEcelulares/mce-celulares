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
process.env.VENDAS_SERVICE_URL = 'http://vendas.test:3003';
process.env.VENDAS_SERVICE_TOKEN = 'token-do-vendas-teste';
process.env.HTTP_TIMEOUT_MS = '200';
process.env.HTTP_BACKOFF_BASE_MS = '1';
// Alto de propósito: só os testes do circuit breaker o reduzem.
process.env.CIRCUIT_FALHAS = '1000';
// Vazias (e não apagadas) para o dotenv não preencher com o .env real de quem roda os testes.
process.env.GATEWAY_PAGAMENTO = '';
process.env.MERCADOPAGO_ACCESS_TOKEN = '';
process.env.PUBLIC_BASE_URL = '';
process.env.FRONTEND_URL = '';
process.env.RATE_LIMIT_DESLIGADO = 'true';
