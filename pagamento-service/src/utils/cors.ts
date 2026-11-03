import cors from 'cors';

// CORS_ORIGINS="https://loja.com,https://admin.loja.com" restringe as origens permitidas.
// Vazio = qualquer origem (desenvolvimento).
export function configurarCors() {
  const origens = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return cors(origens.length > 0 ? { origin: origens } : undefined);
}
