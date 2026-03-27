'use strict';

const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const db = {};

// Import models
db.Role = require('./role');
db.User = require('./user');
// db.Document = require('./document');
db.Section = require('./section');
db.Module = require('./module');
db.Draft = require('./draft');

// Associations

// Role ↔ User
db.User.belongsTo(db.Role, { foreignKey: 'role_id' });
db.Role.hasMany(db.User, { foreignKey: 'role_id' });

// Draft ↔ User
db.Draft.belongsTo(db.User, { foreignKey: "userId", as: "user" });
db.User.hasMany(db.Draft, { foreignKey: "userId", as: "drafts" });

// Final ↔ User
db.Final = require('./final'); // Make sure Final is imported!
db.Final.belongsTo(db.User, { foreignKey: "userId", as: "user" });
db.User.hasMany(db.Final, { foreignKey: "userId", as: "finals" });

// User ↔ Document
// db.Document.belongsTo(db.User, { as: 'creator', foreignKey: 'created_by' });
// db.User.hasMany(db.Document, { as: 'documents', foreignKey: 'created_by' });

// Document ↔ Section
// db.Document.hasMany(db.Section, { as: 'sections', foreignKey: 'document_id', onDelete: 'CASCADE' });
// db.Section.belongsTo(db.Document, { as: 'document', foreignKey: 'document_id' });

// Section ↔ Module
db.Section.hasMany(db.Module, { as: 'modules', foreignKey: 'section_id', onDelete: 'CASCADE' });
db.Module.belongsTo(db.Section, { as: 'section', foreignKey: 'section_id' });

// User ↔ Module
db.Module.belongsTo(db.User, { as: 'creator', foreignKey: 'created_by' });
db.User.hasMany(db.Module, { as: 'modules', foreignKey: 'created_by' });

// Export
db.sequelize = sequelize;
db.Sequelize = require('sequelize');

module.exports = db;
