const crypto = require('crypto');
const fs = require('fs');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

fs.writeFileSync('jwt-private.pem', privateKey);
fs.writeFileSync('jwt-public.pem', publicKey);

const escapar = (pem) => pem.trim().replace(/\r\n/g, '\n').replace(/\n/g, '\\n');

console.log('Cole isto no identidade-service/.env, no lugar do JWT_PRIVATE_KEY:\n');
console.log(`JWT_PRIVATE_KEY="${escapar(privateKey)}"`);
console.log('\n---\n');
console.log('Cole isto no .env dos OUTROS 4 serviços (catalogo, vendas, pagamento, notificacao), no lugar do JWT_PUBLIC_KEY:\n');
console.log(`JWT_PUBLIC_KEY="${escapar(publicKey)}"`);