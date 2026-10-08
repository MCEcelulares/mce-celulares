import { Cargo } from "./Cargo";
import { Permissao } from "./Permissao";
import { CargoPermissao } from "./CargoPermissao";
import { Usuario } from "./Usuario";
import { UsuarioCargo } from "./UsuarioCargo";
import { Endereco } from "./Endereco";

Cargo.belongsToMany(Permissao, {
  through: CargoPermissao,
  foreignKey: "id_cargo",
});
Permissao.belongsToMany(Cargo, {
  through: CargoPermissao,
  foreignKey: "id_permissao",
});

Usuario.belongsToMany(Cargo, {
  through: UsuarioCargo,
  foreignKey: "id_usuario",
});
Cargo.belongsToMany(Usuario, { through: UsuarioCargo, foreignKey: "id_cargo" });

Usuario.hasMany(Endereco, { foreignKey: "id_usuario" });
Endereco.belongsTo(Usuario, { foreignKey: "id_usuario" });

export { Cargo, Permissao, CargoPermissao, Usuario, UsuarioCargo, Endereco };
