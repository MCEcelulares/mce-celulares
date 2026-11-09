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
    MP([Mercado Pago])

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

    SVC_VEN -->|"HTTP síncrono: valida usuário e endereço (token do usuário)"| SVC_ID
    SVC_VEN -->|"HTTP síncrono: preço, reserva e devolução de estoque (token de serviço)"| SVC_CAT
    SVC_PAG -->|"HTTP síncrono: lê o pedido e atualiza o status (token de serviço)"| SVC_VEN
    SVC_PAG -->|"HTTP: cria preferência e consulta pagamento"| MP
    MP -.->|"webhook de pagamento (via Gateway)"| GW

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
| Serviço Pagamento | Node/Express + Sequelize | Pagamento via Checkout Pro do Mercado Pago, webhook de confirmação e status de pagamento |
| Serviço Notificação | Node/Express + Sequelize | Envio de e-mails transacionais e formulário de contato |
| Redis | Redis | Cache-aside (produto), sessão renovável do Identidade (ADR-007) e mensageria Pub/Sub |
| Bancos MySQL | MySQL (x5) | Um banco isolado por serviço, sem FK entre eles; o schema é criado pelas migrations de cada serviço |

## Decisões que complementam este desenho
- **Vendas → Catálogo** (consulta de preço/estoque, reserva por pedido e devolução idempotente, com recuperação de órfãos): ADR-009.
- **Token de serviço** nas chamadas internas sem usuário: ADR-010.
- **Pagamento e Mercado Pago** (Checkout Pro, webhook, sincronização, confirmação idempotente): ADR-011.
- **Expiração de pedidos não pagos** (rotina do Vendas que devolve o estoque ao Catálogo): ADR-009, seção "Atualização".
- **Painel administrativo:** cada serviço expõe as próprias métricas (`dashboard:ver`): ADR-012.
- **Imagens de produto:** enviadas ao Catálogo, gravadas num volume e servidas por `/catalogo/imagens/`: ADR-013.
- **Cache-aside `user:{id}` no Vendas:** previsto na primeira versão deste diagrama e **descartado** (motivo no ADR-003, seção "Atualização"). A sessão renovável do Identidade (ADR-007) é o outro uso do Redis como armazenamento.
