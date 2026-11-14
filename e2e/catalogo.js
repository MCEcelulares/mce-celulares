// Catálogo pelo gateway: cadastro, filtros, estoque do painel, reservas por pedido (rotas internas), imagens,
// visão do painel e inativação.
const { criarContexto } = require('./lib');

// PNG 1x1 válido (a assinatura de 8 bytes é o que o serviço confere).
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

function formulario(conteudo, nome = 'foto.png', tipo = 'image/png', campo = 'imagem') {
  const form = new FormData();
  form.append(campo, new Blob([conteudo], { type: tipo }), nome);
  return form;
}

async function executar() {
  const c = criarContexto('catalogo');
  const { ok, req, run, interno } = c;
  console.log('\n=== Catálogo ===');

  let r = await req('GET', '/catalogo/health');
  ok(r.s === 200 && r.b.banco === 'ok' && r.b.redis === 'ok', `GET /catalogo/health -> ${r.s}`);

  const admin = await c.loginAdmin();

  ok((await req('POST', '/catalogo/categorias', { nome: 'X' })).s === 401, 'POST /categorias sem token -> 401');
  const base = await c.criarCatalogoDeTeste(admin, [
    { nome: 'iPhone', preco: 4999.9, estoque: 5, destaque: true, peso: 0.171 },
    { nome: 'Galaxy', preco: 3999.9, estoque: 0 },
    { nome: 'Capa', preco: 49.9, estoque: 100 },
  ]);
  const [iphone, galaxy, capa] = base.produtos;
  ok(iphone.preco === 4999.9 && iphone.marca?.id_marca === base.marca, 'resposta com preço numérico e marca aninhada');
  ok((await req('POST', '/catalogo/produtos', { id_marca: 999999, id_categoria: base.categoria, nome: 'Fantasma', preco: 10 }, admin)).s === 400, 'marca inexistente -> 400');

  // listagem: { dados, paginacao: { pagina, limite, total, totalPaginas } }
  const L = (q) => req('GET', `/catalogo/produtos?marca=${base.marca}&${q}`);
  r = await L('');
  ok(r.s === 200 && r.b.paginacao?.total === 3 && r.b.dados.length === 3, `lista da marca -> ${r.b.paginacao?.total}`);
  r = await L('busca=iphone'); ok(r.b.paginacao?.total === 1 && r.b.dados[0].id_produto === iphone.id_produto, 'busca=iphone (sem diferenciar maiúsculas)');
  r = await L('precoMax=100'); ok(r.b.paginacao?.total === 1 && r.b.dados[0].id_produto === capa.id_produto, 'precoMax=100');
  r = await L('disponivel=true'); ok(r.b.paginacao?.total === 2 && !r.b.dados.some((p) => p.id_produto === galaxy.id_produto), 'disponivel=true exclui o sem estoque');
  r = await L('ordenar=preco_asc'); ok(r.b.dados.map((p) => p.id_produto).join() === [capa, galaxy, iphone].map((p) => p.id_produto).join(), 'ordenar=preco_asc');
  r = await L('limite=2&pagina=2&ordenar=preco_asc'); ok(r.b.dados.length === 1 && r.b.paginacao?.total === 3 && r.b.paginacao?.totalPaginas === 2, 'paginação');
  r = await L('precoMin=500&precoMax=100'); ok(r.s === 400, 'precoMin > precoMax -> 400');
  r = await req('GET', '/catalogo/produtos/destaque'); ok(r.b.some((p) => p.id_produto === iphone.id_produto), 'destaque');
  r = await req('GET', '/catalogo/produtos/recentes?limite=3'); ok(r.b.length === 3 && r.b[0].id_produto === capa.id_produto, 'recentes');

  r = await req('PATCH', `/catalogo/produtos/${iphone.id_produto}`, { preco: 4599.9 }, admin);
  ok(r.s === 200 && r.b.preco === 4599.9, 'PATCH atualiza o preço');
  ok((await req('GET', `/catalogo/produtos/${iphone.id_produto}`)).b.preco === 4599.9, 'detalhe público reflete o novo preço');
  ok((await req('PATCH', `/catalogo/produtos/${iphone.id_produto}`, { preco: 1 })).s === 401, 'PATCH sem token -> 401');

  // ajuste de estoque pelo painel (RF10)
  const ajustar = (ajuste, token = admin) => req('PATCH', `/catalogo/produtos/${iphone.id_produto}/estoque`, { ajuste }, token);
  const cliente = await c.novoCliente('catalogo');
  ok((await ajustar(1, null)).s === 401, 'ajuste de estoque sem token -> 401');
  ok((await ajustar(1, cliente.token)).s === 403, 'ajuste de estoque sem catalogo:gerenciar -> 403');
  r = await ajustar(2); ok(r.s === 200 && r.b.estoque === 7, `ajuste +2 -> estoque ${r.b?.estoque}`);
  r = await ajustar(-100); ok(r.s === 409 && (await c.estoqueDe(iphone)) === 7, 'ajuste que deixaria negativo -> 409, estoque intacto');
  r = await ajustar(-2); ok(r.s === 200 && r.b.estoque === 5, 'ajuste -2 volta ao estoque inicial (5)');

  // rotas internas: bloqueadas no gateway; só o Vendas (token de serviço) chega nelas
  ok((await req('GET', `/catalogo/interno/produtos?ids=${iphone.id_produto}`)).s === 404, 'gateway bloqueia /catalogo/interno/ (GET) -> 404');
  ok((await req('POST', '/catalogo/interno/reservas', { id_pedido: 1, itens: [] }, admin)).s === 404, 'gateway bloqueia /catalogo/interno/ (POST, mesmo com JWT de admin) -> 404');
  ok(interno('GET', `/interno/produtos?ids=${iphone.id_produto}`, null, 'sem').s === 401, 'rota interna sem token de serviço -> 401');
  ok(interno('GET', `/interno/produtos?ids=${iphone.id_produto}`, null, 'errado').s === 401, 'rota interna com token de serviço errado -> 401');
  r = interno('GET', `/interno/produtos?ids=${iphone.id_produto},${capa.id_produto}`);
  ok(r.s === 200 && r.b.length === 2 && r.b.find((p) => p.id_produto === iphone.id_produto)?.estoque === 5, 'GET /interno/produtos devolve nome, preço e estoque');
  ok(interno('GET', '/interno/produtos').s === 400, 'GET /interno/produtos sem ids -> 400');

  // reservas por pedido (ADR-009): tudo ou nada, idempotente por pedido
  const idPedido = 900000 + (parseInt(run, 36) % 90000) * 10;
  const itens = [{ id_produto: iphone.id_produto, quantidade: 2 }, { id_produto: capa.id_produto, quantidade: 1 }];
  const reservar = (id, lista) => interno('POST', '/interno/reservas', { id_pedido: id, itens: lista });
  ok(reservar(idPedido, []).s === 400, 'reserva sem itens -> 400');
  ok(reservar(idPedido, [{ id_produto: 99999999, quantidade: 1 }]).s === 404, 'reserva de produto inexistente -> 404');
  r = reservar(idPedido, [{ id_produto: capa.id_produto, quantidade: 1 }, { id_produto: iphone.id_produto, quantidade: 9 }]);
  ok(
    r.s === 409 && r.b.erro === 'Estoque insuficiente' && r.b.detalhes?.[0]?.id_produto === iphone.id_produto && r.b.detalhes[0].disponivel === 5,
    'falta de estoque -> 409 com as faltas em "detalhes"'
  );
  ok((await c.estoqueDe(capa)) === 100 && (await c.estoqueDe(iphone)) === 5, 'tudo ou nada: a recusa não baixou nenhum item');
  r = reservar(idPedido, itens);
  ok(r.s === 201 && r.b.status === 'ATIVA' && (await c.estoqueDe(iphone)) === 3 && (await c.estoqueDe(capa)) === 99, 'reserva criada -> 201, estoque baixou (iPhone 5->3, Capa 100->99)');
  r = reservar(idPedido, itens);
  ok(r.s === 200 && (await c.estoqueDe(iphone)) === 3, 'reserva repetida para o mesmo pedido -> 200, sem baixar de novo');
  ok(reservar(idPedido, [{ id_produto: iphone.id_produto, quantidade: 1 }]).s === 409, 'reserva diferente para o mesmo pedido -> 409');
  r = interno('GET', `/interno/reservas/${idPedido}`);
  ok(r.s === 200 && r.b.status === 'ATIVA' && r.b.itens.length === 2, 'GET /interno/reservas/:idPedido');
  ok(interno('GET', '/interno/reservas/999999999').s === 404, 'consulta de reserva inexistente -> 404');
  r = interno('POST', `/interno/reservas/${idPedido}/devolucao`);
  ok(r.s === 200 && r.b.status === 'DEVOLVIDA' && (await c.estoqueDe(iphone)) === 5 && (await c.estoqueDe(capa)) === 100, 'devolução -> 200, estoque volta ao original');
  r = interno('POST', `/interno/reservas/${idPedido}/devolucao`);
  ok(r.s === 200 && (await c.estoqueDe(iphone)) === 5, 'devolução repetida -> 200, sem devolver em dobro (sem estoque fantasma)');
  ok(reservar(idPedido, itens).s === 409, 'reservar de novo um pedido já devolvido -> 409');
  ok(interno('POST', '/interno/reservas/999999998/devolucao').s === 404, 'devolução sem reserva -> 404 (o Vendas aceita como "nada a devolver")');

  // disputa: 6 pedidos querem 1 unidade cada do iPhone, que tem 5; ajusta para 3 e confere que só 3 vencem
  await ajustar(-2);
  const disputa = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      c.internoAssincrono('POST', '/interno/reservas', { id_pedido: idPedido + 100 + i, itens: [{ id_produto: iphone.id_produto, quantidade: 1 }] })
    )
  );
  const vencedores = disputa.filter((p) => p.s === 201).length;
  const recusados = disputa.filter((p) => p.s === 409).length;
  ok(vencedores === 3 && recusados === 3 && (await c.estoqueDe(iphone)) === 0, `6 reservas simultâneas com 3 em estoque -> ${vencedores} ok, ${recusados} recusadas, estoque final ${await c.estoqueDe(iphone)}`);
  for (let i = 0; i < 6; i++) interno('POST', `/interno/reservas/${idPedido + 100 + i}/devolucao`);
  ok((await c.estoqueDe(iphone)) === 3, 'devolver as reservas do teste restaura o estoque (3)');

  // imagens (RF15, RNF07)
  const enviar = (id, form, token = admin) => req('POST', `/catalogo/produtos/${id}/imagem`, form, token);
  r = await enviar(capa.id_produto, formulario(PNG_1X1), null);
  ok(r.s === 401, 'upload sem token -> 401');
  ok((await enviar(capa.id_produto, formulario(PNG_1X1), cliente.token)).s === 403, 'upload sem catalogo:gerenciar -> 403');
  r = await enviar(capa.id_produto, formulario(PNG_1X1));
  const urlImagem = r.b?.imagem;
  ok(r.s === 200 && /^\/catalogo\/imagens\/[0-9a-f-]{36}\.png$/.test(urlImagem ?? ''), `upload de PNG -> ${r.s} ${urlImagem}`);
  r = await req('GET', urlImagem);
  ok(r.s === 200 && (r.h.get('content-type') ?? '').includes('image/png') && (r.h.get('cache-control') ?? '').includes('immutable'), 'imagem servida pelo gateway com cache');
  ok((await req('GET', `/catalogo/produtos/${capa.id_produto}`)).b.imagem === urlImagem, 'produto passa a apontar para a imagem');
  ok((await enviar(capa.id_produto, formulario(Buffer.from('<?php echo 1; ?>'), 'shell.png', 'image/png'))).s === 415, 'arquivo que finge ser PNG -> 415');
  ok((await enviar(capa.id_produto, formulario(PNG_1X1, 'a.gif', 'image/gif'))).s === 415, 'tipo não aceito -> 415');
  ok((await enviar(capa.id_produto, formulario(Buffer.concat([PNG_1X1, Buffer.alloc(2.5 * 1024 * 1024)])))).s === 413, 'imagem de 2,5 MB -> 413');
  ok((await enviar(capa.id_produto, formulario(PNG_1X1, 'a.png', 'image/png', 'outro'))).s === 400, 'campo errado -> 400');
  const trocada = await req('PUT', `/catalogo/produtos/${capa.id_produto}/imagem`, formulario(PNG_1X1), admin);
  ok(trocada.s === 200 && trocada.b.imagem !== urlImagem, 'PUT com nova imagem substitui a anterior');
  ok((await req('GET', urlImagem)).s === 404, 'arquivo da imagem anterior foi removido');
  ok((await req('GET', '/catalogo/imagens/..%2F..%2Fpackage.json')).s === 404, 'caminho com ../ não sai da pasta de imagens');
  ok((await req('DELETE', `/catalogo/produtos/${capa.id_produto}/imagem`, null, admin)).s === 204, 'DELETE da imagem -> 204');
  ok((await req('GET', trocada.b.imagem)).s === 404 && (await req('GET', `/catalogo/produtos/${capa.id_produto}`)).b.imagem === null, 'imagem removida do produto e do disco');

  // inativação (DELETE inativa) e visão do painel
  ok((await req('DELETE', `/catalogo/produtos/${galaxy.id_produto}`)).s === 401, 'DELETE do produto sem token -> 401');
  ok((await req('DELETE', `/catalogo/produtos/${galaxy.id_produto}`, null, admin)).s === 204, 'DELETE do produto inativa -> 204');
  ok((await req('GET', `/catalogo/produtos/${galaxy.id_produto}`)).s === 404, 'inativo some do detalhe público');
  r = await L(''); ok(r.b.paginacao?.total === 2, 'inativo some da listagem pública');
  ok((await req('GET', `/catalogo/produtos?marca=${base.marca}&incluirInativos=true`)).s === 401, 'incluirInativos sem token -> 401');
  r = await req('GET', `/catalogo/produtos?marca=${base.marca}&incluirInativos=true`, null, cliente.token);
  ok(r.s === 200 && r.b.paginacao.total === 2 && !r.b.dados.some((p) => p.id_produto === galaxy.id_produto), 'incluirInativos com cliente comum: só vê os ativos (não vaza o inativo)');
  ok((await req('GET', `/catalogo/produtos/${galaxy.id_produto}?incluirInativos=true`, null, cliente.token)).s === 403, 'detalhe do inativo com cliente comum -> 403');
  r = await req('GET', `/catalogo/produtos?marca=${base.marca}&incluirInativos=true`, null, admin);
  ok(r.s === 200 && r.b.paginacao.total === 3 && r.b.dados.some((p) => p.id_produto === galaxy.id_produto && p.ativo === false), 'painel enxerga o produto inativo');
  r = await req('GET', `/catalogo/produtos/${galaxy.id_produto}?incluirInativos=true`, null, admin); ok(r.s === 200 && r.b.ativo === false, 'detalhe do inativo no painel');
  ok(interno('POST', '/interno/reservas', { id_pedido: idPedido + 500, itens: [{ id_produto: galaxy.id_produto, quantidade: 1 }] }).s === 409, 'reserva de produto inativo -> 409');
  await req('PATCH', `/catalogo/categorias/${base.categoria}`, { ativo: false }, admin);
  ok(!(await req('GET', '/catalogo/categorias')).b.some((x) => x.id_categoria === base.categoria), 'categoria inativa some da lista pública');
  ok((await req('GET', '/catalogo/categorias?incluirInativos=true', null, admin)).b.some((x) => x.id_categoria === base.categoria), 'categoria inativa aparece no painel');

  // resumo do painel (RF46)
  ok((await req('GET', '/catalogo/produtos/resumo', null, cliente.token)).s === 403, 'resumo sem dashboard:ver -> 403');
  r = await req('GET', '/catalogo/produtos/resumo', null, admin);
  ok(r.s === 200 && r.b.total_produtos >= 3 && r.b.produtos_inativos >= 1 && typeof r.b.valor_em_estoque === 'number', `GET /produtos/resumo -> ${JSON.stringify(r.b)}`);

  return c.resultado;
}

module.exports = { executar };
if (require.main === module) {
  executar()
    .then((r) => {
      console.log(r.falhas === 0 ? '\nCatálogo: TUDO OK' : `\nCatálogo: ${r.falhas} FALHA(S)`);
      process.exit(r.falhas === 0 ? 0 : 1);
    })
    .catch((e) => { console.error('ERRO NO TESTE', e); process.exit(1); });
}
