"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissoesDoSistema = exports.nomeCargoPadrao = exports.nomeCargoAdmin = exports.cargosProtegidos = void 0;
exports.cargosProtegidos = ['cliente', 'administrador'];
exports.nomeCargoAdmin = 'administrador';
exports.nomeCargoPadrao = 'cliente';
exports.permissoesDoSistema = [
    'painel:acessar',
    'dashboard:ver',
    'usuarios:listar',
    'usuarios:ver',
    'usuarios:editar',
    'usuarios:excluir',
    'usuarios:gerenciar-cargos',
    'cargos:gerenciar',
    'catalogo:gerenciar',
    'pedidos:listar-todos',
    'pedidos:atualizar-status',
    'pedidos:cancelar',
];
