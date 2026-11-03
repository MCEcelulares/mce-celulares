import { Categoria } from './Categoria';
import { Marca } from './Marca';
import { Produto } from './Produto';
import { ReservaEstoque } from './ReservaEstoque';

Categoria.hasMany(Produto, { foreignKey: 'id_categoria', as: 'produtos' });
Produto.belongsTo(Categoria, { foreignKey: 'id_categoria', as: 'categoria' });

Marca.hasMany(Produto, { foreignKey: 'id_marca', as: 'produtos' });
Produto.belongsTo(Marca, { foreignKey: 'id_marca', as: 'marca' });

Produto.hasMany(ReservaEstoque, { foreignKey: 'id_produto' });
ReservaEstoque.belongsTo(Produto, { foreignKey: 'id_produto' });

export { Categoria, Marca, Produto, ReservaEstoque };
