CREATE TABLE notificacao_log (
  id_notificacao INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  destinatario VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'ENVIADO',
  erro VARCHAR(255),
  enviado_em DATETIME,
  UNIQUE KEY uq_pedido_tipo (id_pedido, tipo)
);
