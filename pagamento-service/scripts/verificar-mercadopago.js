/* eslint-disable no-console */
// Confere se o MERCADOPAGO_ACCESS_TOKEN do .env funciona, SEM cobrar nem mover dinheiro:
//   1) cria uma preferência de teste (R$ 1,00) e mostra o link de pagamento;
//   2) consulta pagamentos por external_reference (o que a sincronização usa).
// Uso: npm run mp:verificar   (a partir de pagamento-service/, com o token no .env)
require('dotenv/config');

const BASE = 'https://api.mercadopago.com';
const token = process.env.MERCADOPAGO_ACCESS_TOKEN;

function sair(mensagem) {
  console.error(`\n✖ ${mensagem}`);
  process.exit(1);
}

async function chamar(caminho, opcoes = {}) {
  const resposta = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  let corpo = null;
  try {
    corpo = await resposta.json();
  } catch {
    corpo = null;
  }
  return { status: resposta.status, corpo };
}

(async () => {
  if (!token) {
    sair(
      'MERCADOPAGO_ACCESS_TOKEN está vazio em pagamento-service/.env.\n' +
        '  Use o Access Token de TESTE do vendedor de teste (painel de desenvolvedores do Mercado Pago > Suas integrações).'
    );
  }

  const referencia = `verificacao-${Date.now()}`;
  console.log('1/2 Criando preferência de teste (R$ 1,00, sem cobrança)...');
  const preferencia = await chamar('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ id: 'teste', title: 'Teste de integração MCE Celulares', quantity: 1, currency_id: 'BRL', unit_price: 1 }],
      external_reference: referencia,
    }),
  });

  if (preferencia.status === 401 || preferencia.status === 403) {
    sair(
      `O Mercado Pago recusou o token (HTTP ${preferencia.status}). Confira se é o Access Token (não a Public Key), ` +
        'se não expirou e se veio da mesma conta de vendedor da aplicação.'
    );
  }
  if ((preferencia.status !== 200 && preferencia.status !== 201) || !preferencia.corpo?.id) {
    sair(`Resposta inesperada ao criar a preferência (HTTP ${preferencia.status}): ${JSON.stringify(preferencia.corpo)}`);
  }
  console.log(`   ✔ preferência criada: ${preferencia.corpo.id}`);
  console.log(`   Link de pagamento: ${preferencia.corpo.init_point ?? preferencia.corpo.sandbox_init_point ?? '(não retornado)'}`);

  console.log('2/2 Consultando pagamentos por external_reference...');
  const busca = await chamar(`/v1/payments/search?external_reference=${encodeURIComponent(referencia)}&sort=date_created&criteria=desc`);
  if (busca.status !== 200) {
    sair(`A busca de pagamentos respondeu HTTP ${busca.status}: ${JSON.stringify(busca.corpo)}`);
  }
  console.log(`   ✔ busca funcionando (${busca.corpo?.results?.length ?? 0} pagamentos, esperado 0)`);

  console.log('\nTudo certo com o token. Próximos passos:');
  console.log('  - GATEWAY_PAGAMENTO=mercadopago no .env e reinicie o serviço pagamento;');
  console.log('  - para receber o webhook, exponha o gateway (ex.: ngrok http 8080) e preencha PUBLIC_BASE_URL;');
  console.log('  - sem webhook, use POST /pagamento/pagamentos/{idPedido}/sincronizar depois de pagar.');
  console.log('  Detalhes e cartões de teste: pagamento-service/README.md');
})().catch((erro) => sair(`Falha de rede ao falar com o Mercado Pago: ${erro.message}`));
