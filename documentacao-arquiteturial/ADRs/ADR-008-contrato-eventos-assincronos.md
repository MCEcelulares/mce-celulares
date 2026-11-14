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
- **Negativas:** publicadores precisam conhecer os dados do cliente — o Pagamento não armazena e-mail (resolvido, ver "Atualização" abaixo); Pub/Sub não persiste mensagens, então eventos publicados com o consumidor fora do ar são perdidos (aceito no MVP).

## Alternativas consideradas
- **Sem envelope (só dados):** descartada — sem `id`, `versao` e timestamp, inviabiliza idempotência, evolução e o SLO 4.
- **CloudEvents (CNCF):** descartada por ora — nomes em inglês destoam do projeto e adiciona dependência; migração futura é direta (campos equivalentes 1:1).
- **Payload completo (itens, endereço, frete):** descartada — acopla Notificação ao modelo de Vendas e depende de regras ainda indefinidas (frete).
- **Evento fino + consulta HTTP:** descartada — recria dependência síncrona de Vendas/Identidade.
- **Réplica local no Notificação:** era o plano B para o e-mail do cliente no `pagamento.confirmado`; **não foi necessária** (ver "Atualização" abaixo).

## Atualização (2026-10-29) — como ficou a implementação
- **E-mail no `pagamento.confirmado`:** o Pagamento obtém nome e e-mail do cliente na resposta do `PATCH /pedidos/{id}/status` do Vendas (que devolve `cliente`) e os coloca no evento (ADR-011). A réplica local no Notificação não é necessária.
- **Publicadores:** Vendas publica `pedido.criado` depois de gravar o pedido; Pagamento publica `pagamento.confirmado` **uma única vez**, mesmo com webhooks repetidos. Se a publicação falhar, a operação de negócio continua válida e o erro vai para log e métrica (`evento_nao_publicado`).
- **Consumo (Notificação):** eventos fora do contrato (JSON inválido, `tipo` diferente do canal, `versao` desconhecida, dados sem e-mail) são **descartados** com log e métrica `evento_invalido`. O registro em `notificacao_log` nasce `PENDENTE` e vira `ENVIADO` ou `FALHA`; o envio tenta até 3 vezes; um evento **republicado** para uma notificação em `FALHA` tenta reenviar, enquanto uma já `ENVIADA` é ignorada (idempotência).
- **Fila de envio:** os e-mails saem um por vez, com pausa configurável (`EMAIL_INTERVALO_MS`), porque provedores de SMTP limitam a taxa (o plano gratuito do Mailtrap recusa rajadas).
- **Limitação conhecida:** se o processo cair no meio de um envio, o registro fica `PENDENTE` e um evento republicado é ignorado.

## Atualização (2026-11-05) — reenvio automático na Notificação
- `notificacao_log` guarda `assunto` e `texto` do e-mail e conta as rodadas de envio (`tentativas`). Uma rotina reenvia sozinha as notificações em `FALHA` (e as `PENDENTE` presas há mais de 10 minutos), com espera que dobra a cada rodada (2, 4, 8… até 60 min) e no máximo `NOTIFICACAO_REENVIO_MAX_TENTATIVAS` rodadas (padrão 5); depois fica em `FALHA` definitiva.
- Cada notificação é reivindicada por UPDATE condicional, então só uma instância envia. Isso substitui a "limitação conhecida" anterior (registro preso em `PENDENTE` ignorava eventos republicados).
- Registros anteriores a essa mudança não têm conteúdo guardado e não são reenviados. A listagem por pedido não expõe o `texto`.
