/* eslint-disable no-console */
const { execFileSync } = require('child_process');
const { criarContexto, lerEnv, esperar, RAIZ } = require('../e2e/lib');

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const envVendas = lerEnv('vendas-service/.env');
const TENTATIVAS = Number(process.env.TENTATIVAS ?? 8);
const RESET_MS = Number(envVendas.CIRCUIT_RESET_MS ?? 10_000);

const docker = (...args) => execFileSync('docker', args, { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

async function metricasCircuito() {
  const r = await fetch(`${BASE}/vendas/metrics`, { headers: { Authorization: `Bearer ${envVendas.METRICS_TOKEN}` } });
  if (r.status !== 200) throw new Error(`/vendas/metrics respondeu ${r.status}: preencha METRICS_TOKEN no .env do vendas-service`);
  const texto = await r.text();
  const valor = (evento) => Number(texto.match(new RegExp(`^vendas_eventos_total\\{[^}]*evento="${evento}"[^}]*\\} (\\d+)`, 'm'))?.[1] ?? 0);
  return { aberto: valor('circuito_aberto'), recusou: valor('circuito_recusou_chamada'), fechado: valor('circuito_fechado') };
}
const mostrar = (rotulo, m) => console.log(`[${rotulo}] circuito_aberto=${m.aberto}  circuito_recusou_chamada=${m.recusou}  circuito_fechado=${m.fechado}`);

(async () => {
  const c = criarContexto('breaker');
  const admin = await c.loginAdmin();
  const base = await c.criarCatalogoDeTeste(admin, [{ nome: 'Produto Breaker', preco: 100, estoque: 10 }]);
  const cliente = await c.novoCliente('breaker');
  await c.req('POST', '/vendas/carrinho/itens', { idProduto: base.produtos[0].id_produto, quantidade: 1 }, cliente.token);

  const tentarPedido = async () => {
    const inicio = Date.now();
    const r = await c.req('POST', '/vendas/pedidos', { idEndereco: cliente.idEndereco }, cliente.token);
    return { status: r.s, ms: Date.now() - inicio, mensagem: r.b?.erro ?? `pedido #${r.b?.id_pedido}` };
  };

  mostrar('antes ', await metricasCircuito());
  console.log('\n> docker stop catalogo');
  docker('stop', 'catalogo');
  try {
    for (let i = 1; i <= TENTATIVAS; i++) {
      const t = await tentarPedido();
      console.log(`tentativa ${i}: HTTP ${t.status} em ${String(t.ms).padStart(4)} ms  (${t.mensagem})`);
    }
    mostrar('aberto', await metricasCircuito());
  } finally {
    console.log('\n> docker start catalogo');
    docker('start', 'catalogo');
  }

  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${BASE}/catalogo/health`).catch(() => null);
    if (r?.status === 200) break;
    await esperar(2000);
  }
  console.log(`Catálogo de volta. Aguardando ${RESET_MS / 1000} s (CIRCUIT_RESET_MS) para o circuito testar de novo...`);
  await esperar(RESET_MS + 1000);

  const t = await tentarPedido();
  console.log(`tentativa após religar: HTTP ${t.status} em ${t.ms} ms  (${t.mensagem})`);
  mostrar('final ', await metricasCircuito());
})().catch((erro) => {
  console.error('ERRO:', erro.message);
  process.exit(1);
});
