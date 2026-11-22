/* eslint-disable no-console */
// Dispara um fluxo de compra completo para gerar os eventos pedido.criado e pagamento.confirmado.
// Uso (da raiz do repositório, com o ambiente no ar e GATEWAY_PAGAMENTO=simulado):
//   node demonstracao/fluxo-pedido.js
//   ID_CORRELACAO=minha-compra-1 node demonstracao/fluxo-pedido.js   # usa esse x-correlation-id nas duas chamadas
// Cria dados de teste (categoria, marca, produto, usuário e-mail ...@mce.test, pedido e pagamento); nada é apagado.
const { criarContexto } = require('../e2e/lib');

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

(async () => {
  const c = criarContexto('demo');
  const admin = await c.loginAdmin();
  const base = await c.criarCatalogoDeTeste(admin, [{ nome: 'Produto Demo', preco: 100, estoque: 3 }]);
  const cliente = await c.novoCliente('demo');

  await c.req('POST', '/vendas/carrinho/itens', { idProduto: base.produtos[0].id_produto, quantidade: 1 }, cliente.token);

  // As duas chamadas seguintes levam o mesmo x-correlation-id, para o fluxo inteiro ser rastreável (scripts/seguir-id.sh).
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
