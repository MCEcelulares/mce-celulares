/* eslint-disable no-console */
// Utilitários dos testes ponta a ponta. Sem dependências: usa só o Node 20+ (fetch, FormData) e o Docker.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');

// Lê um .env simples (uma linha por variável). Basta para as variáveis usadas aqui; não interpreta chaves multilinha.
function lerEnv(arquivo) {
  const saida = {};
  for (const linha of fs.readFileSync(path.join(RAIZ, arquivo), 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in saida)) saida[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return saida;
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Espera até que a função devolva algo verdadeiro (ou acabe o tempo) e devolve o último valor.
async function aguardar(funcao, { tentativas = 12, intervaloMs = 5000 } = {}) {
  let valor = null;
  for (let i = 0; i < tentativas; i++) {
    valor = await funcao();
    if (valor) return valor;
    await esperar(intervaloMs);
  }
  return valor;
}

// Sem shell (execFileSync): os argumentos chegam ao Docker exatamente como estão, no Windows, Linux ou Mac.
function docker(args) {
  return execFileSync('docker', ['compose', 'exec', '-T', ...args], { cwd: RAIZ, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
}

// Roda um comando SQL no banco de um serviço (dentro do container, usando as variáveis dele).
function sql(servico, comando) {
  const script = 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "' + comando.replace(/"/g, '\\"') + '" "$MYSQL_DATABASE"';
  return docker([servico + '_db', 'sh', '-c', script]);
}

function redisGet(chave) {
  return docker(['redis', 'redis-cli', 'GET', chave]);
}

let tokenAdminEmCache = null;

const DICA_LIMITE_DE_LOGIN =
  'O Identidade bloqueou o login por excesso de tentativas (429). Espere 15 minutos ou, em desenvolvimento, ' +
  'defina RATE_LIMIT_LOGIN_MAX=1000 e RATE_LIMIT_CADASTRO_MAX=1000 no identidade-service/.env e recrie o container.';

function criarContexto(nome) {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
  const run = Date.now().toString(36);
  const resultado = { falhas: 0, total: 0 };

  const ok = (condicao, mensagem) => {
    resultado.total++;
    if (!condicao) resultado.falhas++;
    console.log(`${condicao ? 'OK   ' : 'FALHA'} ${mensagem}`);
  };

  const req = async (metodo, caminho, corpo, token, extras = {}) => {
    const headers = { ...(token && { Authorization: `Bearer ${token}` }), ...extras.headers };
    let body;
    if (corpo instanceof FormData) {
      body = corpo;
    } else if (corpo !== undefined && corpo !== null) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(corpo);
    }
    const resposta = await fetch(base + caminho, { method: metodo, headers, body });
    const tipo = resposta.headers.get('content-type') ?? '';
    let dados = null;
    if (tipo.includes('json')) {
      try {
        dados = await resposta.json();
      } catch {
        dados = null;
      }
    }
    return { s: resposta.status, b: dados, h: resposta.headers };
  };

  const identidade = lerEnv('identidade-service/.env');

  // O Identidade limita o login (padrão 10 por 15 min por IP): reaproveita o do administrador entre os cenários.
  async function loginAdmin() {
    if (tokenAdminEmCache && Date.now() < tokenAdminEmCache.valeAte) return tokenAdminEmCache.token;
    const r = await req('POST', '/identidade/auth/login', { email: identidade.ADMIN_EMAIL, senha: identidade.ADMIN_SENHA });
    if (r.s === 429) throw new Error(DICA_LIMITE_DE_LOGIN);
    if (r.s !== 200) throw new Error(`login do administrador falhou (HTTP ${r.s}). Confira ADMIN_EMAIL/ADMIN_SENHA do identidade-service/.env`);
    tokenAdminEmCache = { token: r.b.token, valeAte: Date.now() + 10 * 60_000 };
    return r.b.token;
  }

  async function novoCliente(tag) {
    const email = `e2e-${run}-${tag}@mce.test`;
    let r = await req('POST', '/identidade/usuarios', {
      nome: `Cliente ${tag} ${run}`,
      email,
      senha: '123456',
      cpf: '529.982.247-25',
      telefone: '(44) 99999-8888',
    });
    if (r.s !== 201) throw new Error(`cadastro de cliente falhou: ${r.s} ${JSON.stringify(r.b)}`);
    const id = r.b.id_usuario;
    r = await req('POST', '/identidade/auth/login', { email, senha: '123456' });
    if (r.s === 429) throw new Error(DICA_LIMITE_DE_LOGIN);
    const token = r.b.token;
    r = await req('POST', `/identidade/usuarios/${id}/enderecos`, {
      endereco: 'Rua das Flores', numero: '100', bairro: 'Centro', cidade: 'Cascavel', estado: 'pr', cep: '85800-000',
    }, token);
    if (r.s !== 201) throw new Error(`cadastro de endereço falhou: ${r.s} ${JSON.stringify(r.b)}`);
    return { id, token, idEndereco: r.b.id_endereco, email };
  }

  // Categoria, marca e dois produtos novos para o cenário (nomes com o sufixo da execução).
  async function criarCatalogoDeTeste(admin, produtos) {
    const categoria = (await req('POST', '/catalogo/categorias', { nome: `Cat ${nome} ${run}` }, admin)).b.id_categoria;
    const marca = (await req('POST', '/catalogo/marcas', { nome: `Marca ${nome} ${run}` }, admin)).b.id_marca;
    const criados = [];
    for (const p of produtos) {
      const r = await req('POST', '/catalogo/produtos', { id_marca: marca, id_categoria: categoria, ...p, nome: `${p.nome} ${run}` }, admin);
      if (r.s !== 201) throw new Error(`criar produto falhou: ${r.s} ${JSON.stringify(r.b)}`);
      criados.push(r.b);
    }
    return { categoria, marca, produtos: criados };
  }

  const estoqueDe = async (produto) => (await req('GET', `/catalogo/produtos/${produto.id_produto}`)).b.estoque;

  return {
    nome, run, resultado, ok, req, esperar, aguardar, sql, redisGet, loginAdmin, novoCliente,
    criarCatalogoDeTeste, estoqueDe, env: { identidade, vendas: lerEnv('vendas-service/.env'), catalogo: lerEnv('catalogo-service/.env') },
  };
}

module.exports = { criarContexto, lerEnv, esperar, aguardar, sql, redisGet, RAIZ };
