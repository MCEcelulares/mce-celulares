// Pagamento pelo gateway (gateway SIMULADO: GATEWAY_PAGAMENTO=simulado no pagamento-service/.env).
// Para o Mercado Pago real use o roteiro do pagamento-service/README.md.
const { criarContexto } = require('./lib');

async function executar() {
  const c = criarContexto('pagamento');
  const { ok, req } = c;
  console.log('\n=== Pagamento ===');

  let r = await req('GET', '/pagamento/health');
  ok(r.s === 200 && r.b.banco === 'ok' && r.b.redis === 'ok', `GET /pagamento/health -> ${r.s}`);

  const admin = await c.loginAdmin();
  const base = await c.criarCatalogoDeTeste(admin, [{ nome: 'Produto Pag', preco: 199.9, estoque: 4 }]);
  const prod = base.produtos[0];
  const c1 = await c.novoCliente('um');
  const c2 = await c.novoCliente('dois');

  await req('POST', '/vendas/carrinho/itens', { idProduto: prod.id_produto, quantidade: 2 }, c1.token);
  r = await req('POST', '/vendas/pedidos', { idEndereco: c1.idEndereco }, c1.token);
  const pedido = r.b;
  ok(r.s === 201 && pedido.valor_total === 399.8, `pedido criado: total ${pedido.valor_total}`);

  const pagar = (corpo, token) => req('POST', '/pagamento/pagamentos', corpo, token);
  const corpo = { idPedido: pedido.id_pedido, metodoPagamento: 'pix', valor: 399.8 };
  ok((await pagar(corpo)).s === 401, 'POST /pagamentos sem token -> 401');
  ok((await pagar({ ...corpo, valor: 100 }, c1.token)).s === 422, 'valor diferente do pedido -> 422');
  ok((await pagar(corpo, c2.token)).s === 403, 'pedido de outro cliente -> 403');
  ok((await pagar({ ...corpo, idPedido: 99999999 }, c1.token)).s === 404, 'pedido inexistente -> 404');
  ok((await req('GET', `/vendas/pedidos/${pedido.id_pedido}`, null, c1.token)).b.status === 'AGUARDANDO_PAGAMENTO', 'tentativas inválidas não mudaram o pedido');

  r = await pagar(corpo, c1.token);
  ok(r.s === 201 && r.b.status === 'APROVADO' && r.b.metodo_pagamento === 'PIX' && r.b.valor === 399.8, `pagamento registrado -> ${r.s} ${r.b?.status}`);
  ok((await req('GET', `/vendas/pedidos/${pedido.id_pedido}`, null, c1.token)).b.status === 'PAGO', 'pedido ficou PAGO no Vendas');

  r = await req('GET', `/pagamento/pagamentos/${pedido.id_pedido}`, null, c1.token);
  ok(r.s === 200 && r.b.status === 'APROVADO' && r.b.data_pagamento && !('id_externo' in r.b) && !('id_usuario' in r.b), 'consulta do dono, sem dados internos');
  ok((await req('GET', `/pagamento/pagamentos/${pedido.id_pedido}`, null, c2.token)).s === 403, 'outro cliente -> 403');
  ok((await req('GET', `/pagamento/pagamentos/${pedido.id_pedido}`, null, admin)).s === 200, 'admin vê o pagamento');
  ok((await req('GET', '/pagamento/pagamentos/99999999', null, c1.token)).s === 404, 'pedido sem pagamento -> 404');
  ok((await pagar(corpo, c1.token)).s === 409, 'pagar de novo um pedido PAGO -> 409');

  // plano B do webhook
  const sincronizar = (token, id = pedido.id_pedido) => req('POST', `/pagamento/pagamentos/${id}/sincronizar`, null, token);
  ok((await sincronizar(null)).s === 401, 'sincronizar sem token -> 401');
  ok((await sincronizar(c2.token)).s === 403, 'sincronizar pedido de outro cliente -> 403');
  r = await sincronizar(c1.token); ok(r.s === 200 && r.b.status === 'APROVADO', 'sincronizar um pagamento já aprovado devolve APROVADO');
  ok((await sincronizar(c1.token, 99999999)).s === 404, 'sincronizar sem pagamento -> 404');

  // webhook: público e que não confia no corpo
  ok((await req('POST', '/pagamento/pagamentos/webhook', { type: 'payment', data: { id: '123' } })).s === 200, 'webhook sem credencial responde 200');
  r = await req('POST', '/pagamento/pagamentos/webhook', { type: 'merchant_order', data: { id: '1' } });
  ok(r.s === 200 && r.b.ignorado === true, 'webhook de outro tipo é ignorado');

  // e-mails: pedido.criado (Vendas) e pagamento.confirmado (Pagamento)
  const logs = await c.aguardar(
    async () => {
      const l = await req('GET', `/notificacao/logs/${pedido.id_pedido}`, null, admin);
      return l.s === 200 && l.b.length === 2 && l.b.every((x) => x.status !== 'PENDENTE') ? l.b : null;
    },
    { tentativas: 14 }
  );
  const tipos = (logs ?? []).map((x) => `${x.tipo}:${x.status}`).sort();
  ok(tipos.join() === 'PAGAMENTO_CONFIRMADO:ENVIADO,PEDIDO_CRIADO:ENVIADO', `e-mails pelo Notificação: ${JSON.stringify(tipos)}`);
  ok((logs ?? []).every((x) => x.destinatario === c1.email), 'enviados para o e-mail do cliente');

  // painel (RF18, RF46, RF47) com este pedido pago
  ok((await req('GET', '/vendas/pedidos/resumo', null, c1.token)).s === 403, 'resumo sem dashboard:ver -> 403');
  r = await req('GET', '/vendas/pedidos/resumo?dias=7', null, admin);
  const hoje = r.b?.receita_por_dia?.find((d) => d.receita >= 399.8);
  ok(r.s === 200 && r.b.pedidos_por_status.PAGO >= 1 && r.b.receita_total >= 399.8 && !!hoje && r.b.pedidos_ultimas_24h >= 1, `resumo do painel -> ${JSON.stringify({ ...r.b, receita_por_dia: `${r.b?.receita_por_dia?.length} dia(s)` })}`);
  r = await req('GET', '/vendas/pedidos/mais-vendidos?limite=50', null, admin);
  const item = r.b?.find?.((p) => p.id_produto === prod.id_produto);
  ok(r.s === 200 && item?.quantidade_vendida === 2 && item?.receita === 399.8, `mais vendidos inclui o produto (${JSON.stringify(item)})`);

  // cancelar um pedido pago devolve o estoque
  ok((await req('PATCH', `/vendas/pedidos/${pedido.id_pedido}/status`, { status: 'CANCELADO' }, admin)).s === 200, 'admin cancela o pedido pago');
  ok((await c.estoqueDe(prod)) === 4, 'estoque devolvido ao Catálogo');
  r = await req('GET', '/vendas/pedidos/mais-vendidos?limite=50', null, admin);
  ok(!r.b.some((p) => p.id_produto === prod.id_produto), 'pedido cancelado deixa de contar nos mais vendidos');

  return c.resultado;
}

module.exports = { executar };
if (require.main === module) {
  executar()
    .then((r) => {
      console.log(r.falhas === 0 ? '\nPagamento: TUDO OK' : `\nPagamento: ${r.falhas} FALHA(S)`);
      process.exit(r.falhas === 0 ? 0 : 1);
    })
    .catch((e) => { console.error('ERRO NO TESTE', e); process.exit(1); });
}
