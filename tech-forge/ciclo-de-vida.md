# Ciclo de vida: ágil (Kanban)

## Por que ágil e não preditivo

Durante o planejamento várias decisões mudaram (de monólito para microsserviços; o frete saiu do escopo), e as telas só ficaram claras durante o desenvolvimento. O ciclo preditivo supõe requisitos estáveis desde o início, e isso não aconteceu. O ágil permite entregar por partes e corrigir o rumo.

## Por que Kanban e não Scrum

O trabalho chega em fluxo contínuo e a prioridade muda com frequência. O Kanban funciona sem sprints de tamanho fixo: cada história é puxada para o desenvolvimento quando há capacidade e entregue quando fica pronta.

## Como o projeto é conduzido

- **Quadro Kanban** no Jira, com as colunas A fazer, Em andamento e Concluído, ligadas às branches e aos pull requests do GitHub.
- **Histórias** no formato **User Story** ("Como... quero... para...") com a seção **"Pronto quando"**, que lista os critérios de aceite. A fila de "A fazer" fica ordenada por prioridade.
- **Definition of Done** de cada história: funcionando, testado, documentado no OpenAPI quando é uma rota, e atualizado no Jira.
- **Versões:** cada entrega parcial vira uma **tag** (`v1.0.0`, `v1.1.0`...) com GitHub Release e uma versão (Fix Version) no Jira. O pipeline de CD publica as imagens de cada tag ([entrega](../docs/entrega.md)).

## Papéis

É um projeto de dupla, e os dois integrantes dividem a priorização da fila e o desenvolvimento, revezando quem conduz o alinhamento.
