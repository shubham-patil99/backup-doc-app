const express = require("express");
const router = express.Router();
const UserModulePermission = require("../models/userModulePermission");
const User = require("../models/user");
const Module = require("../models/module");

// ----------------------------
// Assign or update a module for a user
// ----------------------------
router.post("/", async (req, res) => {
  try {
    const { user_id, module_id, can_edit } = req.body;

    if (!user_id || !module_id) {
      return res.status(400).json({ message: "user_id and module_id are required" });
    }

    let permission = await UserModulePermission.findOne({ where: { user_id, module_id } });

    if (permission) {
      // Update existing permission
      permission.can_edit = can_edit !== undefined ? can_edit : permission.can_edit;
      await permission.save();
    } else {
      // Create new permission
      permission = await UserModulePermission.create({
        user_id,
        module_id,
        can_edit: !!can_edit,
      });
    }

    return res.json({ message: "Permission assigned/updated successfully", permission });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ----------------------------
// Get all permissions
// ----------------------------
router.get("/", async (req, res) => {
  try {
    const permissions = await UserModulePermission.findAll({
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email"] },
        { model: Module, as: "module", attributes: ["id", "name", "section_id"] },
      ],
    });

    res.json(permissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ----------------------------
// Get all modules assigned to a specific user
// ----------------------------
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const permissions = await UserModulePermission.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Module,
          as: "module",
          attributes: ["id", "name", "description", "section_id", "created_by"],
        },
      ],
    });

    // ✅ Include can_edit along with module details
    const assignedModules = permissions.map((p) => ({
      ...p.module.get({ plain: true }),
      editable: p.can_edit, // renamed for frontend clarity
    }));

    res.json(assignedModules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ----------------------------
// Delete a permission
// ----------------------------
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await UserModulePermission.destroy({ where: { id } });

    if (deleted) {
      res.json({ message: "Permission deleted successfully" });
    } else {
      res.status(404).json({ message: "Permission not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
