const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Module = sequelize.define('Module', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,   // <--- ensure full HTML is stored
    allowNull: true,
  },
  sectionId: {
    type: DataTypes.INTEGER,
    field: 'section_id', // maps to DB column
  },
  createdBy: {
    type: DataTypes.INTEGER,
    field: 'created_by', // maps to DB column
  },
  canEdit: {
    type: DataTypes.BOOLEAN,
    field: 'can_edit',
    defaultValue: false, // default to false
    allowNull: false,
  },
    sortOrder: {
   type: DataTypes.INTEGER,
   field: 'sortorder',
   allowNull: false,
   defaultValue: 0,
  },
}, {
  tableName: 'modules',
  timestamps: true,
});

module.exports = Module;
