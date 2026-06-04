const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Final = sequelize.define("Final", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: "user_id",
  },
  opeId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: "ope_id",
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: "customer_name",
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    field: "customer_email",
  },
  partnerName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: "partner_name",
  },
  modifiedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: "modified_by",
  },
  customerAddress: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: "customer_address",
  },

  engagementResources: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: "engagement_resources",
    defaultValue: [],
  },

  sowType: {
    type: DataTypes.STRING,
    allowNull: true,
    field: "sow_type",    // FULL or SMALL
  },

  content: {
    type: DataTypes.JSONB,
    allowNull: false,
  },

  status: {
    type: DataTypes.STRING,
    defaultValue: "draft",
  },

  expiresAt: {
    type: DataTypes.DATE,
    field: "expires_at",
    allowNull: true,
  },

  version: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },

  fileName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: "file_name"
  },
  quoteId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: "quote_id",
  },
  hpeLegalEntity: {
    type: DataTypes.STRING,
    allowNull: true,
    field: "hpe_legal_entity",
  },
}, {
  tableName: "finals",
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['ope_id', 'sow_type', 'version']  // ✅ Separate version streams by sowType
    }
  ]
});

module.exports = Final;
