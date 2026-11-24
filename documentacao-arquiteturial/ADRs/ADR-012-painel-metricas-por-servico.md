# ADR-012: Cada serviço expõe as próprias métricas do painel administrativo

**Status:** Aceito

## Contexto
O painel administrativo (RF46, RF47, RF18) mostra receita, contagem de produtos, usuários e pedidos, e os mais vendidos. Esses dados estão em bancos diferentes (ADR-002), e juntar tudo exigiria ou um serviço agregador, ou o Vendas consultar o Catálogo e o Identidade, ou uma cópia dos dados. O front já conversa com cada serviço pelo gateway.

## Decisão
- **Cada serviço agrega só o que é seu** e expõe numa rota protegida pela permissão `dashboard:ver` (que já existe no catálogo de permissões do Identidade, ADR-006):
  - Vendas: `GET /pedidos/resumo?dias=` (pedidos por status, últimas 24 h, receita total e receita por dia) e `GET /pedidos/mais-vendidos?limite=`.
  - Catálogo: `GET /produtos/resumo` (produtos ativos, inativos, sem estoque, em destaque e valor em estoque).
  - Usuários: continuam no Identidade (fora do escopo desta decisão e de responsabilidade daquele serviço).
- **Receita** conta pedidos `PAGO`, `ENVIADO` e `ENTREGUE`; cancelados e aguardando pagamento não entram.
- **Quem monta o painel é o front**, chamando cada rota. Não há consulta entre serviços para montar métricas.
- As rotas ficam antes de `/{id}` no roteamento, para "resumo" nunca ser lido como identificador.

## Consequências
- **Positivas:** nenhum acoplamento novo entre serviços; cada métrica fica perto do dado e do dono; simples de testar; uma falha em um serviço derruba só o cartão correspondente do painel.
- **Negativas:** o front faz várias chamadas para montar a tela; não há métrica que cruze serviços (ex.: receita por categoria de produto exigiria o Vendas conhecer categorias); as agregações rodam sobre as tabelas operacionais (para volumes grandes valeria uma tabela de resumo ou réplica de leitura).
- Os dias do gráfico de receita seguem o fuso do banco de dados (UTC no Docker).

## Alternativas consideradas
- **Serviço agregador (BFF) para o painel:** resolve as várias chamadas, mas cria um sexto serviço com acesso a todos. Descartada por ora.
- **Vendas consulta Catálogo e Identidade para montar tudo:** acopla um serviço aos outros e aumenta as chamadas síncronas (ADR-003). Descartada.
- **Cópia dos dados em um banco de relatórios:** consistência eventual e infraestrutura nova. Descartada para o MVP.
