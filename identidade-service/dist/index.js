"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const database_1 = require("./config/database");
require("./models");
const PORT = process.env.PORT;
async function start() {
    try {
        await database_1.sequelize.authenticate();
        console.log('Conectado ao identidade-db');
    }
    catch (err) {
        console.error('Falha ao conectar no banco:', err);
        process.exit(1);
    }
    app_1.app.listen(PORT, () => {
        console.log(`identidade-service rodando na porta ${PORT}`);
    });
}
start();
