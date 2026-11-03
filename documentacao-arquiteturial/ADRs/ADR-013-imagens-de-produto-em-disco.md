# ADR-013: Imagens de produto em disco (volume), enviadas pelo Catálogo e servidas pelo gateway

**Status:** Aceito

## Contexto
O RF15 pede anexar imagem ao produto e o RNF07, limitar tamanho e tipo do arquivo enviado. O produto guarda só um texto (`imagem`). Armazenamento de objetos (S3 e similares) seria o ideal em produção, mas não faz parte da infraestrutura do projeto.

## Decisão
- `POST /produtos/{id}/imagem` (`multipart/form-data`, campo `imagem`), exigindo `catalogo:gerenciar`. A autenticação é verificada **antes** de ler o arquivo.
- **Limites:** JPEG, PNG ou WEBP, até **2 MB**, um arquivo. O tipo é conferido pelos **bytes iniciais** do arquivo (não pelo tipo declarado pelo cliente): um arquivo que se diz PNG mas não é recebe 415. SVG e GIF não são aceitos (SVG pode carregar script).
- **Nome gerado pelo servidor** (`<uuid>.<extensão>`), nunca o do cliente; o arquivo antigo enviado por esse caminho é apagado ao trocar a imagem, e a remoção só aceita nomes no formato gerado (sem `../` nem URL externa).
- **Onde fica:** um volume Docker (`catalogo_uploads`, em `/app/uploads`), com o container rodando como usuário sem privilégios.
- **Como é servido:** `GET /catalogo/imagens/<arquivo>` pelo próprio Catálogo (`express.static`, sem listar diretório, `dotfiles` negados), com cache longo e imutável (o nome nunca se repete) e `Cross-Origin-Resource-Policy: cross-origin` para o front em outro domínio poder exibir.
- O campo `imagem` do produto continua aceitando uma **URL externa** (JSON), para quem hospeda em outro lugar.
- O Nginx permite corpo de até 3 MB só em `/catalogo/` (o padrão dele é 1 MB).

## Consequências
- **Positivas:** simples, sem dependência externa; seguro contra o abuso mais comum de upload (tipo falso, nome malicioso, arquivo gigante).
- **Negativas:** o arquivo vive no disco de um volume, então escalar o Catálogo para várias instâncias exige um volume compartilhado ou migrar para armazenamento de objetos; o volume precisa de backup junto com o banco; não há redimensionamento nem geração de miniaturas; não há varredura de malware.

## Alternativas consideradas
- **Guardar a imagem no banco (BLOB):** infla o banco e o backup. Descartada.
- **Armazenamento de objetos (S3/MinIO):** o melhor caminho em produção, mas adiciona um componente à infraestrutura. Fica como evolução natural: só `imagemService` muda.
- **Aceitar qualquer tipo de imagem, inclusive SVG:** SVG pode executar script no navegador. Descartada.
