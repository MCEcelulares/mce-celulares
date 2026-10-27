#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] rodando migrations..."
  npx sequelize-cli db:migrate
fi

exec node dist/index.js
