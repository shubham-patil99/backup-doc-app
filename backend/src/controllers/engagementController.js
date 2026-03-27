const HpeNonstopTeam = require('../models/hpeNonstopTeam');

// Get all unique roles
exports.getRoles = async (req, res) => {
  try {
    const roles = await HpeNonstopTeam.aggregate("team_type", "DISTINCT", { plain: false });
    res.json({ success: true, roles: roles.map(r => r.DISTINCT) });
    console.log("🎯 getRoles hit");
  } catch (err) {
    console.error("Error fetching roles:", err);
    res.status(500).json({ success: false, error: "Failed to fetch roles" });
  }
};

// Get names by role (with optional search query)
exports.getNamesByRole = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { role, query } = req.query;

    if (!role) {
      return res.status(400).json({ success: false, error: "Role is required" });
    }

    const where = { teamType: role };
    if (query) {
      where.memberName = { [require("sequelize").Op.iLike]: `%${query}%` };
    }

    const members = await HpeNonstopTeam.findAll({
      where,
      attributes: ["id", "memberName", "email"],
      order: [["memberName", "ASC"]],
    });
    console.log("🎯 getNamesByRole hit");
    res.json({ success: true, members });
  } catch (err) {
    console.error("Error fetching members:", err);
    res.status(500).json({ success: false, error: "Failed to fetch members" });
  }
};

exports.searchMembers = async (req, res) => {
  try {
    const { query } = req.query;
    const where = {};
    if (query) {
      const { Op } = require("sequelize");
      where[Op.or] = [
        { memberName: { [Op.iLike]: `%${query}%` } },
        { email: { [Op.iLike]: `%${query}%` } },
      ];
    }
    const members = await HpeNonstopTeam.findAll({
      where,
      attributes: ["id", "memberName", "email"],
      order: [["memberName", "ASC"]],
      limit: 10
    });
    res.json({ success: true, results: members }); // frontend expects `results`
  } catch (err) {
    console.error("Error searching members:", err);
    res.status(500).json({ success: false, error: "Failed to search members" });
  }
};


// Add new engagement resource
exports.addResource = async (req, res) => {
  try {
    const { teamType, memberName, email } = req.body;

    if (!teamType || !memberName) {
      return res.status(400).json({ success: false, error: "Role and member name are required" });
    }

    const newMember = await HpeNonstopTeam.create({
      teamType,
      memberName,
      email: email || null,
    });

    res.json({ success: true, message: "Resource added successfully", data: newMember });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to add resource" });
  }
};

// Delete resource by ID
exports.deleteResource = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await HpeNonstopTeam.destroy({ where: { id } });

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Resource not found" });
    }

    res.json({ success: true, message: "Resource deleted successfully" });
  } catch (err) {
    console.error("Error deleting resource:", err);
    res.status(500).json({ success: false, error: "Failed to delete resource" });
  }
};

// Update resource by ID
exports.updateResource = async (req, res) => {
  try {
    const { id } = req.params;
    const { teamType, memberName, email } = req.body;

    if (!teamType || !memberName) {
      return res.status(400).json({ success: false, error: "Role and member name are required" });
    }

    const updated = await HpeNonstopTeam.update(
      { teamType, memberName, email: email || null },
      { where: { id }, returning: true }
    );

    if (updated[0] === 0) {
      return res.status(404).json({ success: false, error: "Resource not found" });
    }

    res.json({ success: true, message: "Resource updated successfully", data: updated[1][0] });
  } catch (err) {
    console.error("Error updating resource:", err);
    res.status(500).json({ success: false, error: "Failed to update resource" });
  }
};