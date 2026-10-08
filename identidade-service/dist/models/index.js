"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Endereco = exports.UsuarioCargo = exports.Usuario = exports.CargoPermissao = exports.Permissao = exports.Cargo = void 0;
const Cargo_1 = require("./Cargo");
Object.defineProperty(exports, "Cargo", { enumerable: true, get: function () { return Cargo_1.Cargo; } });
const Permissao_1 = require("./Permissao");
Object.defineProperty(exports, "Permissao", { enumerable: true, get: function () { return Permissao_1.Permissao; } });
const CargoPermissao_1 = require("./CargoPermissao");
Object.defineProperty(exports, "CargoPermissao", { enumerable: true, get: function () { return CargoPermissao_1.CargoPermissao; } });
const Usuario_1 = require("./Usuario");
Object.defineProperty(exports, "Usuario", { enumerable: true, get: function () { return Usuario_1.Usuario; } });
const UsuarioCargo_1 = require("./UsuarioCargo");
Object.defineProperty(exports, "UsuarioCargo", { enumerable: true, get: function () { return UsuarioCargo_1.UsuarioCargo; } });
const Endereco_1 = require("./Endereco");
Object.defineProperty(exports, "Endereco", { enumerable: true, get: function () { return Endereco_1.Endereco; } });
Cargo_1.Cargo.belongsToMany(Permissao_1.Permissao, {
    through: CargoPermissao_1.CargoPermissao,
    foreignKey: "id_cargo",
});
Permissao_1.Permissao.belongsToMany(Cargo_1.Cargo, {
    through: CargoPermissao_1.CargoPermissao,
    foreignKey: "id_permissao",
});
Usuario_1.Usuario.belongsToMany(Cargo_1.Cargo, {
    through: UsuarioCargo_1.UsuarioCargo,
    foreignKey: "id_usuario",
});
Cargo_1.Cargo.belongsToMany(Usuario_1.Usuario, { through: UsuarioCargo_1.UsuarioCargo, foreignKey: "id_cargo" });
Usuario_1.Usuario.hasMany(Endereco_1.Endereco, { foreignKey: "id_usuario" });
Endereco_1.Endereco.belongsTo(Usuario_1.Usuario, { foreignKey: "id_usuario" });
