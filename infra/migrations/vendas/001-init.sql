CREATE TABLE carrinho (
  id_carrinho INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
  ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE item_carrinho (
  id_item_carrinho INT AUTO_INCREMENT PRIMARY KEY,
  id_carrinho INT NOT NULL,
  id_produto INT NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  quantidade INT NOT NULL,
  FOREIGN KEY (id_carrinho) REFERENCES carrinho(id_carrinho)
);

CREATE TABLE pedido (
  id_pedido INT AUTO_INCREMENT PRIMARY KEY,
  data DATETIME DEFAULT CURRENT_TIMESTAMP,
  valor_total DECIMAL(10,2) NOT NULL,
  valor_frete DECIMAL(10,2) DEFAULT 0,
  metodo_envio VARCHAR(50),
  prazo_entrega_dias INT,
  codigo_rastreio VARCHAR(100),
  id_envio_externo VARCHAR(100),
  ativo BOOLEAN DEFAULT TRUE,
  status VARCHAR(30) DEFAULT 'AGUARDANDO_PAGAMENTO'
);

CREATE TABLE item_pedido (
  id_item INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  id_produto INT,
  nome_produto VARCHAR(150) NOT NULL,
  quantidade INT NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
);

CREATE TABLE endereco_pedido (
  id_endereco_pedido INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  endereco VARCHAR(255) NOT NULL,
  numero VARCHAR(255) NOT NULL,
  complemento VARCHAR(255),
  bairro VARCHAR(255),
  cidade VARCHAR(255) NOT NULL,
  estado VARCHAR(255) NOT NULL,
  cep VARCHAR(255) NOT NULL,
  FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
);

CREATE TABLE usuario_pedido (
  id_usuario_pedido INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  cpf VARCHAR(255) NOT NULL,
  telefone VARCHAR(255) NOT NULL,
  id_usuario INT,
  FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
);
