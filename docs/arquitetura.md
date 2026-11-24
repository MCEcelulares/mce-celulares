# Arquitetura (C4)

O sistema é uma loja online de celulares e eletrônicos. Ele é dividido em **5 microsserviços**, cada um com o seu próprio banco de dados.

## Nível 1: Contexto (quem usa o sistema e com quem ele conversa)

```mermaid
graph TD
    Cliente([Cliente])
    Sistema[["Sistema MCE Celulares"]]
    Email([Provedor de e-mail])
    MP([Mercado Pago])
    Google([Google])

    Cliente -->|"navega, compra, acompanha pedidos"| Sistema
    Sistema -->|"envia e-mails"| Email
    Sistema -->|"cobra o pagamento"| MP
    MP -.->|"avisa quando o pagamento é aprovado"| Sistema
    Sistema -->|"login com Google"| Google
```

| Quem | Papel |
|---|---|
| Cliente | Usa o site para comprar |
| Provedor de e-mail | Entrega os e-mails de pedido e pagamento |
| Mercado Pago | Processa o pagamento |
| Google | Faz o login social |

## Nível 2: Containers (as peças que rodam)

```mermaid
graph TD
    Cliente([Cliente]) --> Site["Site<br/>(React)"]
    Site --> Gateway["Gateway<br/>(Nginx)"]

    Gateway --> Identidade["Identidade"]
    Gateway --> Catalogo["Catálogo"]
    Gateway --> Vendas["Vendas"]
    Gateway --> Pagamento["Pagamento"]

    Identidade --> BD1[("Banco")]
    Catalogo --> BD2[("Banco")]
    Vendas --> BD3[("Banco")]
    Pagamento --> BD4[("Banco")]
    Notificacao["Notificação"] --> BD5[("Banco")]

    Vendas -->|"HTTP"| Identidade
    Vendas -->|"HTTP"| Catalogo
    Pagamento -->|"HTTP"| Vendas

    Catalogo -.->|"cache"| Redis[("Redis")]
    Vendas -.->|"publica pedido.criado"| Redis
    Pagamento -.->|"publica pagamento.confirmado"| Redis
    Redis -.->|"entrega os eventos"| Notificacao
    Notificacao --> Email([E-mail])
```

Linha cheia: chamada HTTP direta. Linha tracejada: Redis (cache ou evento).

| Peça | O que faz |
|---|---|
| Site (React) | As telas da loja e o painel administrativo |
| Gateway (Nginx) | Única porta de entrada: recebe tudo e repassa ao serviço certo |
| Identidade | Cadastro, login, endereços, cargos e permissões |
| Catálogo | Produtos, categorias, marcas, estoque e imagens |
| Vendas | Carrinho e pedidos |
| Pagamento | Cobrança pelo Mercado Pago |
| Notificação | Envia os e-mails |
| Redis | Cache do catálogo e mensagens entre os serviços (Pub/Sub) |
| Bancos MySQL | Um por serviço; nenhum serviço lê o banco do outro |

## Como as peças conversam
- **Pelo gateway:** o site só chama o Nginx (`localhost:8080`). Ele repassa pelo prefixo da URL (`/vendas/...`, `/catalogo/...`).
- **Entre serviços, por HTTP:** quando precisam de uma resposta na hora. O Vendas pergunta preço e estoque ao Catálogo; o Pagamento consulta o pedido no Vendas.
- **Pelo Redis, por evento:** quando só precisam avisar. Vendas e Pagamento publicam, a Notificação reage e manda o e-mail. Quem publica não espera resposta.

As decisões por trás deste desenho estão em [decisoes.md](decisoes.md).
