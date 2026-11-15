#!/usr/bin/env python3
"""Garante a arquitetura em camadas dos 5 serviços (ADR-015).

  routes -> controllers -> services -> repositories -> models
                              \\-> clients (HTTP)  \\-> utils/eventos (Redis)

Regras (cada violação é listada e o script termina com exit 1):
  1. controllers, services, jobs, middlewares, routes, validators e clients NÃO acessam o banco:
     não importam 'sequelize' (só `import type`), '../config/database' nem '../models'
     (só `import type` e as constantes de status, como models/statusPedido).
  2. controllers e routes falam só com services: não importam repositories.
  3. jobs falam só com services: não importam repositories.
  4. repositories não conhecem as camadas de cima: não importam services, controllers, jobs, clients nem middlewares.
  5. models não importam repositories nem services.

Exceções (infraestrutura, não regra de negócio): controllers/healthController.ts, que só testa a conexão com o banco.
Uso (da raiz do repositório): python3 scripts/verificar-camadas.py
"""
import glob
import os
import re
import sys

SERVICOS = ['identidade', 'catalogo', 'vendas', 'pagamento', 'notificacao']
SEM_BANCO = ['controllers', 'services', 'jobs', 'middlewares', 'routes', 'validators', 'clients']
EXCECOES = {'controllers/healthController.ts'}

IMPORT = re.compile(r"""^\s*import\s+(type\s+)?([^;]*?)\s+from\s+['"]([^'"]+)['"]""", re.MULTILINE | re.DOTALL)
IMPORT_EFEITO = re.compile(r"""^\s*import\s+['"]([^'"]+)['"]""", re.MULTILINE)


def importacoes(texto):
    for m in IMPORT.finditer(texto):
        so_tipo = bool(m.group(1))
        yield so_tipo, m.group(3)
    for m in IMPORT_EFEITO.finditer(texto):
        yield False, m.group(1)


def camada_do_destino(caminho):
    """'../repositories/x' -> 'repositories'; '../models/statusPedido' -> 'models/status'; 'sequelize' -> 'sequelize'."""
    if caminho == 'sequelize' or caminho.startswith('sequelize/'):
        return 'sequelize'
    if not caminho.startswith('.'):
        return None
    partes = [p for p in caminho.split('/') if p not in ('.', '..')]
    if not partes:
        return None
    if partes[0] == 'models' and len(partes) > 1 and partes[1].startswith('status'):
        return 'models/status'
    if partes[0] == 'config' and len(partes) > 1 and partes[1] == 'database':
        return 'config/database'
    return partes[0]


def verificar(servico):
    raiz = f'{servico}-service/src'
    erros = []
    for camada in SEM_BANCO + ['repositories', 'models']:
        for arquivo in sorted(glob.glob(f'{raiz}/{camada}/**/*.ts', recursive=True)):
            rel = os.path.relpath(arquivo, raiz).replace(os.sep, '/')
            if rel in EXCECOES:
                continue
            texto = open(arquivo, encoding='utf-8').read()
            for so_tipo, caminho in importacoes(texto):
                destino = camada_do_destino(caminho)
                if destino is None:
                    continue
                if camada in SEM_BANCO:
                    if destino in ('sequelize', 'models', 'config/database') and not so_tipo:
                        erros.append((rel, f"acessa o banco ('{caminho}'); use um repository (ou `import type`)"))
                    if camada in ('controllers', 'routes', 'jobs') and destino == 'repositories':
                        erros.append((rel, f"{camada} só falam com services, não com '{caminho}'"))
                elif camada == 'repositories':
                    if destino in ('services', 'controllers', 'jobs', 'clients', 'middlewares', 'routes'):
                        erros.append((rel, f"repository não pode depender de camada superior ('{caminho}')"))
                elif camada == 'models':
                    if destino in ('repositories', 'services'):
                        erros.append((rel, f"model não pode depender de '{caminho}'"))
    return erros


def main():
    falhou = False
    for servico in SERVICOS:
        erros = verificar(servico)
        repos = len(glob.glob(f'{servico}-service/src/repositories/*Repository.ts'))
        if erros:
            falhou = True
            print(f'✗ {servico}')
            for arquivo, motivo in erros:
                print(f'    {arquivo}: {motivo}')
        elif repos == 0:
            falhou = True
            print(f'✗ {servico}: nenhum repository em src/repositories')
        else:
            print(f'✓ {servico}: {repos} repositories, camadas respeitadas')
    sys.exit(1 if falhou else 0)


if __name__ == '__main__':
    main()
