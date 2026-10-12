set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] rodando migrations..."
  npx sequelize-cli db:migrate
fi

if [ "$RUN_SEEDS" = "true" ]; then
  echo "[entrypoint] rodando seeds..."
  npx sequelize-cli db:seed:all
fi

exec node dist/index.js
