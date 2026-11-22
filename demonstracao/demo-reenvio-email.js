/* eslint-disable no-console */
// Demonstra a resiliência do envio de e-mail: com o Mailpit parado o envio falha (registro FALHA); religado o Mailpit,
// a rotina de reenvio automático entrega o e-mail sozinha (ADR-008). Leva alguns minutos: a primeira espera de reenvio
// é de 2 minutos e a rotina verifica a cada minuto.
//   node demonstracao/demo-reenvio-email.js          (ambiente no ar com --profile dev; GATEWAY_PAGAMENTO=simulado)
// Para o container "mailpit" e o religa no fim, mesmo se algo falhar. Cria dados de teste.
const { execFileSync } = require('child_process');
const { criarContexto, esperar, RAIZ } = require('../e2e/lib');

const docker = (...args) => execFileSync('docker', args, { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const minutos = (inicio) => ((Date.now() - inicio) / 60000).toFixed(1);

(async () => {
  const c = criarContexto('reenvio');
  const admin = await c.loginAdmin();
  const base = await c.criarCatalogoDeTeste(admin, [{ nome: 'Produto Reenvio', preco: 100, estoque: 5 }]);
  const cliente = await c.novoCliente('reenvio');
  await c.req('POST', '/vendas/carrinho/itens', { idProduto: base.produtos[0].id_produto, quantidade: 1 }, cliente.token);

  const consultar = (id) => c.sql('notificacao', `SELECT status, tentativas, COALESCE(LEFT(erro, 60), '-') FROM notificacao_log WHERE id_pedido = ${id} AND tipo = 'PEDIDO_CRIADO'`).replace(/\t/g, ' | ');

  console.log('> docker stop mailpit');
  docker('stop', 'mailpit');
  let idPedido;
  const inicio = Date.now();
  try {
    const r = await c.req('POST', '/vendas/pedidos', { idEndereco: cliente.idEndereco }, cliente.token);
    idPedido = r.b.id_pedido;
    console.log(`POST /vendas/pedidos -> ${r.s}, pedido #${idPedido} (o pedido não depende do e-mail)`);

    for (let i = 0; i < 30; i++) {
      const linha = consultar(idPedido);
      if (linha.startsWith('FALHA')) { console.log(`[${minutos(inicio)} min] notificacao_log: ${linha}`); break; }
      await esperar(1000);
    }
  } finally {
    console.log('\n> docker start mailpit');
    docker('start', 'mailpit');
  }

  console.log('Aguardando a rotina de reenvio (espera de 2 min + verificação a cada 60 s)...');
  let ultimo = '';
  for (let i = 0; i < 100; i++) {
    const linha = consultar(idPedido);
    if (linha !== ultimo) { console.log(`[${minutos(inicio)} min] notificacao_log: ${linha}`); ultimo = linha; }
    if (linha.startsWith('ENVIADO')) break;
    await esperar(5000);
  }
  if (!ultimo.startsWith('ENVIADO')) throw new Error('o e-mail não foi reenviado no tempo esperado');

  const logs = docker('logs', 'notificacao', '--since', '10m');
  const mostrar = ['falha ao enviar e-mail, tentando novamente', 'falha ao enviar e-mail"', 'notificações reenviadas', 'e-mail enviado'];
  console.log('\nlogs da Notificação sobre o pedido:');
  for (const linha of logs.split('\n')) {
    if (!mostrar.some((m) => linha.includes(m))) continue;
    try { const j = JSON.parse(linha); if (j.idPedido === idPedido || j.reenviadas !== undefined || j.tentativa !== undefined) console.log(`  ${j.time?.slice(11, 19)} ${j.msg}${j.idPedido ? ` [idPedido=${j.idPedido} rodadas=${j.rodadas ?? '-'}]` : ''}${j.tentativa ? ` [tentativa=${j.tentativa}]` : ''}${j.reenviadas ? ` [reenviadas=${j.reenviadas}]` : ''}`); } catch { /* linha não JSON */ }
  }
})().catch((erro) => {
  console.error('ERRO:', erro.message);
  process.exit(1);
});
