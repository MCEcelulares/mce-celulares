# ADR-004: Adotar TypeScript no backend (todos os serviços) e no frontend

**Status:** Aceito

## Contexto
O documento de requisitos do projeto (RNF13) exige "código escrito em TypeScript, com tipagem estática em backend e frontend". Até a Fase 1, a infraestrutura foi montada de forma agnóstica à linguagem (Docker, bancos, nginx), mas a partir da Fase 2 cada serviço passa a ter código de verdade, e essa decisão precisa estar fechada antes do primeiro `npm init`.

## Decisão
Todos os 5 serviços de backend (Identidade, Catálogo, Vendas, Pagamento, Notificação) serão escritos em **TypeScript sobre Node/Express**, com Sequelize tipado (`sequelize` + `@types/node` + tipagem manual dos models, ou `sequelize-typescript` se a dupla preferir decorators). O frontend também é escrito em TypeScript e só precisa manter `strict: true` no `tsconfig`. (Veja a seção "Atualização": o frontend final usa React com Vite, não Next.js.)

Cada serviço terá seu próprio `tsconfig.json`, com build (`tsc`) gerando a pasta `dist/`, que é o que roda em produção dentro do container (o Dockerfile de cada serviço faz `npm run build` antes do `CMD`).

## Consequências
- **Positivas:** atende diretamente o RNF13; tipagem já pega em tempo de compilação erros que hoje só apareceriam em runtime (ex.: passar `pedido.status` como número em vez de string — o tipo do model captura isso); facilita a dupla entender o código um do outro, já que os tipos documentam o formato dos dados sem precisar ler a implementação inteira.
- **Negativas:** mais um passo de build por serviço (não dá mais pra rodar `node index.js` direto, precisa `tsc` antes ou `ts-node` em dev); os `.env.example` e o `docker-compose.yml` da Fase 1 continuam os mesmos, mas os Dockerfiles de cada serviço (Fases 2-6) precisam de um estágio de build; typagem do Sequelize exige um pouco mais de código boilerplate nos models do que em JS puro.

## Alternativas consideradas
- **Manter JavaScript puro no backend:** mais rápido pra começar, mas descumpre o RNF13 diretamente — descartado.
- **TypeScript só no backend, frontend em JS:** o frontend do projeto já foi criado em TS (herdado da versão anterior do produto), então não faria sentido voltar atrás — descartado.

## Atualização
O frontend foi implementado em **React 19 com Vite** (repositório `mcecelulares-frontend`, com `strict: true` em `tsconfig.app.json`), e não em Next.js como previsto na primeira versão deste ADR. A decisão de usar TypeScript nos dois lados continua valendo; só o framework do frontend mudou. O frontend não depende de renderização no servidor: é uma aplicação de página única que consome a API pelo Gateway.
