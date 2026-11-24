# Ciclo de vida: ágil (Scrum simplificado)

## Por que ágil e não preditivo

Durante o planejamento várias decisões mudaram (de monólito para microsserviços; o frete saiu do escopo), e as telas só ficaram claras durante o desenvolvimento. O ciclo preditivo supõe requisitos estáveis desde o início, e isso não aconteceu. O ágil permite entregar por partes e corrigir o rumo.

## Como o projeto é conduzido

- **Product Backlog** no Jira, em **User Stories** ("Como... quero... para...") com a seção **"Pronto quando"**, que lista os critérios de aceite.
- **Quadro** com os status do Jira (A fazer, Em andamento, Concluído), ligados às branches e aos pull requests do GitHub.
- **Definition of Done** de cada história: funcionando, testado, documentado no OpenAPI quando é uma rota, e atualizado no Jira.
- **Versões:** cada entrega parcial vira uma **tag** (`v1.0.0`, `v1.1.0`...) com GitHub Release e uma versão (Fix Version) no Jira. O pipeline de CD publica as imagens de cada tag ([entrega](../docs/entrega.md)).

## Papéis

É um projeto de dupla, então os dois integrantes acumulam os papéis de Product Owner (priorizar o backlog) e de Desenvolvedores, revezando quem conduz o alinhamento.
