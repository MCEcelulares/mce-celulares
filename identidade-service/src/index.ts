import 'dotenv/config';
import { app } from './app';
import { sequelize } from './config/database';
import './models'; 

const PORT = process.env.PORT

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Conectado ao identidade-db');
  } catch (err) {
    console.error('Falha ao conectar no banco:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`identidade-service rodando na porta ${PORT}`);
  });
}

start();
