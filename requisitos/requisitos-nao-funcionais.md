# **Requisitos não funcionais:**  
## **1	 Segurança**  
RNF01:	O sistema deve armazenar senhas de forma criptografada (hash)

RNF02:	O sistema deve utilizar autenticação baseada em token JWT

RNF03:	O sistema deve validar e autorizar todas as rotas sensíveis via middleware de autenticação e permissão

RNF04:	O sistema deve validar todos os dados de entrada antes de processá-los

RNF05:	O sistema deve tratar e padronizar erros HTTP de forma centralizada

RNF06:	As comunicações externas (nginx) devem suportar HTTPS/SSL

RNF07:	O sistema deve limitar o tamanho e tipo de arquivos enviados no upload de imagens

## **2	 Desempenho e Escalabilidade**  
RNF08:	O sistema deve implementar paginação em listagens para evitar sobrecarga de dados

RNF09:	O sistema deve ser containerizado para facilitar escalabilidade e deploy

RNF10:	O banco de dados deve possuir verificação de saúde (healthcheck) antes de disponibilizar o backend

## **3	 Confiabilidade e Disponibilidade**  
RNF11:	 O backend deve expor um endpoint de healthcheck para monitoramento

RNF12:	 O sistema deve reiniciar automaticamente serviços críticos em caso de falha (restart policy no MySQL)

## **4	 Manutenibilidade**  
RNF13	O código deve ser escrito em TypeScript, com tipagem estática em backend e frontend

RNF14:	O sistema deve seguir uma arquitetura em camadas (controllers, services, models, routes, validators, middlewares)

RNF15:	O sistema deve utilizar ORM para abstração e padronização do acesso ao banco de dados

RNF16:	O sistema deve seguir padrões de commit para histórico de versionamento consistente

RNF17:	O sistema deve possuir testes automatizados

## **5	 Usabilidade**  
RNF18:	O sistema deve fornecer feedback visual claro sobre erros de validação

RNF19:	A navegação do painel administrativo deve considerar as permissões do usuário, exibindo apenas o que ele pode acessar

## **6	 Portabilidade e Infraestrutura**  
RNF20:	O sistema deve rodar em containers Docker isolados (frontend, backend, banco de dados, proxy)

RNF21:	O sistema deve utilizar Nginx como proxy reverso entre frontend e backend

RNF22:	O sistema deve utilizar variáveis de ambiente para configuração sensível (chaves, credenciais, URLs)

## **7	 Compatibilidade**  
RNF23:	O frontend deve ser construído com Next.js e React, compatível com navegadores modernos

RNF24:	O backend deve utilizar Node.js/Express e ser compatível com banco de dados MySQL

RNF25:	O sistema deve possuir uma interface móvel construída com React Native e Expo, garantindo compatibilidade com os sistemas operacionais Android e iOS.

RNF26:	O backend deve atuar como uma API RESTful, sendo capaz de atender simultaneamente e de forma independente as requisições do frontend Web (Next.js) e do aplicativo Mobile (React Native).

RNF27:	O aplicativo móvel deve apresentar um design responsivo e adaptado para telas de smartphones, garantindo uma navegação fluida baseada em toques e gestos.
