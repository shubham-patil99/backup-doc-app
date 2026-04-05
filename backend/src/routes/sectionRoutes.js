const express = require("express");
const Section = require("../models/section");
const router = express.Router();
const VALID_DOC_TYPES = ["full", "small", "proposal"];

router.post("/", async (req, res) => {
  try {
    const { docType, docTypes, ...rest } = req.body;

    // Accept either singular docType or plural docTypes, convert to array
    let typesArray = docTypes || docType;
    
    // Handle case where array contains JSON strings
    if (Array.isArray(typesArray)) {
      typesArray = typesArray.map(item => {
        if (typeof item === 'string' && item.startsWith('[')) {
          try {
            const parsed = JSON.parse(item);
            return Array.isArray(parsed) ? parsed : item;
          } catch (e) {
            return item;
          }
        }
        return item;
      }).flat(); // Flatten in case parsing creates nested arrays
    }
    
    // Convert string to array if needed
    if (typeof typesArray === 'string') {
      if (typesArray.startsWith('[')) {
        try {
          typesArray = JSON.parse(typesArray);
        } catch (e) {
          typesArray = [typesArray];
        }
      } else {
        typesArray = [typesArray];
      }
    }
    
    if (!Array.isArray(typesArray) || typesArray.length === 0) {
      return res.status(400).json({
        error: "docTypes must be a non-empty array of doc types",
      });
    }

    const invalid = VALID_DOC_TYPES ? typesArray.filter(t => !VALID_DOC_TYPES.includes(t)) : [];
    if (invalid.length > 0) {
      return res.status(400).json({
        error: `Invalid docTypes: ${invalid.join(', ')}. Must be from: ${VALID_DOC_TYPES.join(', ')}`,
      });
    }

    // Remove duplicates
    const uniqueTypes = [...new Set(typesArray)];

    const maxPos = await Section.max("position").catch(() => null);
    const nextPos = (Number.isFinite(maxPos) ? maxPos : 0) + 1;

    const payload = {
      ...rest,
      docType: uniqueTypes,
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

    const orderClause =
      Section?.rawAttributes?.position
        ? [["position", "ASC"]]
        : [["createdAt", "ASC"]];

    let allSections = await Section.findAll({
      order: orderClause,
    });

    // Filter by docType if specified (check if docType is in the array)
    if (docType && typeof docType === 'string') {
      allSections = allSections.filter(section => {
        const types = Array.isArray(section.docType) ? section.docType : [section.docType];
        return types.includes(docType);
      });
    }

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

    const orderClause =
      Section?.rawAttributes?.position
        ? [["position", "ASC"]]
        : [["createdAt", "ASC"]];

    let allSections = await Section.findAll({
      order: orderClause,
    });

    // Filter by docType if specified (check if docType is in the array)
    if (docType && typeof docType === 'string') {
      allSections = allSections.filter(section => {
        const types = Array.isArray(section.docType) ? section.docType : [section.docType];
        return types.includes(docType);
      });
    }

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

    const { docType, docTypes } = req.body;
    console.log("[PUT /sections/:id] Received docType:", docType, "docTypes:", docTypes);

    // Validate docType/docTypes if provided
    if (docType !== undefined || docTypes !== undefined) {
      let typesArray = docTypes || docType;
      console.log("[PUT /sections/:id] Initial typesArray:", typesArray, "Type:", typeof typesArray);
      
      // Handle case where array contains JSON strings (e.g., from client parsing)
      if (Array.isArray(typesArray)) {
        typesArray = typesArray.map(item => {
          if (typeof item === 'string' && item.startsWith('[')) {
            try {
              const parsed = JSON.parse(item);
              return Array.isArray(parsed) ? parsed : item;
            } catch (e) {
              return item;
            }
          }
          return item;
        }).flat(); // Flatten in case parsing creates nested arrays
      }
      
      // Convert string to array if needed
      if (typeof typesArray === 'string') {
        if (typesArray.startsWith('[')) {
          try {
            typesArray = JSON.parse(typesArray);
          } catch (e) {
            typesArray = [typesArray];
          }
        } else {
          typesArray = [typesArray];
        }
      }
      
      if (!Array.isArray(typesArray) || typesArray.length === 0) {
        console.error("[PUT /sections/:id] Not an array or empty:", typesArray);
        return res.status(400).json({
          error: "docTypes must be a non-empty array of doc types",
        });
      }

      const VALID_DOC_TYPES = ["full", "small", "proposal"];
      const invalid = typesArray.filter(t => !VALID_DOC_TYPES.includes(t));
      if (invalid.length > 0) {
        console.error("[PUT /sections/:id] Invalid doc types:", invalid);
        return res.status(400).json({
          error: `Invalid docTypes: ${invalid.join(', ')}. Must be from: ${VALID_DOC_TYPES.join(', ')}`,
        });
      }

      // Remove duplicates
      const uniqueTypes = [...new Set(typesArray)];
      console.log("[PUT /sections/:id] Final uniqueTypes:", uniqueTypes);
      
      // Update the request body to use the processed array
      req.body.docType = uniqueTypes;
      delete req.body.docTypes;
    }

    await section.update(req.body);
    console.log("[PUT /sections/:id] Section updated successfully");
    res.json(section);
  } catch (err) {
    console.error("[PUT /sections/:id] Error:", err.message);
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