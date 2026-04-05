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
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: ["full"],
    validate: {
      isValidDocTypes(value) {
        // Handle JSON string that might come from database
        let docTypesArray = value;
        if (typeof value === 'string') {
          try {
            docTypesArray = JSON.parse(value);
          } catch (e) {
            throw new Error('docType must be a valid JSON array');
          }
        }
        
        if (!Array.isArray(docTypesArray)) {
          throw new Error('docType must be an array');
        }
        
        if (docTypesArray.length === 0) {
          throw new Error('docType array cannot be empty');
        }
        
        const valid = ["full", "small", "proposal"];
        const invalid = docTypesArray.filter(v => !valid.includes(v));
        if (invalid.length > 0) {
          throw new Error(`Invalid docType values: ${invalid.join(', ')}. Must be from: ${valid.join(', ')}`);
        }
      }
    }
  },
}, {
  tableName: 'sections',
  timestamps: true,
});

module.exports = Section;
