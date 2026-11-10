#!/usr/bin/env bash
# Aplica uma versão (tag de imagem), confere a saúde dos 5 serviços e, se algo falhar, volta sozinho para a versão anterior.
# Uso: REGISTRY_OWNER=<dono> ./scripts/deploy.sh v1.2.0
set -uo pipefail
cd "$(dirname "$0")/.."

TAG="${1:?uso: scripts/deploy.sh <tag>}"
: "${REGISTRY_OWNER:?defina REGISTRY_OWNER (dono das imagens no ghcr.io)}"
PORTA="${GATEWAY_PORTA:-8080}"
TENTATIVAS="${HEALTH_TENTATIVAS:-30}"
INTERVALO="${HEALTH_INTERVALO:-5}"
ESTADO=".deploy"
SERVICOS=(identidade catalogo vendas pagamento notificacao)
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.deploy.yml)

mkdir -p "$ESTADO"
ATUAL="$(cat "$ESTADO/tag-atual" 2>/dev/null || true)"

# A tag vai só no ambiente do comando (não sobrescreve a variável TAG deste script).
aplicar() {
  TAG="$1" "${COMPOSE[@]}" pull && TAG="$1" "${COMPOSE[@]}" up -d --no-build --remove-orphans
}

# Saudável = todos os serviços respondem 200 com "status":"ok" no /health, pelo gateway.
saudavel() {
  local servico tentativa
  for servico in "${SERVICOS[@]}"; do
    for ((tentativa = 1; tentativa <= TENTATIVAS; tentativa++)); do
      if curl -fsS "http://localhost:${PORTA}/${servico}/health" 2>/dev/null | grep -q '"status":"ok"'; then
        break
      fi
      if ((tentativa == TENTATIVAS)); then
        echo "✗ ${servico} não ficou saudável" >&2
        return 1
      fi
      sleep "$INTERVALO"
    done
  done
}

echo "→ aplicando ${TAG} (atual: ${ATUAL:-nenhuma})"
if aplicar "$TAG" && saudavel; then
  [[ -n "$ATUAL" && "$ATUAL" != "$TAG" ]] && echo "$ATUAL" > "$ESTADO/tag-anterior"
  echo "$TAG" > "$ESTADO/tag-atual"
  echo "✓ ${TAG} no ar"
  exit 0
fi

echo "✗ ${TAG} falhou" >&2
if [[ -z "$ATUAL" || "$ATUAL" == "$TAG" ]]; then
  echo "sem versão anterior para restaurar: investigue (docs: operacao/runbook-incidentes.md)" >&2
  exit 1
fi

echo "→ rollback automático para ${ATUAL}" >&2
if aplicar "$ATUAL" && saudavel; then
  echo "✓ ${ATUAL} restaurada; ${TAG} NÃO está no ar" >&2
else
  echo "✗ a versão ${ATUAL} também não ficou saudável: ação manual (operacao/runbook-incidentes.md)" >&2
fi
exit 1
