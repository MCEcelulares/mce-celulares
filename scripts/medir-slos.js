#!/usr/bin/env node
/* eslint-disable no-console */
// Mede os SLOs de qualidade-observabilidade/quality-scenarios-slo.md a partir das métricas dos serviços e do log do Nginx.
//   node scripts/medir-slos.js              # tudo desde que os containers subiram; log do Nginx das últimas 24h
//   node scripts/medir-slos.js 2h           # outra janela para o log do Nginx (formato do `docker logs --since`)
//   node scripts/medir-slos.js --zerar      # grava uma linha de base: as próximas medições mostram só o que vier depois
//   node scripts/medir-slos.js --limpar     # remove a linha de base (volta a medir desde que os containers subiram)
// Requisitos: ambiente no ar e METRICS_TOKEN (variável de ambiente ou linha METRICS_TOKEN= do .env de cada serviço).
// Variável opcional: GATEWAY (padrão http://localhost:8080).
// Sem linha de base, os contadores e histogramas dos serviços valem desde que o container subiu (zeram ao recriá-lo) e
// só o log do Nginx respeita a janela. Com linha de base, os serviços e o Nginx valem desde o momento em que ela foi gravada.
// A linha de base fica em .slo-baseline.json (ignorado pelo git). Sem tráfego suficiente, o SLO aparece como SEM DADOS.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const GATEWAY = (process.env.GATEWAY ?? 'http://localhost:8080').replace(/\/$/, '');
const FLAGS = process.argv.slice(2).filter((a) => a.startsWith('--'));
const JANELA = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? '24h';
const ARQUIVO_BASE = path.join(RAIZ, '.slo-baseline.json');

function tokenDe(servico) {
  if (process.env.METRICS_TOKEN) return process.env.METRICS_TOKEN;
  try {
    const m = fs.readFileSync(path.join(RAIZ, `${servico}-service`, '.env'), 'utf8').match(/^METRICS_TOKEN=(.*)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

// Texto no formato Prometheus -> [{ nome, rotulos, valor }]
function interpretar(texto) {
  const amostras = [];
  for (const linha of texto.split('\n')) {
    if (!linha || linha.startsWith('#')) continue;
    const m = linha.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+(\S+)$/);
    if (!m) continue;
    const rotulos = {};
    for (const r of (m[2] ?? '').matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g)) rotulos[r[1]] = r[2];
    amostras.push({ nome: m[1], rotulos, valor: Number(m[3]) });
  }
  return amostras;
}

async function coletar(servico) {
  const token = tokenDe(servico);
  if (!token) throw new Error(`sem METRICS_TOKEN para ${servico} (defina a variável ou preencha o .env do serviço)`);
  const resposta = await fetch(`${GATEWAY}/${servico}/metrics`, { headers: { Authorization: `Bearer ${token}` } });
  if (resposta.status !== 200) throw new Error(`${servico}/metrics respondeu ${resposta.status}`);
  return interpretar(await resposta.text());
}

// ---- linha de base: mede só o que aconteceu depois de um instante ----
const chaveDe = (a) => `${a.nome}|${Object.keys(a.rotulos).sort().map((k) => `${k}=${a.rotulos[k]}`).join(',')}`;
const acumulada = (nome) => /_(bucket|count|sum|total)$/.test(nome);

function lerBase() {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO_BASE, 'utf8'));
  } catch {
    return null;
  }
}

// Desconta da amostra o valor que ela tinha na linha de base. Série que diminuiu (container recriado depois da linha
// de base) recomeçou do zero, então vale inteira.
function descontar(amostras, base) {
  if (!base) return amostras;
  return amostras.map((a) => {
    if (!acumulada(a.nome)) return a;
    const antes = base[chaveDe(a)];
    return antes === undefined || a.valor < antes ? a : { ...a, valor: a.valor - antes };
  });
}

const bate = (amostra, filtro) => Object.entries(filtro).every(([k, v]) => (v instanceof RegExp ? v.test(amostra.rotulos[k] ?? '') : amostra.rotulos[k] === v));

// Percentil de um histograma Prometheus (interpolação linear dentro do bucket, como o histogram_quantile).
function percentil(amostras, nome, filtro, q) {
  const buckets = new Map();
  let total = 0;
  for (const a of amostras) {
    if (a.nome === `${nome}_bucket` && bate(a, filtro)) buckets.set(a.rotulos.le, (buckets.get(a.rotulos.le) ?? 0) + a.valor);
    if (a.nome === `${nome}_count` && bate(a, filtro)) total += a.valor;
  }
  if (total === 0) return { valor: null, amostras: 0 };
  const ordenados = [...buckets.entries()]
    .map(([le, n]) => ({ le: le === '+Inf' ? Infinity : Number(le), n }))
    .sort((x, y) => x.le - y.le);
  const alvo = q * total;
  let anteriorLe = 0;
  let anteriorN = 0;
  for (const { le, n } of ordenados) {
    if (n >= alvo) {
      if (le === Infinity) return { valor: Infinity, amostras: total, acimaDe: anteriorLe };
      const proporcao = n === anteriorN ? 0 : (alvo - anteriorN) / (n - anteriorN);
      return { valor: anteriorLe + (le - anteriorLe) * proporcao, amostras: total };
    }
    anteriorLe = le;
    anteriorN = n;
  }
  return { valor: null, amostras: total };
}

