// Vendas pelo gateway (com Identidade, Catálogo e Notificação reais): carrinho, pedido, estoque, acesso,
// status, corrida pela última unidade e expiração de pedido sem pagamento.
const { criarContexto } = require('./lib');

async function executar() {
  const c = criarContexto('vendas');
  const { ok, req } = c;
  console.log('\n=== Vendas ===');

  let r = await req('GET', '/vendas/health');
  ok(r.s === 200 && r.b.banco === 'ok' && r.b.redis === 'ok', `GET /vendas/health -> ${r.s}`);

  const admin = await c.loginAdmin();
  const srv = c.env.vendas.SERVICE_TOKEN;
  const base = await c.criarCatalogoDeTeste(admin, [
    { nome: 'Produto A', preco: 100.5, estoque: 5 },
    { nome: 'Produto B', preco: 20, estoque: 1 },
    { nome: 'Produto C', preco: 10, estoque: 3 },
  ]);
  const [A, B, C] = base.produtos;
  const c1 = await c.novoCliente('um');
  const c2 = await c.novoCliente('dois');

  // carrinho
  ok((await req('GET', '/vendas/carrinho')).s === 401, 'GET /carrinho sem token -> 401');
  r = await req('GET', '/vendas/carrinho', null, c1.token);
  ok(r.s === 200 && r.b.itens.length === 0 && r.b.total === 0, 'carrinho começa vazio');
  r = await req('POST', '/vendas/carrinho/itens', { idProduto: A.id_produto, quantidade: 2 }, c1.token);
  ok(r.s === 201 && r.b.total === 201, `2x A (100,50) -> total ${r.b.total}`);
  r = await req('POST', '/vendas/carrinho/itens', { idProduto: A.id_produto, quantidade: 1 }, c1.token);
  ok(r.b.itens.length === 1 && r.b.itens[0].quantidade === 3, 'adicionar A de novo soma a quantidade');
  ok((await req('POST', '/vendas/carrinho/itens', { idProduto: A.id_produto, quantidade: 50 }, c1.token)).s === 409, 'acima do estoque -> 409');
  ok((await req('POST', '/vendas/carrinho/itens', { idProduto: 99999999, quantidade: 1 }, c1.token)).s === 404, 'produto inexistente -> 404');
  r = await req('POST', '/vendas/carrinho/itens', { idProduto: B.id_produto, quantidade: 1 }, c1.token);
  const idItemA = r.b.itens.find((i) => i.id_produto === A.id_produto).id_item_carrinho;
  const idItemB = r.b.itens.find((i) => i.id_produto === B.id_produto).id_item_carrinho;
  ok(r.b.total === 321.5, `carrinho com A(3) e B(1) -> total ${r.b.total}`);
  r = await req('PATCH', `/vendas/carrinho/itens/${idItemA}`, { quantidade: 2 }, c1.token); ok(r.b.total === 221, 'PATCH A para 2');
  ok((await req('PATCH', `/vendas/carrinho/itens/${idItemA}`, { quantidade: 2 }, c2.token)).s === 404, 'item de outro cliente -> 404');
  ok((await req('DELETE', `/vendas/carrinho/itens/${idItemB}`, null, c1.token)).s === 204, 'DELETE do item B');
  r = await req('POST', '/vendas/carrinho/itens', { idProduto: B.id_produto, quantidade: 1 }, c1.token); ok(r.b.itens.length === 2, 'B de volta ao carrinho');

  // pedido
  ok((await req('POST', '/vendas/pedidos', { idEndereco: c2.idEndereco }, c1.token)).s === 422, 'endereço de outro usuário -> 422');
  r = await req('POST', '/vendas/pedidos', { idEndereco: c1.idEndereco }, c1.token);
  const pedido = r.b;
  ok(r.s === 201 && pedido.status === 'AGUARDANDO_PAGAMENTO' && pedido.valor_total === 221, `POST /pedidos -> ${r.s} total ${pedido.valor_total}`);
  ok(pedido.itens.length === 2 && pedido.endereco?.cidade === 'Cascavel' && pedido.cliente?.email === c1.email, 'pedido traz itens, endereço e cliente');
  ok(!JSON.stringify(pedido).includes('529982'), 'resposta sem CPF');
  const expira = Date.parse(pedido.expira_em);
  ok(expira > Date.now() && expira < Date.now() + 24 * 3600_000, `pedido informa quando expira (${pedido.expira_em})`);
  ok((await c.estoqueDe(A)) === 3 && (await c.estoqueDe(B)) === 0, 'estoque do Catálogo baixou (A 5->3, B 1->0)');
  ok((await req('GET', '/vendas/carrinho', null, c1.token)).b.itens.length === 0, 'carrinho antigo encerrado');
  ok((await req('POST', '/vendas/pedidos', { idEndereco: c1.idEndereco }, c1.token)).s === 422, 'carrinho vazio -> 422');

  // acesso
  r = await req('GET', '/vendas/pedidos', null, c1.token); ok(r.b.total === 1, 'lista os pedidos do dono');
  ok((await req('GET', '/vendas/pedidos', null, c2.token)).b.total === 0, 'cliente 2 não vê pedidos do cliente 1');
  ok((await req('GET', `/vendas/pedidos/${pedido.id_pedido}`, null, c2.token)).s === 403, 'pedido de outro cliente -> 403');
  ok((await req('GET', `/vendas/pedidos/${pedido.id_pedido}`, null, admin)).s === 200, 'admin vê qualquer pedido');
  ok((await req('GET', '/vendas/pedidos?todos=true', null, c1.token)).s === 403, 'todos=true sem permissão -> 403');
  r = await req('GET', '/vendas/pedidos?todos=true&status=AGUARDANDO_PAGAMENTO', null, admin);
  ok(r.s === 200 && r.b.dados.some((p) => p.id_pedido === pedido.id_pedido), 'admin lista todos filtrando por status');

  // e-mail pelo evento pedido.criado
  const logs = await c.aguardar(async () => {
    const l = await req('GET', `/notificacao/logs/${pedido.id_pedido}`, null, admin);
    return l.s === 200 && l.b.every((x) => x.status !== 'PENDENTE') ? l.b : null;
  });
  ok(logs && logs.length === 1 && logs[0].tipo === 'PEDIDO_CRIADO' && logs[0].status === 'ENVIADO', `evento pedido.criado virou e-mail: ${JSON.stringify(logs?.map((x) => `${x.tipo}:${x.status}`))}`);

  // status
  const status = (id, s, token) => req('PATCH', `/vendas/pedidos/${id}/status`, { status: s }, token);
  ok((await status(pedido.id_pedido, 'PAGO')).s === 401, 'PATCH status sem credencial -> 401');
  ok((await status(pedido.id_pedido, 'PAGO', c1.token)).s === 403, 'cliente comum não muda status -> 403');
  r = await status(pedido.id_pedido, 'PAGO', srv);
  ok(r.s === 200 && r.b.status === 'PAGO' && r.b.expira_em === null && r.b.cliente?.email === c1.email, 'token de serviço: PAGO, sem expiração, devolve o cliente');
  ok((await status(pedido.id_pedido, 'PAGO', srv)).s === 200, 'repetir PAGO é idempotente');
  ok((await status(pedido.id_pedido, 'ENTREGUE', srv)).s === 409, 'PAGO -> ENTREGUE direto -> 409');
  ok((await status(pedido.id_pedido, 'CANCELADO', admin)).s === 200, 'admin cancela o pedido');
  ok((await c.estoqueDe(A)) === 5 && (await c.estoqueDe(B)) === 1, 'cancelar devolveu o estoque (A 5, B 1)');
  ok((await status(pedido.id_pedido, 'PAGO', srv)).s === 409, 'cancelado não volta a PAGO -> 409');

  // corrida pela última unidade de B
  for (const cl of [c1, c2]) await req('POST', '/vendas/carrinho/itens', { idProduto: B.id_produto, quantidade: 1 }, cl.token);
  const corrida = await Promise.all([c1, c2].map((cl) => req('POST', '/vendas/pedidos', { idEndereco: cl.idEndereco }, cl.token)));
  const criados = corrida.filter((x) => x.s === 201).length;
  const recusados = corrida.filter((x) => x.s === 409).length;
  ok(criados === 1 && recusados === 1 && (await c.estoqueDe(B)) === 0, `2 clientes disputando a última unidade -> ${criados} pedido, ${recusados} recusado`);

  // expiração: o pedido que ficou aguardando pagamento é cancelado e devolve o estoque
  const vencedor = corrida.find((x) => x.s === 201).b;
  c.sql('vendas', `UPDATE pedido SET data = NOW() - INTERVAL 2 HOUR WHERE id_pedido = ${vencedor.id_pedido}`);
  const dono = corrida.findIndex((x) => x.s === 201) === 0 ? c1 : c2;
  const aposExpirar = await c.aguardar(
    async () => {
      const x = await req('GET', `/vendas/pedidos/${vencedor.id_pedido}`, null, dono.token);
      return x.b?.status === 'CANCELADO' ? x : null;
    },
    { tentativas: 14, intervaloMs: 8000 }
  );
  ok(aposExpirar?.b?.status === 'CANCELADO', 'pedido vencido sem pagamento foi cancelado pela rotina de expiração');
  ok((await c.estoqueDe(B)) === 1, 'a expiração devolveu o estoque ao Catálogo (B 1)');

  // estoque insuficiente com mais de um item e compensação
  await req('POST', '/vendas/carrinho/itens', { idProduto: C.id_produto, quantidade: 3 }, c1.token);
  await req('POST', '/vendas/carrinho/itens', { idProduto: B.id_produto, quantidade: 1 }, c1.token);
  await req('PATCH', `/catalogo/produtos/${B.id_produto}`, { estoque: 0 }, admin);
  r = await req('POST', '/vendas/pedidos', { idEndereco: c1.idEndereco }, c1.token);
  ok(r.s === 409 && (await c.estoqueDe(C)) === 3, `item sem estoque recusa o pedido sem prender o estoque dos outros (C continua 3) -> ${r.s}`);

  return c.resultado;
}

module.exports = { executar };
if (require.main === module) {
  executar()
    .then((r) => {
      console.log(r.falhas === 0 ? '\nVendas: TUDO OK' : `\nVendas: ${r.falhas} FALHA(S)`);
      process.exit(r.falhas === 0 ? 0 : 1);
    })
    .catch((e) => { console.error('ERRO NO TESTE', e); process.exit(1); });
}
