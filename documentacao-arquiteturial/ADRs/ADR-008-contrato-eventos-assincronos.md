# ADR-008: Contrato padrão para eventos assíncronos (Redis Pub/Sub)

**Status:** Aceito

## Contexto
O ADR-003 definiu Redis Pub/Sub para efeitos colaterais (`pedido.criado` e `pagamento.confirmado`), mas não definiu o formato das mensagens. Esse formato é um contrato entre publicadores (Vendas, Pagamento) e consumidores (Notificação): mudá-lo depois exige alterar todos ao mesmo tempo. Além disso:
- `notificacao_log` exige `id_pedido`, `tipo` e `destinatario`, e possui `UNIQUE (id_pedido, tipo)`, o que pede consumo idempotente.
- O SLO 4 (p95 < 10s entre evento publicado e e-mail enviado) exige um timestamp de publicação.
- Redis Pub/Sub não suporta headers; metadados precisam ir no corpo da mensagem.

## Decisão

### 1. Envelope comum (obrigatório em todo evento)
```json
{
  "id": "uuid-v4",
  "tipo": "pedido.criado",
  "versao": 1,
  "origem": "vendas-service",
  "ocorridoEm": "2026-10-14T20:00:00.000Z",
  "dados": {}
}
```
- `id`: identificador único do evento (UUID v4).
- `tipo`: igual ao nome do canal.
- `versao`: versão do formato de `dados`; incrementada apenas em mudanças incompatíveis.
- `origem`: serviço publicador.
- `ocorridoEm`: data/hora em ISO 8601 UTC.

### 2. Campos mínimos de `dados` (mínimo + resumo)

`pedido.criado` (publicado por Vendas):
```json
{
  "idPedido": 123,
  "status": "AGUARDANDO_PAGAMENTO",
  "valorTotal": 2599.90,
  "cliente": { "nome": "Fulano", "email": "fulano@email.com" }
}
```

`pagamento.confirmado` (publicado por Pagamento):
```json
{
  "idPedido": 123,
  "valor": 2599.90,
  "metodoPagamento": "PIX",
  "cliente": { "nome": "Fulano", "email": "fulano@email.com" }
}
```
- Valores monetários como `number` com 2 casas decimais.
- **Proibido** trafegar CPF, telefone ou outros dados pessoais não necessários ao e-mail (minimização — LGPD).
- Adicionar campos opcionais é compatível e não altera `versao`; remover ou renomear campos exige nova `versao`.

### 3. Evento autossuficiente (Event-Carried State Transfer)
O evento carrega todos os dados necessários para o consumidor agir. O Notificação **não** faz chamadas HTTP a outros serviços para processar eventos.

## Consequências
- **Positivas:** Notificação é independente em runtime e testável isoladamente (ex.: `redis-cli PUBLISH`); idempotência garantida por `UNIQUE (id_pedido, tipo)`; SLO 4 mensurável via `ocorridoEm`; evolução controlada via `versao`.
- **Negativas:** publicadores precisam conhecer os dados do cliente — Pagamento não armazena e-mail (a definir quando o serviço for implementado); Pub/Sub não persiste mensagens, então eventos publicados com o consumidor fora do ar são perdidos (aceito no MVP).

## Alternativas consideradas
- **Sem envelope (só dados):** descartada — sem `id`, `versao` e timestamp, inviabiliza idempotência, evolução e o SLO 4.
- **CloudEvents (CNCF):** descartada por ora — nomes em inglês destoam do projeto e adiciona dependência; migração futura é direta (campos equivalentes 1:1).
- **Payload completo (itens, endereço, frete):** descartada — acopla Notificação ao modelo de Vendas e depende de regras ainda indefinidas (frete).
- **Evento fino + consulta HTTP:** descartada — recria dependência síncrona de Vendas/Identidade.
- **Réplica local no Notificação:** mantida como plano B para o e-mail do cliente no `pagamento.confirmado`; depende da ordem dos eventos.
