# Classificação do projeto (Cynefin)

**Domínio escolhido: Complicado.**

O Cynefin classifica um problema em Simples, Complicado, Complexo ou Caótico. A classificação define como gerir o projeto.

| Domínio | O projeto se encaixa? | Por quê |
|---|---|---|
| Simples | Não | Há decisões reais a tomar (quantos serviços, como dividir os dados, síncrono ou assíncrono) |
| **Complicado** | **Sim** | Exige conhecimento especializado, mas o e-commerce é um problema conhecido, com boas práticas estabelecidas (cache-aside, Pub/Sub, API Gateway, DDD) |
| Complexo | Não | Não é um território desconhecido em que só a experimentação mostra o caminho |
| Caótico | Não | Há tempo para planejar antes de agir |

**O que isso muda na prática:** em um problema complicado, vale **analisar antes de agir**. Por isso as decisões de arquitetura (C4, DDD e ADRs) vieram antes do código. Como o escopo ainda mudou durante o projeto, o dia a dia seguiu uma abordagem iterativa, o que levou ao ciclo de vida ágil ([ciclo-de-vida.md](ciclo-de-vida.md)).
