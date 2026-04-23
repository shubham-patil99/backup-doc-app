'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ✅ Add docType column to sections table
    await queryInterface.addColumn("sections", "doc_type", {
      type: Sequelize.ENUM("full", "small", "proposal"),
      allowNull: false,
      defaultValue: "full",  // Default existing sections to "full"
    });

    console.log("✅ Added doc_type column to sections table with default value 'full'");
  },

  down: async (queryInterface) => {
    // Remove column and enum type on rollback
    await queryInterface.removeColumn("sections", "doc_type");
    console.log("❌ Removed doc_type column from sections table");
  },
};
