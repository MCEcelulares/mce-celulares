/* eslint-disable no-console */
// Gera tráfego para alimentar as métricas dos SLOs (leituras do catálogo e pedidos), com o ambiente no ar.
//   node demonstracao/gerar-carga.js                      # 20 pedidos (5 pagos) e 300 leituras
//   PEDIDOS=40 PAGOS=10 LEITURAS=600 node demonstracao/gerar-carga.js
// Cria dados de teste (categoria, marca, produto, um usuário ...@mce.test); nada é apagado.
const { criarContexto } = require('../e2e/lib');

const PEDIDOS = Number(process.env.PEDIDOS ?? 20);
const PAGOS = Math.min(Number(process.env.PAGOS ?? 5), PEDIDOS);
const LEITURAS = Number(process.env.LEITURAS ?? 300);
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

(async () => {
  const c = criarContexto('carga');
  const admin = await c.loginAdmin();
  const base = await c.criarCatalogoDeTeste(admin, [{ nome: 'Produto Carga', preco: 100, estoque: PEDIDOS + 10 }]);
  const produto = base.produtos[0];
  const cliente = await c.novoCliente('carga');

  // Leituras públicas do catálogo: as repetidas (mesma consulta) acertam o cache, e as variações forçam miss.
  let ok = 0;
  const consultas = [`/catalogo/produtos?limite=10`, `/catalogo/produtos/${produto.id_produto}`, `/catalogo/produtos/destaque`];
  const inicio = Date.now();
  for (let i = 0; i < LEITURAS; i++) {
    const caminho = i % 10 === 0 ? `/catalogo/produtos?limite=${5 + (i % 7)}&busca=carga` : consultas[i % consultas.length];
    const r = await fetch(`${BASE}${caminho}`);
    if (r.status === 200) ok++;
  }
  console.log(`leituras: ${ok}/${LEITURAS} com 200 em ${((Date.now() - inicio) / 1000).toFixed(1)} s`);

  // Pedidos: o mesmo cliente monta um carrinho e fecha o pedido várias vezes; os primeiros PAGOS também são pagos.
  let criados = 0;
  let pagos = 0;
  for (let i = 0; i < PEDIDOS; i++) {
    await c.req('POST', '/vendas/carrinho/itens', { idProduto: produto.id_produto, quantidade: 1 }, cliente.token);
    const pedido = await c.req('POST', '/vendas/pedidos', { idEndereco: cliente.idEndereco }, cliente.token);
    if (pedido.s !== 201) { console.log(`pedido ${i + 1}: HTTP ${pedido.s} ${JSON.stringify(pedido.b)}`); continue; }
    criados++;
    if (i < PAGOS) {
      const pg = await c.req('POST', '/pagamento/pagamentos', { idPedido: pedido.b.id_pedido, metodoPagamento: 'pix', valor: 100 }, cliente.token);
      if (pg.s === 201) pagos++;
    }
  }
  console.log(`pedidos: ${criados}/${PEDIDOS} criados, ${pagos}/${PAGOS} pagos`);
})().catch((erro) => {
  console.error('ERRO:', erro.message);
  process.exit(1);
});
