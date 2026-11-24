import cors from 'cors';

export function configurarCors() {
  const origens = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return cors(origens.length > 0 ? { origin: origens } : undefined);
}
