"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escaparLike = escaparLike;
function escaparLike(texto) {
    return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}
