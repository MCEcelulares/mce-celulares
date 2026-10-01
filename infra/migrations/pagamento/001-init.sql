
CREATE TABLE pagamento (
  id_pagamento INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  metodo_pagamento VARCHAR(255) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_pagamento DATETIME,
  status VARCHAR(20) DEFAULT 'PENDENTE'
);
