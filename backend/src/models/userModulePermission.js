const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");
const Module = require("./module");

const UserModulePermission = sequelize.define(
  "UserModulePermission",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    module_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Module,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    can_edit: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "user_module_permissions",
    underscored: true,
    timestamps: true,
  }
);

// Associations for easier includes in queries
UserModulePermission.belongsTo(User, { foreignKey: "user_id", as: "user" });
UserModulePermission.belongsTo(Module, { foreignKey: "module_id", as: "module" });

module.exports = UserModulePermission;
