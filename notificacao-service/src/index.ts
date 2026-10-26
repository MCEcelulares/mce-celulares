import 'dotenv/config';
import { app } from './app';
import { sequelize } from './config/database';
import { redisAssinante } from './config/redis';
import { iniciarAssinante } from './services/assinanteService';
import { logger } from './utils/logger';
import './models';

const porta = Number(process.env.PORT ?? 3005);

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('conectado ao notificacao-db');
  } catch (err) {
    logger.fatal({ err }, 'falha ao conectar no banco');
    process.exit(1);
  }

  iniciarAssinante().catch((err) => logger.error({ err }, 'falha ao assinar canais de eventos'));

  const server = app.listen(porta, () => {
    logger.info({ porta }, 'notificacao-service no ar');
  });

  const encerrar = (sinal: string) => {
    logger.info({ sinal }, 'encerrando');
    server.close(async () => {
      await sequelize.close();
      redisAssinante.disconnect();
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
