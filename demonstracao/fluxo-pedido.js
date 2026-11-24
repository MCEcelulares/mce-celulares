/* eslint-disable no-console */
const { criarContexto } = require('../e2e/lib');

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

(async () => {
  const c = criarContexto('demo');
  const admin = await c.loginAdmin();
  const base = await c.criarCatalogoDeTeste(admin, [{ nome: 'Produto Demo', preco: 100, estoque: 3 }]);
  const cliente = await c.novoCliente('demo');

  await c.req('POST', '/vendas/carrinho/itens', { idProduto: base.produtos[0].id_produto, quantidade: 1 }, cliente.token);

  const idCorrelacao = process.env.ID_CORRELACAO ?? `demo-${Date.now()}`;
  const chamar = async (caminho, corpo) => {
    const resposta = await fetch(`${BASE}${caminho}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cliente.token}`, 'x-correlation-id': idCorrelacao },
      body: JSON.stringify(corpo),
    });
    return { s: resposta.status, b: await resposta.json() };
  };

  let r = await chamar('/vendas/pedidos', { idEndereco: cliente.idEndereco });
  console.log(`POST /vendas/pedidos -> ${r.s}, pedido #${r.b.id_pedido}`);
  const idPedido = r.b.id_pedido;

  r = await chamar('/pagamento/pagamentos', { idPedido, metodoPagamento: 'pix', valor: 100 });
  console.log(`POST /pagamento/pagamentos -> ${r.s}, status ${r.b.status}`);
  console.log(`ID_PEDIDO=${idPedido}`);
  console.log(`ID_CORRELACAO=${idCorrelacao}`);
})().catch((erro) => {
  console.error('ERRO:', erro.message);
  process.exit(1);
});
