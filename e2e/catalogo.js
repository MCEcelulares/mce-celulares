// Catálogo pelo gateway: cadastro, filtros, cache, estoque, imagens, visão do painel e inativação.
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
  const { ok, req, run } = c;
  console.log('\n=== Catálogo ===');

  let r = await req('GET', '/catalogo/health');
  ok(r.s === 200 && r.b.banco === 'ok' && r.b.redis === 'ok', `GET /catalogo/health -> ${r.s}`);

  const admin = await c.loginAdmin();
  const srv = { Authorization: `Bearer ${c.env.catalogo.SERVICE_TOKEN}` };

  ok((await req('POST', '/catalogo/categorias', { nome: 'X' })).s === 401, 'POST /categorias sem token -> 401');
  const base = await c.criarCatalogoDeTeste(admin, [
    { nome: 'iPhone', preco: 4999.9, estoque: 5, destaque: true, peso: 0.171 },
    { nome: 'Galaxy', preco: 3999.9, estoque: 0 },
    { nome: 'Capa', preco: 49.9, estoque: 100 },
  ]);
  const [iphone, galaxy, capa] = base.produtos;
  ok(iphone.preco === 4999.9 && iphone.peso === 0.171 && iphone.marca?.id_marca === base.marca, 'resposta com preço/peso numéricos e marca/categoria aninhadas');
  ok((await req('POST', '/catalogo/produtos', { id_marca: 999999, id_categoria: base.categoria, nome: 'Fantasma', preco: 10 }, admin)).s === 400, 'marca inexistente -> 400');

  const L = (q) => req('GET', `/catalogo/produtos?marca=${base.marca}&${q}`);
  r = await L(''); ok(r.s === 200 && r.b.total === 3, `lista da marca -> ${r.b.total}`);
  r = await L('busca=iphone'); ok(r.b.total === 1 && r.b.dados[0].id_produto === iphone.id_produto, 'busca=iphone (sem diferenciar maiúsculas)');
  r = await L('precoMax=100'); ok(r.b.total === 1 && r.b.dados[0].id_produto === capa.id_produto, 'precoMax=100');
  r = await L('disponivel=true'); ok(r.b.total === 2 && !r.b.dados.some((p) => p.id_produto === galaxy.id_produto), 'disponivel=true exclui o sem estoque');
  r = await L('ordenar=preco_asc'); ok(r.b.dados.map((p) => p.id_produto).join() === [capa, galaxy, iphone].map((p) => p.id_produto).join(), 'ordenar=preco_asc');
  r = await L('limite=2&pagina=2&ordenar=preco_asc'); ok(r.b.dados.length === 1 && r.b.total === 3, 'paginação');
  r = await L('precoMin=500&precoMax=100'); ok(r.s === 400, 'precoMin > precoMax -> 400');
  r = await req('GET', '/catalogo/produtos/destaque'); ok(r.b.some((p) => p.id_produto === iphone.id_produto), 'destaque');
  r = await req('GET', '/catalogo/produtos/recentes?limite=3'); ok(r.b.length === 3 && r.b[0].id_produto === capa.id_produto, 'recentes');

  // cache no Redis real
  r = await req('GET', `/catalogo/produtos/${iphone.id_produto}`);
  ok(r.s === 200 && c.redisGet(`produto:${iphone.id_produto}`).includes(`iPhone ${run}`), 'detalhe grava produto:{id} no Redis');
  r = await req('PATCH', `/catalogo/produtos/${iphone.id_produto}`, { preco: 4599.9 }, admin);
  ok(r.s === 200 && r.b.preco === 4599.9 && c.redisGet(`produto:${iphone.id_produto}`) === '', 'PATCH atualiza e apaga o cache');
  ok((await req('PATCH', `/catalogo/produtos/${iphone.id_produto}`, { preco: 1 })).s === 401, 'PATCH sem token -> 401');

  // estoque (token de serviço)
  const baixa = (id, q) => req('POST', `/catalogo/produtos/${id}/estoque/baixa`, { quantidade: q }, null, { headers: srv });
  ok((await req('POST', `/catalogo/produtos/${iphone.id_produto}/estoque/baixa`, { quantidade: 1 }, admin)).s === 401, 'baixa com JWT de admin -> 401');
  r = await baixa(iphone.id_produto, 2); ok(r.s === 200 && r.b.estoque === 3, `baixa 2 de 5 -> ${r.b?.estoque}`);
  ok((await baixa(iphone.id_produto, 10)).s === 409, 'baixa acima do estoque -> 409');
  const paralelas = await Promise.all(Array.from({ length: 6 }, () => baixa(iphone.id_produto, 1)));
  const sucessos = paralelas.filter((p) => p.s === 200).length;
  ok(sucessos === 3 && (await c.estoqueDe(iphone)) === 0, `6 baixas simultâneas com 3 em estoque -> ${sucessos} ok, estoque final ${await c.estoqueDe(iphone)}`);
  r = await req('POST', `/catalogo/produtos/${iphone.id_produto}/estoque/reposicao`, { quantidade: 5 }, null, { headers: srv });
  ok(r.s === 200 && r.b.estoque === 5, 'reposição devolve o estoque');

  // imagens (RF15, RNF07)
  const enviar = (id, form, token = admin) => req('POST', `/catalogo/produtos/${id}/imagem`, form, token);
  r = await enviar(capa.id_produto, formulario(PNG_1X1), null);
  ok(r.s === 401, 'upload sem token -> 401');
  const cliente = await c.novoCliente('catalogo');
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
  const trocada = await enviar(capa.id_produto, formulario(PNG_1X1));
  ok(trocada.s === 200 && trocada.b.imagem !== urlImagem, 'nova imagem substitui a anterior');
  ok((await req('GET', urlImagem)).s === 404, 'arquivo da imagem anterior foi removido');
  ok((await req('GET', '/catalogo/imagens/..%2F..%2Fpackage.json')).s === 404, 'caminho com ../ não sai da pasta de imagens');

  // inativação e visão do painel
  r = await req('PATCH', `/catalogo/produtos/${galaxy.id_produto}`, { ativo: false }, admin); ok(r.s === 200 && r.b.ativo === false, 'PATCH ativo=false');
  ok((await req('GET', `/catalogo/produtos/${galaxy.id_produto}`)).s === 404, 'inativo some do detalhe público');
  r = await L(''); ok(r.b.total === 2, 'inativo some da listagem pública');
  ok((await req('GET', `/catalogo/produtos?marca=${base.marca}&incluirInativos=true`)).s === 401, 'incluirInativos sem token -> 401');
  ok((await req('GET', `/catalogo/produtos?marca=${base.marca}&incluirInativos=true`, null, cliente.token)).s === 403, 'incluirInativos sem permissão -> 403');
  r = await req('GET', `/catalogo/produtos?marca=${base.marca}&incluirInativos=true`, null, admin);
  ok(r.s === 200 && r.b.total === 3 && r.b.dados.some((p) => p.id_produto === galaxy.id_produto && p.ativo === false), 'painel enxerga o produto inativo');
  r = await req('GET', `/catalogo/produtos/${galaxy.id_produto}?incluirInativos=true`, null, admin); ok(r.s === 200 && r.b.ativo === false, 'detalhe do inativo no painel');
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
