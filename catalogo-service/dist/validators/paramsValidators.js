"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idPedidoParamSchema = exports.idParamSchema = void 0;
const zod_1 = require("zod");
const idPositivo = zod_1.z.coerce.number().int().positive();
exports.idParamSchema = zod_1.z.object({ id: idPositivo });
exports.idPedidoParamSchema = zod_1.z.object({ idPedido: idPositivo });
