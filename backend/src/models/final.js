const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Final = sequelize.define(
  "Final",
  {
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
    documentName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "file_name",
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
      field: "sow_type",
      defaultValue: "FULL", // FULL or SMALL
    },
    content: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "final",
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "file_name",
    },
    quoteId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "quote_id",
    },
  },
  {
    tableName: "finals",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["ope_id", "version"],
      },
    ],
  },
);

module.exports = Final;
