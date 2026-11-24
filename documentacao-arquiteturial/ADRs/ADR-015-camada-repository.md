# ADR-015: Camada repository entre os services e os models

**Status:** Aceito

## Contexto
Nos 5 serviços, os `services` usavam os models do Sequelize diretamente: `findAll` com `include` e `Op`, `UPDATE` condicional, `transaction`, `UniqueConstraintError`… tudo misturado com a regra de negócio. Isso tinha três custos:
- um service de 300 linhas misturava "o que fazer" com "como consultar", e era difícil ver a regra;
- trocar uma consulta (ou o ORM) exigia mexer em arquivos de negócio;
- as consultas mais delicadas (baixa de estoque sob trava, troca condicional de status, painel) não tinham teste próprio, só apareciam dentro dos testes de rota.

A separação `routes → controllers → services → repository → models` fazia parte do desenho inicial do projeto; ela só não tinha sido implementada.

## Decisão
Cada serviço ganha `src/repositories/`, com **um repository por agregado/entidade** (13 no total, listados em arquitetura-em-camadas.md).

- **Só o repository fala com o Sequelize.** Controllers, services, jobs, middlewares, routes, validators e clients não importam `sequelize` nem os models (só `import type` e as constantes de status). A regra é conferida por `scripts/verificar-camadas.py` no CI (job `camadas`).
- **Repository decide como guardar e buscar; service decide o que fazer.** Consultas, `Op`, `literal`, trava de linhas e `UPDATE` condicional ficam no repository; ele devolve o resultado (um boolean "alterou?", a lista, o total). Quem escolhe entre 404, 409 ou seguir em frente é o service.
- **Erros de banco viram erros do domínio de persistência.** Violação de `UNIQUE` é traduzida para `RegistroDuplicadoError` (`repositories/erros.ts`) e o service a converte em 409 com a mensagem do domínio. O service não precisa conhecer `UniqueConstraintError`.
- **Transações:** o service abre com `comTransacao` (`repositories/transacao.ts`, que só embrulha `sequelize.transaction`) e passa a `transacao` aos repositories. Assim o service continua dono do que entra na transação, sem importar o Sequelize.
- **Os repositories são módulos de funções** (como os services), sem classe base nem interface: `import * as pedidoRepository from '../repositories/pedidoRepository'`.
- **Migração sem mudar comportamento:** as consultas foram movidas como estavam (mesmos `where`, `include`, `order`, `limit`), e os testes de rota existentes continuaram passando sem alteração, o que serve de prova de não regressão.

## Consequências
- **Positivas:** os services ficam com as regras (e menores); as consultas têm lugar único e **testes próprios**, no Identidade e no Catálogo contra MySQL de verdade; a violação da arquitetura quebra o CI.
- **Negativas:**
  - Mais arquivos e uma indireção a mais para quem lê.
  - Os repositories devolvem **instâncias do Sequelize**, não objetos de domínio puros: os services ainda leem campos e, em alguns pontos, alteram a instância depois de gravar (por exemplo, o status do pedido). Um passo futuro seria devolver objetos simples.
  - Nos serviços com testes que mockam os models (Vendas, Pagamento, Notificação), os testes de rota exercitam service e repository juntos; por isso cada um ganhou também testes diretos do repository.

## Alternativas consideradas
- **Repository genérico (classe base com CRUD):** descartado; as consultas mais importantes (baixa de estoque, reserva, painel) são específicas e não cabem num CRUD genérico.
- **Interfaces + injeção de dependência (ports and adapters completo):** descartado por ser desproporcional ao tamanho do projeto; a regra de camadas verificada no CI dá o essencial do benefício.
- **Manter os services acessando os models:** descartado pelos custos do contexto e porque a camada já estava no desenho inicial.
