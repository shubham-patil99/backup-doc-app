const express = require("express");
const Section = require("../models/section");
const router = express.Router();
const VALID_DOC_TYPES = ["full", "small", "proposal"];

router.post("/", async (req, res) => {
  try {
    const { docType, ...rest } = req.body;

    if (!docType || !VALID_DOC_TYPES.includes(docType)) {
      return res.status(400).json({
        error: "Invalid docType. Must be 'full', 'small', or 'proposal'",
      });
    }

    const maxPos = await Section.max("position").catch(() => null);
    const nextPos = (Number.isFinite(maxPos) ? maxPos : 0) + 1;

    const payload = {
      ...rest,
      docType,
      position: nextPos,
    };

    const section = await Section.create(payload);
    res.status(201).json(section);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


router.post("/reorder", async (req, res) => {
  try {
    const { order } = req.body;

    if (!Array.isArray(order)) {
      return res.status(400).json({ error: "order must be an array of ids" });
    }

    const sequelize = Section.sequelize;

    if (!sequelize) {
      await Promise.all(
        order.map((id, idx) =>
          Section.update({ position: idx + 1 }, { where: { id } })
        )
      );
    } else {
      await sequelize.transaction(async (t) => {
        await Promise.all(
          order.map((id, idx) =>
            Section.update(
              { position: idx + 1 },
              { where: { id }, transaction: t }
            )
          )
        );
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Reorder failed:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.get("/all", async (req, res) => {
  try {
    const { docType } = req.query;

    const where = {};
    if (docType && VALID_DOC_TYPES.includes(docType)) {
      where.docType = docType;
    }

    const orderClause =
      Section?.rawAttributes?.position
        ? [["position", "ASC"]]
        : [["createdAt", "ASC"]];

    const allSections = await Section.findAll({
      where,
      order: orderClause,
    });

    res.json(allSections);
  } catch (err) {
    console.error("GET /sections/all error:", err); 
    res.status(500).json({ error: err.message });
  }
});


router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 3;
    const { docType } = req.query;

    const where = {};
    if (docType && VALID_DOC_TYPES.includes(docType)) {
      where.docType = docType;
    }

    const allSections = await Section.findAll({
      where,
      order: [["position", "ASC"]],
    });

    const totalCount = allSections.length;
    const totalPages = Math.ceil(totalCount / limit);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const paginatedSections = allSections.slice(startIndex, endIndex);

    res.json({
      data: paginatedSections,
      totalPages,
      currentPage: page,
      totalCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get("/:id", async (req, res) => {
  try {
    const section = await Section.findByPk(req.params.id);
    if (!section)
      return res.status(404).json({ error: "Section not found" });

    res.json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.put("/:id", async (req, res) => {
  try {
    const section = await Section.findByPk(req.params.id);
    if (!section)
      return res.status(404).json({ error: "Section not found" });

    const { docType } = req.body;

    // ✅ Validate docType if provided
    if (docType && !VALID_DOC_TYPES.includes(docType)) {
      return res.status(400).json({
        error: "Invalid docType. Must be 'full', 'small', or 'proposal'",
      });
    }

    await section.update(req.body);
    res.json(section);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * 🔹 Delete Section
 */
router.delete("/:id", async (req, res) => {
  try {
    const section = await Section.findByPk(req.params.id);
    if (!section)
      return res.status(404).json({ error: "Section not found" });

    await section.destroy();
    res.json({ message: "Section deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;