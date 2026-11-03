"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const imagemService_1 = require("./services/imagemService");
const logger_1 = require("./utils/logger");
require("./models");
const porta = Number(process.env.PORT ?? 3002);
async function start() {
    try {
        await database_1.sequelize.authenticate();
        logger_1.logger.info('conectado ao catalogo-db');
    }
    catch (err) {
        logger_1.logger.fatal({ err }, 'falha ao conectar no banco');
        process.exit(1);
    }
    await (0, redis_1.aguardarRedis)();
    await (0, imagemService_1.garantirDiretorioDeImagens)();
    const server = app_1.app.listen(porta, () => {
        logger_1.logger.info({ porta }, 'catalogo-service no ar');
    });
    const encerrar = (sinal) => {
        logger_1.logger.info({ sinal }, 'encerrando');
        server.close(async () => {
            await database_1.sequelize.close();
            redis_1.redis.disconnect();
            process.exit(0);
        });
    };
    process.on('SIGTERM', () => encerrar('SIGTERM'));
    process.on('SIGINT', () => encerrar('SIGINT'));
}
process.on('unhandledRejection', (err) => logger_1.logger.error({ err }, 'promise rejeitada sem tratamento'));
process.on('uncaughtException', (err) => {
    logger_1.logger.fatal({ err }, 'exceção não capturada');
    process.exit(1);
});
start();
