const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const HpeNonstopTeam = sequelize.define("HpeNonstopTeam", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  teamType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: "team_type",
  },
  memberName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: "member_name",
  },
    email: {
    type: DataTypes.STRING(255),
    allowNull: true,   // allow null for now if not all rows have emails
    field: "email",
  },
}, {
  tableName: "hpe_nonstop_team",
  timestamps: false,   // ✅ No createdAt/updatedAt in our SQL table
  underscored: true,
});

module.exports = HpeNonstopTeam;
