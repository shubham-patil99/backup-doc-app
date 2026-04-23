'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Change docType column from ENUM to JSON
    // This allows storing multiple doc types like ["full", "small", "proposal"]
    await queryInterface.changeColumn('sections', 'docType', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: ["full"], // Default to ["full"] for existing behavior
      comment: 'Array of document types: ["full", "small", "proposal"]'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Rollback: change back to ENUM
    // This will convert the first element of arrays back to the original ENUM value
    await queryInterface.changeColumn('sections', 'docType', {
      type: Sequelize.ENUM("full", "small", "proposal"),
      allowNull: false,
    });
  }
};
