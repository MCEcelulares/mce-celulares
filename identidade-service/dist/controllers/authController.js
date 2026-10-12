"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.loginGoogle = loginGoogle;
exports.renovar = renovar;
exports.logout = logout;
exports.logoutTodos = logoutTodos;
const authService = __importStar(require("../services/authService"));
async function login(req, res, next) {
    try {
        res.status(200).json(await authService.login(req.body));
    }
    catch (err) {
        next(err);
    }
}
async function loginGoogle(req, res, next) {
    try {
        res.status(200).json(await authService.loginGoogle(req.body.idToken));
    }
    catch (err) {
        next(err);
    }
}
async function renovar(req, res, next) {
    try {
        res.status(200).json(await authService.renovarSessao(req.body.refreshToken));
    }
    catch (err) {
        next(err);
    }
}
async function logout(req, res, next) {
    try {
        await authService.encerrarSessao(req.body.refreshToken);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
async function logoutTodos(req, res, next) {
    try {
        await authService.encerrarTodasAsSessoes(req.usuarioAutenticado.id_usuario);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
