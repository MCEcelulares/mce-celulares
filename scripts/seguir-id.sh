#!/usr/bin/env bash
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

const achadas = entradas.filter((e) => e.bruto.includes(id));
const eventos = new Set(achadas.map((e) => e.j.idEvento).filter(Boolean));
const incluidas = new Set(achadas);
for (const e of entradas) if (e.j.idEvento && eventos.has(e.j.idEvento)) incluidas.add(e);
for (const e of entradas) if (e.j.idCorrelacao && eventos.has(e.j.idCorrelacao)) incluidas.add(e);

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