// % de respostas que NÃO são 5xx (4xx de negócio, como 401 ou 409, não contam como indisponibilidade).
function disponibilidade(amostras, filtro) {
  let total = 0;
  let falhas = 0;
  for (const a of amostras) {
    if (a.nome !== 'http_requisicoes_total' || !bate(a, filtro)) continue;
    total += a.valor;
    if (/^5/.test(a.rotulos.status)) falhas += a.valor;
  }
  return { valor: total === 0 ? null : (100 * (total - falhas)) / total, amostras: total };
}

function disponibilidadeNginx(desde) {
  const r = spawnSync('docker', ['logs', 'nginx', '--since', desde], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(`docker logs nginx falhou: ${r.error?.message ?? r.stderr}`);
  let total = 0;
  let falhas = 0;
  for (const linha of `${r.stdout}\n${r.stderr}`.split('\n')) {
    const m = linha.match(/^(\S+) \S+ \S+ \[[^\]]+\] "(\S+) (\S+) [^"]*" (\d{3}) /);
    if (!m) continue;
    const [, ip, , caminho, status] = m;
    if (ip === '127.0.0.1') continue; // healthcheck do próprio container
    // leitura das métricas e sondas de saúde (inclusive durante reinícios) não são tráfego de cliente
    if (/\/(metrics|health(\/live)?)(\?|$)/.test(caminho)) continue;
    total++;
    if (status.startsWith('5')) falhas++;
  }
  return { valor: total === 0 ? null : (100 * (total - falhas)) / total, amostras: total };
}

const fmtSeg = (v) => (v === Infinity ? '> maior bucket' : v < 1 ? `${(v * 1000).toFixed(0)} ms` : `${v.toFixed(2)} s`);

(async () => {
  if (FLAGS.includes('--limpar')) {
    fs.rmSync(ARQUIVO_BASE, { force: true });
    console.log('Linha de base removida: as medições voltam a valer desde que cada container subiu.');
    return;
  }

  const dados = {};
  for (const s of ['catalogo', 'vendas', 'notificacao']) dados[s] = await coletar(s);

  if (FLAGS.includes('--zerar')) {
    const servicos = {};
    for (const [s, amostras] of Object.entries(dados)) {
      servicos[s] = {};
      for (const a of amostras) if (acumulada(a.nome)) servicos[s][chaveDe(a)] = a.valor;
    }
    const criadoEm = new Date().toISOString();
    fs.writeFileSync(ARQUIVO_BASE, JSON.stringify({ criadoEm, servicos }));
    console.log(`Linha de base gravada (${criadoEm}). As próximas medições mostram só o que vier depois dela.`);
    console.log('Gere tráfego (node demonstracao/gerar-carga.js) e rode node scripts/medir-slos.js. Para voltar ao normal: --limpar.');
    return;
  }

  const base = lerBase();
  if (base) for (const s of Object.keys(dados)) dados[s] = descontar(dados[s], base.servicos?.[s]);

  const linhas = [];
  const adicionar = (id, nome, meta, resultado, formatar, passa) => {
    const semDados = resultado.valor === null;
    linhas.push({ id, nome, meta, medido: semDados ? '—' : formatar(resultado.valor), n: resultado.amostras, situacao: semDados ? 'SEM DADOS' : passa(resultado.valor) ? 'OK' : 'VIOLADO' });
  };

  adicionar(1, 'GET /produtos (2xx), p95', '< 300 ms', percentil(dados.catalogo, 'http_requisicao_duracao_segundos', { metodo: 'GET', rota: '/produtos', status: /^2/ }, 0.95), fmtSeg, (v) => v < 0.3);
  adicionar(2, 'POST /pedidos (2xx), p95', '< 1,5 s', percentil(dados.vendas, 'http_requisicao_duracao_segundos', { metodo: 'POST', rota: '/pedidos', status: /^2/ }, 0.95), fmtSeg, (v) => v < 1.5);
  adicionar(3, 'POST /pedidos sem 5xx', '≥ 99 %', disponibilidade(dados.vendas, { metodo: 'POST', rota: '/pedidos' }), (v) => `${v.toFixed(2)} %`, (v) => v >= 99);
  adicionar(4, 'e-mail: evento → envio, p95', '< 10 s', percentil(dados.notificacao, 'notificacao_entrega_segundos', {}, 0.95), fmtSeg, (v) => v < 10);
  const desdeNginx = base ? base.criadoEm : JANELA;
  adicionar(5, `gateway sem 5xx (log, ${base ? 'desde a linha de base' : JANELA})`, '≥ 99 %', disponibilidadeNginx(desdeNginx), (v) => `${v.toFixed(2)} %`, (v) => v >= 99);

  const larg = (campo, min) => Math.max(min, ...linhas.map((l) => String(l[campo]).length));
  const w = { nome: larg('nome', 6), meta: larg('meta', 4), medido: larg('medido', 6) };
  console.log(`SLO  ${'Medição'.padEnd(w.nome)}  ${'Meta'.padEnd(w.meta)}  ${'Medido'.padEnd(w.medido)}  Amostras  Situação`);
  for (const l of linhas) console.log(`${String(l.id).padEnd(4)} ${l.nome.padEnd(w.nome)}  ${l.meta.padEnd(w.meta)}  ${l.medido.padEnd(w.medido)}  ${String(l.n).padStart(8)}  ${l.situacao}`);
  console.log(
    base
      ? `\nLinha de base de ${base.criadoEm}: só entra o que veio depois dela, nos serviços e no log do Nginx (--limpar remove).`
      : `\nHistogramas e contadores dos serviços: desde que o container subiu. Log do Nginx: janela ${JANELA}.`
  );

  process.exit(linhas.some((l) => l.situacao === 'VIOLADO') ? 1 : 0);
})().catch((erro) => {
  console.error('ERRO:', erro.message);
  process.exit(2);
});
