import 'dotenv/config';
import { app } from './app';
import { sequelize } from './config/database';
import { redis, aguardarRedis } from './config/redis';
import { logger } from './utils/logger';
import './models'; 

const porta = Number(process.env.PORT ?? 3001);

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('conectado ao identidade-db');
  } catch (err) {
    logger.fatal({ err }, 'falha ao conectar no banco');
    process.exit(1);
  }

  await aguardarRedis();

  const server = app.listen(porta, () => {
    logger.info({ porta }, 'identidade-service no ar');
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
