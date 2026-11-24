#!/usr/bin/env node
/* eslint-disable no-console */
// Popula o Catálogo com categorias, marcas e produtos realistas (versão de desenvolvimento e testes).
// Usa a API como administrador (valida os dados e renova o cache) e pode ser repetido: o que já existe é pulado.
//
//   node scripts/popular-catalogo.js
//
// Precisa do ambiente no ar (docker compose up -d) e do ADMIN_EMAIL/ADMIN_SENHA do identidade-service/.env
// (o administrador sai do seed do Identidade). Para outro endereço do gateway: API_URL=http://host:8080.
// Os preços e as especificações são aproximados, para demonstração; não há imagens (envie pelo painel administrativo).
const fs = require('node:fs');
const path = require('node:path');

const API = (process.env.API_URL || 'http://localhost:8080').replace(/\/$/, '');

function lerEnv(arquivo) {
  const caminho = path.join(__dirname, '..', arquivo);
  const saida = {};
  for (const linha of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(linha.trim());
    if (m) saida[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return saida;
}

const CATEGORIAS = ['Celulares', 'Notebooks', 'Consoles', 'Fones', 'Periféricos', 'Jogos'];

// [nome, categoria, marca, preço, estoque, destaque, descrição]
const PRODUTOS = [
  // ---- Celulares
  ['Apple iPhone 16 128 GB', 'Celulares', 'Apple', 5999, 14, true, 'Tela Super Retina XDR de 6,1", chip A18, câmera dupla com principal de 48 MP e conexão USB-C.'],
  ['Apple iPhone 15 128 GB', 'Celulares', 'Apple', 4699, 9, false, 'Tela de 6,1" com Dynamic Island, chip A16 Bionic, câmera principal de 48 MP e conexão USB-C.'],
  ['Samsung Galaxy S25 256 GB', 'Celulares', 'Samsung', 5299, 11, true, 'Tela Dynamic AMOLED 2X de 6,2", processador Snapdragon 8 Elite for Galaxy e câmera tripla com principal de 50 MP.'],
  ['Samsung Galaxy A55 5G 128 GB', 'Celulares', 'Samsung', 1999, 22, false, 'Tela Super AMOLED de 6,6" com 120 Hz, câmera principal de 50 MP com estabilização óptica e bateria de 5.000 mAh.'],
  ['Xiaomi Redmi Note 14 256 GB', 'Celulares', 'Xiaomi', 1599, 30, false, 'Tela AMOLED de 6,67" com 120 Hz, câmera principal de 108 MP e carregamento rápido.'],
  ['Motorola Moto G85 5G 256 GB', 'Celulares', 'Motorola', 1499, 18, false, 'Tela pOLED curva de 6,67" com 120 Hz, câmera principal de 50 MP com estabilização óptica e bateria de 5.000 mAh.'],

  // ---- Notebooks
  ['Apple MacBook Air 13" M3 256 GB', 'Notebooks', 'Apple', 9499, 6, true, 'Chip M3, 8 GB de memória unificada, SSD de 256 GB e tela Liquid Retina de 13,6". Leve, silencioso e sem ventoinha.'],
  ['Dell Inspiron 15 Core i5 16 GB 512 GB SSD', 'Notebooks', 'Dell', 3899, 12, false, 'Processador Intel Core i5, 16 GB de RAM, SSD de 512 GB e tela Full HD de 15,6". Para trabalho e estudos.'],
  ['Lenovo IdeaPad Slim 3 Ryzen 5 8 GB 512 GB SSD', 'Notebooks', 'Lenovo', 3199, 15, false, 'Processador AMD Ryzen 5, 8 GB de RAM, SSD de 512 GB e tela Full HD de 15,6" em um corpo fino.'],
  ['Acer Aspire 5 Core i5 16 GB 512 GB SSD', 'Notebooks', 'Acer', 3599, 10, false, 'Processador Intel Core i5, 16 GB de RAM, SSD de 512 GB e tela Full HD de 15,6" com bordas finas.'],
  ['ASUS Vivobook 15 Core i5 8 GB 512 GB SSD', 'Notebooks', 'ASUS', 3399, 8, false, 'Processador Intel Core i5, 8 GB de RAM, SSD de 512 GB e tela Full HD de 15,6" com teclado numérico.'],
  ['Acer Nitro V 15 Gamer RTX 4050', 'Notebooks', 'Acer', 6499, 5, false, 'Intel Core i5, 16 GB de RAM, SSD de 512 GB, placa GeForce RTX 4050 e tela Full HD de 15,6" com 144 Hz.'],

  // ---- Consoles
  ['Sony PlayStation 5 Slim 1 TB com leitor de disco', 'Consoles', 'Sony', 4499, 7, true, 'Console de mesa com SSD de 1 TB, leitor de discos Ultra HD Blu-ray e controle DualSense incluso.'],
  ['Sony PlayStation 5 Slim Digital 1 TB', 'Consoles', 'Sony', 3899, 9, false, 'Versão sem leitor de discos, com SSD de 1 TB e controle DualSense incluso. Jogos pela PlayStation Store.'],
  ['Microsoft Xbox Series S 512 GB', 'Consoles', 'Microsoft', 2699, 13, false, 'Console digital compacto com SSD de 512 GB, jogos em até 1440p e controle sem fio incluso.'],
  ['Microsoft Xbox Series X 1 TB', 'Consoles', 'Microsoft', 4699, 0, false, 'Console de mesa com SSD de 1 TB e leitor de discos Ultra HD Blu-ray, jogos em até 4K.'],
  ['Nintendo Switch OLED', 'Consoles', 'Nintendo', 2399, 16, true, 'Console híbrido com tela OLED de 7", 64 GB de armazenamento e dock com porta de rede.'],
  ['Nintendo Switch Lite', 'Consoles', 'Nintendo', 1699, 11, false, 'Console portátil leve, com tela de 5,5" e controles integrados. Ideal para jogar em qualquer lugar.'],

  // ---- Fones
  ['Apple AirPods 4', 'Fones', 'Apple', 1499, 25, true, 'Fones sem fio com design redesenhado, chip H2, áudio espacial personalizado e estojo de carregamento USB-C.'],
  ['Samsung Galaxy Buds3', 'Fones', 'Samsung', 1199, 20, false, 'Fones sem fio com cancelamento ativo de ruído e estojo de carregamento.'],
  ['Sony WH-1000XM5', 'Fones', 'Sony', 2199, 8, false, 'Headphone sem fio com cancelamento de ruído líder da categoria e até 30 horas de bateria.'],
  ['JBL Tune 520BT', 'Fones', 'JBL', 249, 60, false, 'Headphone Bluetooth dobrável com som JBL Pure Bass e até 57 horas de bateria.'],
  ['HyperX Cloud II Gamer 7.1', 'Fones', 'HyperX', 549, 17, false, 'Headset gamer com áudio surround 7.1 virtual, microfone removível com cancelamento de ruído e almofadas de espuma viscoelástica.'],
  ['Logitech G435 Lightspeed sem fio', 'Fones', 'Logitech', 399, 24, false, 'Headset gamer sem fio ultraleve, com conexão Lightspeed e Bluetooth e microfones com cancelamento de ruído.'],

  // ---- Periféricos
  ['Logitech MX Master 3S', 'Periféricos', 'Logitech', 599, 19, true, 'Mouse sem fio ergonômico com sensor de 8.000 DPI, cliques silenciosos e rolagem eletromagnética MagSpeed.'],
  ['Logitech MX Keys S', 'Periféricos', 'Logitech', 699, 12, false, 'Teclado sem fio com teclas esféricas, iluminação inteligente e conexão com até três dispositivos.'],
  ['Logitech G203 Lightsync', 'Periféricos', 'Logitech', 139, 45, false, 'Mouse gamer com sensor de 8.000 DPI, seis botões programáveis e iluminação RGB personalizável.'],
  ['Razer DeathAdder V3', 'Periféricos', 'Razer', 449, 14, false, 'Mouse gamer ergonômico e ultraleve, com sensor óptico de alta precisão e switches ópticos.'],
  ['Redragon Kumara K552 Mecânico', 'Periféricos', 'Redragon', 229, 33, false, 'Teclado mecânico compacto sem teclado numérico, com switches Outemu Blue e iluminação LED.'],
  ['Logitech C920 HD Pro Webcam', 'Periféricos', 'Logitech', 449, 21, false, 'Webcam Full HD 1080p com microfones estéreo e correção automática de luz. Ideal para reuniões e transmissões.'],

  // ---- Jogos
  ['EA Sports FC 25 (PS5)', 'Jogos', 'Electronic Arts', 249, 28, false, 'O novo capítulo do futebol da EA, com HyperMotionV e Ultimate Team. Mídia física para PlayStation 5.'],
  ['God of War Ragnarök (PS5)', 'Jogos', 'Sony', 199, 15, false, 'Kratos e Atreus enfrentam o Ragnarök em uma aventura épica pelos nove reinos. Mídia física para PlayStation 5.'],
  ['Elden Ring (PS5)', 'Jogos', 'Bandai Namco', 229, 12, false, 'RPG de ação em mundo aberto criado por FromSoftware e George R. R. Martin. Mídia física para PlayStation 5.'],
  ['Hogwarts Legacy (PS5)', 'Jogos', 'Warner Bros. Games', 179, 17, false, 'RPG de ação no mundo bruxo no século XIX, em Hogwarts. Mídia física para PlayStation 5.'],
  ['Forza Horizon 5 (Xbox)', 'Jogos', 'Microsoft', 199, 10, false, 'Corrida em mundo aberto ambientada no México, com centenas de carros. Mídia física para Xbox.'],
  ['The Legend of Zelda: Tears of the Kingdom (Switch)', 'Jogos', 'Nintendo', 349, 20, true, 'Link explora o reino de Hyrule e os céus em uma aventura épica. Cartucho para Nintendo Switch.'],
  ['Mario Kart 8 Deluxe (Switch)', 'Jogos', 'Nintendo', 349, 26, false, 'Corridas com todos os pistas e personagens, até 4 jogadores na mesma tela. Cartucho para Nintendo Switch.'],
];

async function chamar(metodo, rota, corpo, token) {
  const r = await fetch(`${API}${rota}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  let json = null;
  try { json = await r.json(); } catch { /* resposta sem corpo */ }
  if (!r.ok) throw new Error(`${metodo} ${rota} -> HTTP ${r.status} ${json?.erro ?? ''} ${json?.detalhes ? JSON.stringify(json.detalhes) : ''}`.trim());
  return json;
}

(async () => {
  const env = lerEnv('identidade-service/.env');
  if (!env.ADMIN_EMAIL || !env.ADMIN_SENHA) throw new Error('ADMIN_EMAIL/ADMIN_SENHA não encontrados em identidade-service/.env');
  const sessao = await chamar('POST', '/identidade/auth/login', { email: env.ADMIN_EMAIL, senha: env.ADMIN_SENHA }).catch((e) => {
    throw new Error(`login do administrador falhou (${e.message}). Rode o seed: docker exec identidade npx sequelize-cli db:seed --seed 202612101317-seed-admin.js`);
  });
  const token = sessao.token;

  const categorias = new Map((await chamar('GET', '/catalogo/categorias?incluirInativos=true', undefined, token)).map((c) => [c.nome, c.id_categoria]));
  const marcas = new Map((await chamar('GET', '/catalogo/marcas?incluirInativos=true', undefined, token)).map((m) => [m.nome, m.id_marca]));
  const existentes = new Set();
  for (let pagina = 1; ; pagina++) {
    const r = await chamar('GET', `/catalogo/produtos?incluirInativos=true&limite=100&pagina=${pagina}`, undefined, token);
    r.dados.forEach((p) => existentes.add(p.nome));
    if (pagina >= (r.paginacao?.totalPaginas ?? 1)) break;
  }

  let novas = 0, novasMarcas = 0, novosProdutos = 0, pulados = 0;
  for (const nome of CATEGORIAS) {
    if (categorias.has(nome)) continue;
    categorias.set(nome, (await chamar('POST', '/catalogo/categorias', { nome }, token)).id_categoria); novas++;
  }
  for (const nomeMarca of [...new Set(PRODUTOS.map((p) => p[2]))]) {
    if (marcas.has(nomeMarca)) continue;
    marcas.set(nomeMarca, (await chamar('POST', '/catalogo/marcas', { nome: nomeMarca }, token)).id_marca); novasMarcas++;
  }
  for (const [nome, categoria, marca, preco, estoque, destaque, descricao] of PRODUTOS) {
    if (existentes.has(nome)) { pulados++; continue; }
    await chamar('POST', '/catalogo/produtos', { nome, descricao, preco, estoque, destaque, ativo: true, id_categoria: categorias.get(categoria), id_marca: marcas.get(marca) }, token);
    novosProdutos++;
  }
  console.log(`Catálogo pronto: ${novas} categoria(s), ${novasMarcas} marca(s) e ${novosProdutos} produto(s) criados; ${pulados} produto(s) já existiam.`);
})().catch((e) => { console.error(`✖ ${e.message}`); process.exit(1); });
