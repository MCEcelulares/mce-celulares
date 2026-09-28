# C4 — Nível 2: Diagrama de Containers

Abre a caixa "Sistema MCEcelulares" e mostra as peças internas: os 5 microsserviços, o gateway, o Redis e os bancos de dados.

```mermaid
graph TD
    Cliente([Cliente - navegador/app])
    FE["Frontend<br/>(Next.js)"]
    GW["API Gateway<br/>(Nginx)"]

    SVC_ID["Serviço Identidade<br/>(Node/Express)"]
    SVC_CAT["Serviço Catálogo<br/>(Node/Express)"]
    SVC_VEN["Serviço Vendas<br/>(Node/Express)"]
    SVC_PAG["Serviço Pagamento<br/>(Node/Express)"]
    SVC_NOT["Serviço Notificação<br/>(Node/Express)"]

    DB_ID[("identidade-db<br/>MySQL")]
    DB_CAT[("catalogo-db<br/>MySQL")]
    DB_VEN[("vendas-db<br/>MySQL")]
    DB_PAG[("pagamento-db<br/>MySQL")]
    DB_NOT[("notificacao-db<br/>MySQL")]

    REDIS[("Redis<br/>Cache + Pub/Sub")]
    EMAIL([Provedor de e-mail])

    Cliente --> FE
    FE -->|HTTP| GW
    GW -->|"/identidade"| SVC_ID
    GW -->|"/catalogo"| SVC_CAT
    GW -->|"/vendas"| SVC_VEN
    GW -->|"/pagamento"| SVC_PAG
    GW -->|"/notificacao"| SVC_NOT

    SVC_ID --> DB_ID
    SVC_CAT --> DB_CAT
    SVC_VEN --> DB_VEN
    SVC_PAG --> DB_PAG
    SVC_NOT --> DB_NOT

    SVC_VEN -->|"HTTP síncrono: valida usuário"| SVC_ID
    SVC_PAG -->|"HTTP síncrono: atualiza status do pedido"| SVC_VEN

    SVC_VEN -.->|"cache-aside user:{id}"| REDIS
    SVC_CAT -.->|"cache-aside produto:{id}"| REDIS

    SVC_VEN -.->|"publica pedido.criado"| REDIS
    SVC_PAG -.->|"publica pagamento.confirmado"| REDIS
    REDIS -.->|"assina os dois canais"| SVC_NOT

    SVC_NOT --> EMAIL
```

## Containers

| Container | Tecnologia | Responsabilidade |
|---|---|---|
| Frontend | Next.js | Telas do e-commerce (home, produtos, conta, carrinho, etc.) |
| API Gateway | Nginx | Ponto único de entrada, roteia por prefixo pra cada serviço |
| Serviço Identidade | Node/Express + Sequelize | Usuários, autenticação, endereços, cargos/permissões |
| Serviço Catálogo | Node/Express + Sequelize | Produtos, categorias, marcas, busca e filtros |
| Serviço Vendas | Node/Express + Sequelize | Carrinho, criação e acompanhamento de pedidos |
| Serviço Pagamento | Node/Express + Sequelize | Processamento e status de pagamento |
| Serviço Notificação | Node/Express + Sequelize | Envio de e-mails transacionais e formulário de contato |
| Redis | Redis | Cache-aside (usuário, produto) e mensageria Pub/Sub |
| Bancos MySQL | MySQL (x5) | Um banco isolado por serviço, sem FK entre eles |
