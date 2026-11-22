#!/usr/bin/env bash
# Verifica o gateway Nginx de um ambiente que já está no ar (docker compose up -d).
#   ./scripts/verificar-gateway.sh                # testes só de leitura
#   ./scripts/verificar-gateway.sh --isolamento   # também para o serviço "vendas" por alguns segundos e confere o 502/504
# Variável: GATEWAY (padrão http://localhost:8080). Sai com código 1 se algum teste falhar.
set -u

GW="${GATEWAY:-http://localhost:8080}"
falhas=0

# esperar <descrição> <código esperado, ou alternativas como "502|504"> <caminho> [argumentos extras do curl]
esperar() {
  local descricao="$1" esperado="$2" caminho="$3"; shift 3
  local obtido
  obtido="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$@" "$GW$caminho")"
  if [[ "$obtido" =~ ^($esperado)$ ]]; then
    printf '  ok    %-58s %s\n' "$descricao" "$obtido"
  else
    printf '  FALHA %-58s esperado %s, obtido %s\n' "$descricao" "$esperado" "$obtido"
    falhas=$((falhas + 1))
  fi
}

echo "== roteamento por prefixo"
for s in identidade catalogo vendas pagamento notificacao; do
  esperar "GET /$s/health" 200 "/$s/health"
done
esperar "GET /catalogo/produtos (público)" 200 "/catalogo/produtos?limite=1"

echo "== rotas internas do Catálogo não saem pelo gateway"
for c in /catalogo/interno /catalogo/interno/ /catalogo/interno/reservas/1 "/catalogo/interno/produtos?ids=1" \
         /catalogo/Interno/reservas/1 /catalogo/INTERNO/produtos //catalogo/interno/reservas/1 \
         /catalogo/%69nterno/reservas/1 /catalogo/./interno/reservas/1 /catalogo/x/../interno/reservas/1 \
         "/catalogo/interno%2Freservas/1"; do
  esperar "GET $c" 404 "$c"
done

echo "== documentação, saúde do gateway e rota inexistente"
esperar "GET /docs/" 200 "/docs/"
esperar "GET /docs/apis/catalogo.openapi.yaml" 200 "/docs/apis/catalogo.openapi.yaml"
esperar "GET /health (Nginx)" 200 "/health"
esperar "GET /nao-existe" 404 "/nao-existe"

echo "== limite de corpo (2 MB em /vendas/pedidos; o padrão do Nginx é 1 MB)"
obtido="$(head -c 2000000 /dev/zero | tr '\0' 'a' | curl -s -o /dev/null -m 20 -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' --data-binary @- "$GW/vendas/pedidos")"
if [ "$obtido" = "413" ]; then printf '  ok    %-58s %s\n' "POST 2 MB" "$obtido"; else
  printf '  FALHA %-58s esperado 413, obtido %s\n' "POST 2 MB" "$obtido"; falhas=$((falhas + 1)); fi

echo "== cabeçalho Server não revela a versão"
servidor="$(curl -s -I -m 10 "$GW/health" | tr -d '\r' | grep -i '^server:' | head -1)"
if echo "$servidor" | grep -qE '[0-9]+\.[0-9]+'; then
  printf '  FALHA %-58s %s\n' "Server expõe versão" "$servidor"; falhas=$((falhas + 1))
else printf '  ok    %-58s %s\n' "Server sem versão" "${servidor:-Server ausente}"; fi

if [ "${1:-}" = "--isolamento" ]; then
  echo "== isolamento de falha (para o serviço vendas e religa)"
  docker stop vendas >/dev/null
  # 502 (nome já fora do DNS) ou 504 (nome ainda em cache do resolver; desiste em 5 s): serviço fora do ar vira erro rápido
  esperar "GET /vendas/health com o serviço parado" "502|504" "/vendas/health"
  esperar "GET /catalogo/health continua no ar" 200 "/catalogo/health"
  esperar "GET /health (Nginx) continua no ar" 200 "/health"
  docker start vendas >/dev/null
  for _ in $(seq 1 30); do curl -s -m 3 "$GW/vendas/health" | grep -q '"banco":"ok"' && break; sleep 2; done
  esperar "GET /vendas/health depois de religar" 200 "/vendas/health"
fi

echo
if [ "$falhas" -eq 0 ]; then echo "gateway OK"; else echo "$falhas teste(s) falharam"; exit 1; fi
