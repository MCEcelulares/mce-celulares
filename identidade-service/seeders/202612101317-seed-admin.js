'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  up: async (queryInterface) => {
    const { QueryTypes } = queryInterface.sequelize;
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const senha = process.env.ADMIN_SENHA;

    if (!email || !senha) {
      console.log('[seed-admin] ADMIN_EMAIL/ADMIN_SENHA não definidos no .env — nenhum admin criado');
      return;
    }

    const existente = await queryInterface.sequelize.query(
      'SELECT id_usuario FROM usuario WHERE email = :email',
      { replacements: { email }, type: QueryTypes.SELECT }
    );
    if (existente.length > 0) {
      console.log(`[seed-admin] ${email} já existe — nada a fazer`);
      return;
    }

    await queryInterface.bulkInsert('usuario', [{
      nome: 'Administrador',
      email,
      senha: await bcrypt.hash(senha, 10),
      admin: true,
      ativo: true,
      provedor: 'local',
      email_verificado: true,
    }]);

    const [usuario] = await queryInterface.sequelize.query(
      'SELECT id_usuario FROM usuario WHERE email = :email',
      { replacements: { email }, type: QueryTypes.SELECT }
    );
    const [cargo] = await queryInterface.sequelize.query(
      "SELECT id_cargo FROM cargo WHERE nome = 'administrador'",
      { type: QueryTypes.SELECT }
    );

    await queryInterface.bulkInsert(
      'usuario_cargo',
      [{ id_usuario: usuario.id_usuario, id_cargo: cargo.id_cargo }],
      { ignoreDuplicates: true }
    );
    console.log(`[seed-admin] administrador criado: ${email}`);
  },

  down: async (queryInterface) => {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!email) return;
    await queryInterface.sequelize.query(
      'DELETE uc FROM usuario_cargo uc JOIN usuario u ON u.id_usuario = uc.id_usuario WHERE u.email = :email',
      { replacements: { email } }
    );
    await queryInterface.bulkDelete('usuario', { email });
  },
};
