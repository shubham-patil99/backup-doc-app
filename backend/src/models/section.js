const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Section = sequelize.define('Section', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  docType: {
    type: DataTypes.ENUM("full", "small", "proposal"),
    allowNull: false,
  },
}, {
  tableName: 'sections',
  timestamps: true,
});

module.exports = Section;
