
CREATE TABLE categoria (
  id_categoria INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  icone VARCHAR(255),
  ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE marca (
  id_marca INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE produto (
  id_produto INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2) NOT NULL,
  estoque INT NOT NULL DEFAULT 0,
  imagem VARCHAR(255),
  destaque BOOLEAN DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE,
  peso DECIMAL(6,3),
  altura DECIMAL(6,2),
  largura DECIMAL(6,2),
  comprimento DECIMAL(6,2),
  id_marca INT NOT NULL,
  id_categoria INT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_marca) REFERENCES marca(id_marca),
  FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria),
  FULLTEXT KEY ft_produto_nome (nome)
) ENGINE=InnoDB;
