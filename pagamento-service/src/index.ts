import 'dotenv/config';
import { app } from './app';
import { sequelize } from './config/database';
import { redis, aguardarRedis } from './config/redis';
import { logger } from './utils/logger';
import './models';

const porta = Number(process.env.PORT ?? 3004);

async function start() {
  if (process.env.GATEWAY_PAGAMENTO === 'simulado') {
    logger.warn('GATEWAY_PAGAMENTO=simulado: pagamentos são aprovados sem cobrança real. Use só em desenvolvimento.');
  } else if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    logger.warn('MERCADOPAGO_ACCESS_TOKEN vazio: POST /pagamentos responderá 503 até configurar o token (ver README do serviço).');
  } else if (!process.env.PUBLIC_BASE_URL) {
    logger.warn('PUBLIC_BASE_URL vazio: o Mercado Pago não conseguirá enviar o webhook; use POST /pagamentos/{idPedido}/sincronizar para confirmar.');
  }

  try {
    await sequelize.authenticate();
    logger.info('conectado ao pagamento-db');
  } catch (err) {
    logger.fatal({ err }, 'falha ao conectar no banco');
    process.exit(1);
  }

  await aguardarRedis();

  const server = app.listen(porta, () => {
    logger.info({ porta }, 'pagamento-service no ar');
  });

  const encerrar = (sinal: string) => {
    logger.info({ sinal }, 'encerrando');
    server.close(async () => {
      await sequelize.close();
      redis.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
}

process.on('unhandledRejection', (err) => logger.error({ err }, 'promise rejeitada sem tratamento'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'exceção não capturada');
  process.exit(1);
});

start();
