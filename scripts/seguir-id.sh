#!/usr/bin/env bash
# Mostra, em ordem de tempo, tudo o que os 5 serviços registraram sobre um id: o x-correlation-id de uma requisição
# ou o idEvento de um evento. Se o id aparecer numa linha com idEvento (ex.: "evento publicado"), as linhas desse
# evento no consumidor entram também, então dá para seguir da requisição HTTP até o e-mail.
#   ./scripts/seguir-id.sh <id> [desde]        (desde: janela de logs, padrão 1h; ex.: 10m, 2h)
#   ./scripts/seguir-id.sh corr-demo-123
# Requer os containers no ar (docker logs) e Node. Os logs são JSON (pino); linhas que não são JSON são ignoradas.
set -u

ID="${1:?uso: seguir-id.sh <id> [desde]}"
DESDE="${2:-1h}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

for servico in identidade catalogo vendas pagamento notificacao; do
  docker logs "$servico" --since "$DESDE" 2>&1 | sed "s/^/$servico\t/" >> "$TMP"
done

node - "$ID" "$TMP" <<'EOF'
const fs = require('fs');
const [, , id, arquivo] = process.argv;

const entradas = [];
for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
  const tab = linha.indexOf('\t');
  if (tab < 0) continue;
  try { entradas.push({ servico: linha.slice(0, tab), bruto: linha.slice(tab + 1), j: JSON.parse(linha.slice(tab + 1)) }); } catch { /* não é JSON */ }
}

// 1ª passada: linhas que mencionam o id. 2ª: linhas dos eventos (idEvento) citados nelas.
const achadas = entradas.filter((e) => e.bruto.includes(id));
const eventos = new Set(achadas.map((e) => e.j.idEvento).filter(Boolean));
const incluidas = new Set(achadas);
for (const e of entradas) if (e.j.idEvento && eventos.has(e.j.idEvento)) incluidas.add(e);
for (const e of entradas) if (e.j.idCorrelacao && eventos.has(e.j.idCorrelacao)) incluidas.add(e); // consumidor usa o idEvento como idCorrelacao

const nivel = { 10: 'trace', 20: 'debug', 30: 'info', 40: 'WARN', 50: 'ERROR', 60: 'FATAL' };
const extras = ['idPedido', 'tipo', 'canal', 'receptores', 'idEvento', 'idCorrelacaoOrigem', 'motivo', 'status'];
const lista = [...incluidas].sort((a, b) => String(a.j.time).localeCompare(String(b.j.time)));

if (lista.length === 0) { console.log(`Nenhuma linha com "${id}" nos logs (janela pedida). Tente uma janela maior: seguir-id.sh ${id} 24h`); process.exit(1); }
for (const { servico, j } of lista) {
  const hora = typeof j.time === 'string' ? j.time.slice(11, 23) : '--:--:--.---';
  const campos = extras.filter((c) => j[c] !== undefined).map((c) => `${c}=${j[c]}`).join(' ');
  console.log(`${hora}  ${servico.padEnd(11)} ${(nivel[j.level] || j.level).toString().padEnd(5)} ${j.msg ?? ''}${campos ? '  [' + campos + ']' : ''}`);
}
EOF
