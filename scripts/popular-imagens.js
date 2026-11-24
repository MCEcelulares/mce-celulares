#!/usr/bin/env node
/* eslint-disable no-console */
// Baixa uma foto para cada produto do catálogo de demonstração e envia pela API (como o painel faz).
//
//   node scripts/popular-catalogo.js   # antes: cria os produtos
//   node scripts/popular-imagens.js    # depois: coloca as fotos
//
// As fotos vêm de capas e artigos da Wikipedia e do Wikimedia Commons (lista em scripts/imagens-produtos.json, com a origem de cada
// uma). Uso apenas para demonstração acadêmica, sem fins comerciais. Alguns modelos não têm foto própria no Commons e usam uma
// foto de um modelo parecido da mesma linha; produtos sem entrada no mapa ficam sem foto (envie pelo painel administrativo).
// Pode repetir: quem já tem imagem é pulado (use --forcar para trocar todas).
const fs = require('node:fs');
const path = require('node:path');

const API = (process.env.API_URL || 'http://localhost:8080').replace(/\/$/, '');
const FORCAR = process.argv.includes('--forcar');
const UA = { 'user-agent': 'MCE-Celulares-demo/1.0 (projeto academico; uso nao comercial)' };
const LIMITE = 2 * 1024 * 1024;
const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function lerEnv(arquivo) {
  const saida = {};
  for (const linha of fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(linha.trim());
    if (m) saida[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return saida;
}

async function json(metodo, rota, corpo, token) {
  const r = await fetch(`${API}${rota}`, {
    method: metodo,
    headers: { ...(corpo && { 'content-type': 'application/json' }), ...(token && { authorization: `Bearer ${token}` }) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${metodo} ${rota} -> HTTP ${r.status} ${dados?.erro ?? ''}`.trim());
  return dados;
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function baixar(url) {
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    const r = await fetch(url, { headers: UA });
    if (r.status === 429 || r.status >= 500) { await pausa(3000 * tentativa); continue; }
    if (!r.ok) throw new Error(`download HTTP ${r.status}`);
    const tipo = (r.headers.get('content-type') || '').split(';')[0].trim();
    const bytes = Buffer.from(await r.arrayBuffer());
    if (!TIPOS[tipo]) throw new Error(`tipo não aceito (${tipo})`);
    if (bytes.length > LIMITE) throw new Error(`arquivo de ${(bytes.length / 1048576).toFixed(1)} MB passa do limite de 2 MB`);
    return { bytes, tipo };
  }
  throw new Error('download falhou depois de 4 tentativas');
}

(async () => {
  const mapa = JSON.parse(fs.readFileSync(path.join(__dirname, 'imagens-produtos.json'), 'utf8'));
  const env = lerEnv('identidade-service/.env');
  const sessao = await json('POST', '/identidade/auth/login', { email: env.ADMIN_EMAIL, senha: env.ADMIN_SENHA });
  const token = sessao.token;

  const produtos = new Map();
  for (let pagina = 1; ; pagina++) {
    const r = await json('GET', `/catalogo/produtos?incluirInativos=true&limite=100&pagina=${pagina}`, undefined, token);
    r.dados.forEach((p) => produtos.set(p.nome, p));
    if (pagina >= (r.paginacao?.totalPaginas ?? 1)) break;
  }

  let enviadas = 0, puladas = 0, semProduto = 0;
  const falhas = [];
  for (const [nome, { url }] of Object.entries(mapa)) {
    const produto = produtos.get(nome);
    if (!produto) { semProduto++; continue; }
    if (produto.imagem && !FORCAR) { puladas++; continue; }
    try {
      const { bytes, tipo } = await baixar(url);
      const corpo = new FormData();
      corpo.append('imagem', new Blob([bytes], { type: tipo }), `produto-${produto.id_produto}.${TIPOS[tipo]}`);
      const r = await fetch(`${API}/catalogo/produtos/${produto.id_produto}/imagem`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: corpo });
      if (!r.ok) throw new Error(`envio HTTP ${r.status} ${(await r.json().catch(() => ({}))).erro ?? ''}`.trim());
      enviadas++;
      console.log(`  ✔ ${nome}`);
      await pausa(400); // educado com o servidor das fotos
    } catch (e) {
      falhas.push(`${nome}: ${e.message}`);
    }
  }
  console.log(`\nImagens: ${enviadas} enviada(s), ${puladas} já tinham, ${semProduto} sem produto no catálogo, ${falhas.length} falha(s).`);
  falhas.forEach((f) => console.log(`  ✖ ${f}`));
  const sem = [...produtos.values()].filter((p) => !p.imagem && !mapa[p.nome]).map((p) => p.nome);
  if (sem.length) console.log(`Sem foto no mapa (use o painel): ${sem.join('; ')}`);
  if (falhas.length) process.exit(1);
})().catch((e) => { console.error(`✖ ${e.message}`); process.exit(1); });
