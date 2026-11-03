# C4 — Nível 1: Diagrama de Contexto

Mostra o sistema MCEcelulares como uma caixa única e quem interage com ele, sem entrar em detalhes internos.

```mermaid
graph TD
    Cliente([Cliente - navegador/app])
    Sistema[["Sistema MCEcelulares<br/>(e-commerce de celulares)"]]
    EmailProvider([Provedor de e-mail<br/>ex: SMTP/SendGrid])
    GoogleAuth([Google OAuth])
    MercadoPago([Mercado Pago])

    Cliente -->|"Navega, compra, acompanha pedidos (HTTPS)"| Sistema
    Sistema -->|"Envia e-mails transacionais"| EmailProvider
    Sistema -->|"Autenticação social"| GoogleAuth
    Sistema -->|"Cria preferência e consulta pagamentos"| MercadoPago
    MercadoPago -.->|"Notifica pagamentos (webhook)"| Sistema
    Cliente -.->|"Paga na página do Mercado Pago"| MercadoPago
    Cliente -.->|"Login com Google"| GoogleAuth
```

## Atores e sistemas externos

| Ator/Sistema | Papel |
|---|---|
| Cliente | Usuário final que navega, compra produtos e acompanha pedidos pelo site |
| Google OAuth | Provedor externo de autenticação (login social) |
| Provedor de e-mail | Envia e-mails de pedido confirmado / pagamento confirmado / contato |
| Mercado Pago | Processa o pagamento (Checkout Pro) e avisa o sistema por webhook quando ele é aprovado (ADR-011) |

## Escopo
O sistema MCEcelulares é uma plataforma de e-commerce de celulares e acessórios, composta internamente por 5 microsserviços (detalhado no diagrama de Containers). Para o cliente final, tudo é acessado como um sistema único através do Gateway.
