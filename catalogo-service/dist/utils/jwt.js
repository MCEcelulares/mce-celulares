"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validarToken = validarToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
require("dotenv/config");
const publicKey = crypto_1.default
    .createPublicKey((process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n').trim())
    .export({ type: 'spki', format: 'pem' });
function validarToken(token) {
    return jsonwebtoken_1.default.verify(token, publicKey, { algorithms: ['RS256'] });
}
