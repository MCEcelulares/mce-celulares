#!/usr/bin/env python3
"""Garante que o contrato OpenAPI de cada serviço (apis/*.openapi.yaml) bate com as rotas do código.

Falha (exit 1) se uma rota do código não estiver documentada ou se o contrato documentar uma rota que não existe.
/health, /health/live e /metrics ficam de fora (são montados no app, não nos arquivos de rotas).
Uso (da raiz do repositório): python3 scripts/verificar-contratos.py
"""
import glob
import os
import re
import sys

import yaml

SERVICOS = ['identidade', 'catalogo', 'vendas', 'pagamento', 'notificacao']
METODOS = ('get', 'post', 'put', 'patch', 'delete')
IGNORAR = ('/health', '/health/live', '/metrics')


def rotas_do_codigo(servico):
    pasta = f'{servico}-service/src/routes'
    indice = open(f'{pasta}/index.ts', encoding='utf-8').read()
    arquivo_da_variavel = dict(re.findall(r"import\s+(\w+)\s+from\s+['\"]\./(\w+)['\"]", indice))
    prefixos = {}
    for caminho, variavel in re.findall(r"router\.use\(\s*['\"]([^'\"]*)['\"]\s*,\s*(\w+)", indice):
        if variavel in arquivo_da_variavel:
            prefixos[arquivo_da_variavel[variavel]] = caminho.rstrip('/')

    rotas = set()
    for arquivo in glob.glob(f'{pasta}/*.ts'):
        nome = os.path.basename(arquivo)[:-3]
        if nome == 'index':
            continue
        prefixo = prefixos.get(nome, '')
        texto = open(arquivo, encoding='utf-8').read()
        for metodo, caminho in re.findall(r"router\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]*)['\"]", texto):
            completo = prefixo + ('' if caminho == '/' else caminho)
            rotas.add((metodo, completo or '/'))
    return rotas


def rotas_do_contrato(servico):
    contrato = yaml.safe_load(open(f'apis/{servico}.openapi.yaml', encoding='utf-8'))
    return {
        (metodo, re.sub(r'\{(\w+)\}', r':\1', caminho))
        for caminho, operacoes in contrato['paths'].items()
        for metodo in operacoes
        if metodo in METODOS
    }


def main():
    falhou = False
    for servico in SERVICOS:
        codigo = {r for r in rotas_do_codigo(servico) if r[1] not in IGNORAR}
        contrato = {r for r in rotas_do_contrato(servico) if r[1] not in IGNORAR}
        sem_doc = sorted(codigo - contrato)
        sem_codigo = sorted(contrato - codigo)
        if sem_doc or sem_codigo:
            falhou = True
            print(f'✗ {servico}')
            for metodo, caminho in sem_doc:
                print(f'    no código e fora do contrato: {metodo.upper()} {caminho}')
            for metodo, caminho in sem_codigo:
                print(f'    no contrato e fora do código: {metodo.upper()} {caminho}')
        else:
            print(f'✓ {servico}: {len(codigo)} rotas documentadas')
    sys.exit(1 if falhou else 0)


if __name__ == '__main__':
    main()
