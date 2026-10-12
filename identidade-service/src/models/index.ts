import { Cargo } from "./Cargo";
import { Permissao } from "./Permissao";
import { CargoPermissao } from "./CargoPermissao";
import { Usuario } from "./Usuario";
import { UsuarioCargo } from "./UsuarioCargo";
import { Endereco } from "./Endereco";

Cargo.belongsToMany(Permissao, {
  through: CargoPermissao,
  foreignKey: "id_cargo",
  otherKey: "id_permissao",
  as: { singular: "permissao", plural: "permissoes" },
});
Permissao.belongsToMany(Cargo, {
  through: CargoPermissao,
  foreignKey: "id_permissao",
  otherKey: "id_cargo",
  as: { singular: "cargo", plural: "cargos" },
});

Usuario.belongsToMany(Cargo, {
  through: UsuarioCargo,
  foreignKey: "id_usuario",
  otherKey: "id_cargo",
  as: { singular: "cargo", plural: "cargos" },
});
Cargo.belongsToMany(Usuario, {
  through: UsuarioCargo,
  foreignKey: "id_cargo",
  otherKey: "id_usuario",
  as: { singular: "usuario", plural: "usuarios" },
});

Usuario.hasMany(Endereco, { foreignKey: "id_usuario" });
Endereco.belongsTo(Usuario, { foreignKey: "id_usuario" });

export { Cargo, Permissao, CargoPermissao, Usuario, UsuarioCargo, Endereco };
