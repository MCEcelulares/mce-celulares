# ADR-001: Adotar microsserviços reais (não monólito modular)

**Status:** Aceito

## Contexto
O bimestre exige, no mínimo, 1 microsserviço real (o restante poderia continuar monolítico). A ideia inicial da dupla era um monólito modular. O professor reforçou a exigência de microsserviços reais para avaliação, e a dupla decidiu ir além do mínimo, implementando toda a aplicação como microsserviços de fato.

## Decisão
O sistema será dividido em 5 microsserviços independentes, cada um com ciclo de vida, deploy e banco de dados próprios: **Identidade**, **Catálogo**, **Vendas**, **Pagamento** e **Notificação**.

## Consequências
- **Positivas:** cobre com folga a exigência da rubrica, permite explorar de verdade os temas de comunicação síncrona/assíncrona, cache distribuído e mensageria; equipes (dupla) podem trabalhar em paralelo em serviços diferentes.
- **Negativas:** aumento real de complexidade operacional (mais containers, mais pontos de falha, necessidade de observabilidade); exige código defensivo (retry/timeout) nas chamadas entre serviços que antes seriam um simples JOIN no monólito.

## Alternativas consideradas
- **Alternativa 1:** Monólito modular -> não cobria parte da rúbrica
- **Alternativa 2:** apenas 1 microsserviço -> concordamos que se fossemos fazer microsserviços iriamos fazer de verdade, então vamos nosso máximo para implementar microssevriço em toda parte do sistema