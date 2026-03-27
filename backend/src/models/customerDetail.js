// models/CustomerDetail.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CustomerDetail = sequelize.define(
  "CustomerDetail",
  {
    tblRid: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "tbl_rid", // maps to DB column
    },
    customerNo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "customer_no",
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "customer_name",
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "country",
    },
    siteId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "site_id",
    },
  },
  {
    tableName: "customer_details", // DB table
    timestamps: false,             // if no createdAt/updatedAt
    underscored: true,
  }
);

module.exports = CustomerDetail;
