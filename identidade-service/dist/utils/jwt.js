"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assinarToken = assinarToken;
exports.validarToken = validarToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
require("dotenv/config");
const privateKey = (process.env.JWT_PRIVATE_KEY ?? '').trim();
const publicKey = crypto_1.default.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
function assinarToken(payload) {
    const options = {
        algorithm: 'RS256',
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d'),
    };
    return jsonwebtoken_1.default.sign(payload, privateKey, options);
}
function validarToken(token) {
    return jsonwebtoken_1.default.verify(token, publicKey, { algorithms: ['RS256'] });
}
