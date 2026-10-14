"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextoRequisicao = void 0;
const async_hooks_1 = require("async_hooks");
exports.contextoRequisicao = new async_hooks_1.AsyncLocalStorage();
