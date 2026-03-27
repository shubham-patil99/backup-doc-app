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
  compact: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false, // 👈 default value (optional)
  },
}, {
  tableName: 'sections',
  timestamps: true,
});

module.exports = Section;
