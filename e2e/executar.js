/* eslint-disable no-console */
// Roda os testes ponta a ponta contra o ambiente que está no ar (docker compose up -d).
//   node e2e/executar.js              roda tudo
//   node e2e/executar.js vendas       roda só o Vendas (também: catalogo, pagamento)
const cenarios = {
  catalogo: () => require('./catalogo').executar(),
  vendas: () => require('./vendas').executar(),
  pagamento: () => require('./pagamento').executar(),
};

(async () => {
  const pedidos = process.argv.slice(2);
  const nomes = pedidos.length > 0 ? pedidos : Object.keys(cenarios);
  const invalidos = nomes.filter((n) => !cenarios[n]);
  if (invalidos.length > 0) {
    console.error(`Cenário desconhecido: ${invalidos.join(', ')}. Use: ${Object.keys(cenarios).join(', ')}`);
    process.exit(2);
  }

  let total = 0;
  let falhas = 0;
  for (const nome of nomes) {
    const r = await cenarios[nome]();
    total += r.total;
    falhas += r.falhas;
  }
  console.log(`\n${falhas === 0 ? 'TUDO OK' : `${falhas} FALHA(S)`} — ${total - falhas}/${total} verificações`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch((erro) => {
  console.error('ERRO NO TESTE', erro);
  process.exit(1);
});
