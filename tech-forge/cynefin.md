# Classificação do Projeto — Framework Cynefin

## Domínio escolhido: **Complicado**

## Justificativa

- **Não é Simples:** o projeto não tem uma solução única e trivial — há decisões arquiteturais reais (quantos serviços, como dividir dados, síncrono vs. assíncrono) que exigem análise.
- **É Complicado, não Complexo:** apesar de exigir conhecimento especializado (microsserviços, mensageria, cache distribuído), o domínio de e-commerce é bem conhecido e documentado — existem boas práticas estabelecidas (padrão cache-aside, Pub/Sub, API Gateway, DDD) que podem ser aplicadas com planejamento. Não estamos navegando um território totalmente desconhecido onde só a experimentação revela o caminho (isso seria Complexo).
- **Não é Caótico:** há tempo para planejar antes de agir — não é uma situação de crise exigindo ação imediata sem análise.

## Implicação prática
Como o domínio é Complicado, faz sentido **analisar antes de agir**: por isso nossa fase de inicial concentra decisões de arquitetura (ADRs, C4, DDD) antes de começar a codar. Ao mesmo tempo, como o projeto evoluiu bastante durante o planejamento, a condução do dia a dia se beneficia de uma abordagem iterativa — daí a escolha por ciclo de vida ágil.
