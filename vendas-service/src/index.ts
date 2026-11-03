import 'dotenv/config';
import { app } from './app';
import { sequelize } from './config/database';
import { redis, aguardarRedis } from './config/redis';
import { iniciarExpiracaoDePedidos } from './jobs/expirarPedidos';
import { logger } from './utils/logger';
import './models';

const porta = Number(process.env.PORT ?? 3003);

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('conectado ao vendas-db');
  } catch (err) {
    logger.fatal({ err }, 'falha ao conectar no banco');
    process.exit(1);
  }

  await aguardarRedis();

  const server = app.listen(porta, () => {
    logger.info({ porta }, 'vendas-service no ar');
  });

  const rotinaDeExpiracao = iniciarExpiracaoDePedidos();

  const encerrar = (sinal: string) => {
    logger.info({ sinal }, 'encerrando');
    if (rotinaDeExpiracao) clearInterval(rotinaDeExpiracao);
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
