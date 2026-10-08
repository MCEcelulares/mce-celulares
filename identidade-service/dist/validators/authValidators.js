"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginGoogleSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    senha: zod_1.z.string().min(1),
});
exports.loginGoogleSchema = zod_1.z.object({
    idToken: zod_1.z.string().min(1),
});
