const Draft = require("../models/draft");
const Final = require("../models/final");

/**
 * ----------------------------------------
 * Utility helpers
 * ----------------------------------------
 */

// Strip dangerous / editor-only HTML but keep structure
const sanitizeHtml = (html = "") => {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// Convert editor HTML into renderable blocks
const htmlToBlocks = (html = "") => {
  if (!html) return [];

  return html
    .split(/\n{2,}/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(text => ({
      type: "paragraph",
      text,
    }));
};

// Normalize modules → blocks
const normalizeModules = (modules = []) => {
  const blocks = [];

  modules.forEach((mod, index) => {
    if (mod.name && mod.name.trim()) {
      blocks.push({
        type: "heading",
        level: 2,
        text: mod.name.trim(),
      });
    }

    const moduleBlocks = htmlToBlocks(sanitizeHtml(mod.description));
    blocks.push(...moduleBlocks);
  });

  return blocks;
};

// Normalize sections
const normalizeSections = (sections = []) => {
  return sections.map((section, index) => ({
    sectionNumber: index + 1,
    title: section.title || `Section ${index + 1}`,
    blocks: normalizeModules(section.modules),
  }));
};

/**
 * ----------------------------------------
 * GET RENDER DATA (LATEST DRAFT)
 * ----------------------------------------
 *
 * Used by:
 *  - Electron (Word COM)
 *  - Future PDF service
 */
exports.getRenderData = async (req, res) => {
  try {
    const { opeId } = req.params;

    if (!opeId) {
      return res.status(400).json({
        success: false,
        error: "opeId is required",
      });
    }

    // Always fetch latest DRAFT first
    let document = await Draft.findOne({
      where: { opeId, status: "draft" },
      order: [["version", "DESC"]],
    });

    let source = "draft";

    // Fallback to FINAL if no draft exists
    if (!document) {
      document = await Final.findOne({
        where: { opeId, status: "final" },
        order: [["version", "DESC"]],
      });
      source = "final";
    }

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "No draft or final found for this OPE ID",
      });
    }

    const content = document.content || {};
    const sections = content.documentSections || [];

    /**
     * ----------------------------------------
     * FINAL RENDER PAYLOAD
     * ----------------------------------------
     */
    const renderPayload = {
      meta: {
        opeId: document.opeId,
        version: document.version,
        status: document.status,
        source,
        generatedAt: new Date().toISOString(),
      },

      documentInfo: {
        customerName: document.customerName || "",
        partnerName: document.partnerName || "",
        customerEmail: document.customerEmail || "",
        customerAddress: document.customerAddress || "",
        sowType: document.sowType || "FULL",
        fileName: document.fileName || "",
      },

      structure: {
        hasCoverPage: true,
        hasTableOfContents: true,
        pageBreakBetweenSections: true,
      },

      sections: normalizeSections(sections),
    };

    return res.json({
      success: true,
      render: renderPayload,
    });
  } catch (error) {
    console.error("❌ RenderController Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to build render data",
      details: error.message,
    });
  }
};
