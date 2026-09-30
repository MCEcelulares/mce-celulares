-- Serviço Identidade — schema inicial

CREATE TABLE cargo (
  id_cargo INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE permissao (
  id_permissao INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE cargo_permissao (
  id_cargo INT NOT NULL,
  id_permissao INT NOT NULL,
  PRIMARY KEY (id_cargo, id_permissao),
  FOREIGN KEY (id_cargo) REFERENCES cargo(id_cargo),
  FOREIGN KEY (id_permissao) REFERENCES permissao(id_permissao)
);

CREATE TABLE usuario (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha VARCHAR(255),
  cpf VARCHAR(255),
  telefone VARCHAR(255),
  ativo BOOLEAN DEFAULT TRUE,
  admin BOOLEAN DEFAULT FALSE,
  provedor VARCHAR(20) DEFAULT 'local',
  google_id VARCHAR(255) UNIQUE,
  email_verificado BOOLEAN DEFAULT FALSE
);

CREATE TABLE usuario_cargo (
  id_usuario INT NOT NULL,
  id_cargo INT NOT NULL,
  PRIMARY KEY (id_usuario, id_cargo),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_cargo) REFERENCES cargo(id_cargo)
);

CREATE TABLE endereco (
  id_endereco INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  endereco VARCHAR(255) NOT NULL,
  numero VARCHAR(255) NOT NULL,
  complemento VARCHAR(255),
  bairro VARCHAR(255),
  cidade VARCHAR(255) NOT NULL,
  estado VARCHAR(255) NOT NULL,
  cep VARCHAR(255) NOT NULL,
  principal BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

INSERT INTO cargo (nome) VALUES
  ('cliente'), ('vendas'), ('atendimento'), ('auditor'), ('administrador');
