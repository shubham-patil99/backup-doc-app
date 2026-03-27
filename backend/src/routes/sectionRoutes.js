const express = require("express");
const Section = require("../models/section");

const router = express.Router();

// Create Section
router.post("/", async (req, res) => {
  try {
    // compute next position (best-effort)
    const maxPos = await Section.max('position').catch(() => null);
    const nextPos = (Number.isFinite(maxPos) ? maxPos : 0) + 1;
    const payload = { ...req.body, position: nextPos };
    const section = await Section.create(payload);
    res.status(201).json(section);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /reorder - persist sections order
router.post("/reorder", async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order))
      return res.status(400).json({ error: "order must be an array of ids" });

    const sequelize = Section.sequelize;
    if (!sequelize) {
      await Promise.all(order.map((id, idx) =>
        Section.update({ position: idx + 1 }, { where: { id } })
      ));
    } else {
      await sequelize.transaction(async (t) => {
        await Promise.all(
          order.map((id, idx) =>
            Section.update({ position: idx + 1 }, { where: { id }, transaction: t })
          )
        );
      });
    }

    res.json({ success: true }); // ✅ add this line
  } catch (err) {
    console.error("Reorder failed:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Get ALL Sections without pagination
router.get("/all", async (req, res) => {
  try {
    // prefer ordering by position if column exists
    const orderClause = (Section && Section.rawAttributes && Section.rawAttributes.position)
      ? [['position', 'ASC']]
      : [['createdAt', 'ASC']];
    const allSections = await Section.findAll({ order: orderClause });
    res.json(allSections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Sections with Pagination
// Get Sections with Pagination (return all sections but include pagination info)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // default page = 1
    const limit = parseInt(req.query.limit) || 3; // default 3 per page

    // Fetch all sections
    const allSections = await Section.findAll({
      order: [["createdAt", "ASC"]],
    });

    const totalCount = allSections.length;
    const totalPages = Math.ceil(totalCount / limit);

    // Slice the data for the requested page
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedSections = allSections.slice(startIndex, endIndex);

    res.json({
      data: paginatedSections, // only send current page slice
      totalPages,
      currentPage: page,
      totalCount,
    });
  } catch (err) { 
    
    res.status(500).json({ error: err.message });
  }
});

// Get Section by ID
router.get("/:id", async (req, res) => {
  try {
    const section = await Section.findByPk(req.params.id);
    if (!section) return res.status(404).json({ error: "Section not found" });
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Section
router.put("/:id", async (req, res) => {
  try {
    const section = await Section.findByPk(req.params.id);
    if (!section) return res.status(404).json({ error: "Section not found" });
    await section.update(req.body);
    res.json(section);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Section
router.delete("/:id", async (req, res) => {
  try {
    const section = await Section.findByPk(req.params.id);
    if (!section) return res.status(404).json({ error: "Section not found" });
    await section.destroy();
    res.json({ message: "Section deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
