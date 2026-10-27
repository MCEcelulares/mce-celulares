import { Categoria } from './Categoria';
import { Marca } from './Marca';
import { Produto } from './Produto';

Marca.hasMany(Produto, { foreignKey: 'id_marca' });
Produto.belongsTo(Marca, { foreignKey: 'id_marca', as: 'marca' });

Categoria.hasMany(Produto, { foreignKey: 'id_categoria' });
Produto.belongsTo(Categoria, { foreignKey: 'id_categoria', as: 'categoria' });

export { Categoria, Marca, Produto };
