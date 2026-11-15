#!/usr/bin/env bash
# Volta para uma versão já publicada. Sem argumento, volta para a anterior ao último deploy bem-sucedido.
# Uso: REGISTRY_OWNER=<dono> ./scripts/rollback.sh [tag]
set -uo pipefail
cd "$(dirname "$0")/.."

: "${REGISTRY_OWNER:?defina REGISTRY_OWNER (dono das imagens no ghcr.io)}"
ESTADO=".deploy"
ATUAL="$(cat "$ESTADO/tag-atual" 2>/dev/null || true)"
DESTINO="${1:-$(cat "$ESTADO/tag-anterior" 2>/dev/null || true)}"

if [[ -z "$DESTINO" ]]; then
  echo "informe a tag (ex.: ./scripts/rollback.sh v1.0.0): não há versão anterior registrada" >&2
  exit 1
fi

echo "→ rollback ${ATUAL:-?} → ${DESTINO}"
# O deploy.sh aplica, confere a saúde e atualiza o estado; se ${DESTINO} não ficar saudável ele avisa.
exec ./scripts/deploy.sh "$DESTINO"
