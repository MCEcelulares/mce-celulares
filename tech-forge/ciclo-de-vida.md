# Ciclo de Vida do Projeto: Ágil (Scrum simplificado)

## Por que Ágil e não Preditivo
Ao longo do planejamento, várias decisões mudaram (ex.: frete real via API → frete simples → sem frete por enquanto; monólito modular → microsserviços reais), e o escopo das telas só ficou claro durante o processo. Um ciclo de vida preditivo pressupõe requisitos estáveis desde o início — não é o caso aqui. Um modelo ágil permite entregar por partes (por serviço) e ajustar o rumo a cada etapa.

## Como será conduzido

- **Product Backlog:** lista de User Stories priorizadas (ver `product-backlog.md`), gerenciada no Jira.
- **Sprints:** sugestão de 1 sprint por fase do roadmap técnico (ex.: Sprint 1 = Fase 0 + Fase 1, Sprint 2 = Identidade + Catálogo em paralelo, Sprint 3 = Vendas + Pagamento + Notificação em paralelo, Sprint 4 = integração + resiliência + frontend, Sprint 5 = CI/CD e ajustes finais).
- **Divisão de trabalho:** conforme já definido — cada integrante da dupla dono de um conjunto de serviços, com pontos de sincronização nas dependências entre eles (ex.: contrato do endpoint `GET /usuarios/{id}` precisa estar fechado antes de Vendas implementar a validação síncrona).
- **Critério de "pronto" (Definition of Done) por User Story:** endpoint implementado + testado manualmente + documentado no OpenAPI do serviço + atualizado no Jira.

## Papéis
Como é um projeto de dupla (sem estrutura formal de equipe grande), os dois integrantes acumulam os papéis de Product Owner (priorização do backlog) e Desenvolvedores, revezando quem conduz as reuniões de alinhamento.
