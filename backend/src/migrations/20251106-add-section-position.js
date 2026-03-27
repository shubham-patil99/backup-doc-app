'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("sections", "position", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });

    // initialize positions based on createdAt ordering
    const [rows] = await queryInterface.sequelize.query(
      `SELECT id FROM "sections" ORDER BY "createdAt" ASC`
    );
    for (let i = 0; i < rows.length; i++) {
      const id = rows[i].id;
      await queryInterface.sequelize.query(
        `UPDATE "sections" SET position = ${i + 1} WHERE id = ${id}`
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("sections", "position");
  },
};