// @ts-nocheck
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { mergeTemplates } = require("../migrations/templateMigration"); // adjust path as needed

// ── Multer configuration for file uploads ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../temp/uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/png",
      "image/jpeg",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// ── GET: Retrieve current logo URL ───────────────────────────────────────────
router.get("/logo", async (req, res) => {
  try {
    const logoPath = path.join(__dirname, "../assets/hpe-logo.png");
    if (!fs.existsSync(logoPath)) {
      return res.json({ logoUrl: null, message: "No logo found" });
    }
    res.json({ logoUrl: "/api/settings/logo/file" });
  } catch (err) {
    console.error("[settingsController] GET /logo error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET: Serve logo file ─────────────────────────────────────────────────────
router.get("/logo/file", async (req, res) => {
  try {
    const logoPath = path.join(__dirname, "../assets/hpe-logo.png");
    if (!fs.existsSync(logoPath)) {
      return res.status(404).json({ error: "Logo not found" });
    }
    res.sendFile(logoPath);
  } catch (err) {
    console.error("[settingsController] GET /logo/file error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST: Upload/replace logo ────────────────────────────────────────────────
router.post("/logo", upload.single("logo"), async (req, res) => {
  const tempFilePath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    if (!["image/png", "image/jpeg"].includes(req.file.mimetype)) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: "Only PNG and JPG files allowed for logo" });
    }

    const assetsDir = path.join(__dirname, "../assets");
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const logoPath = path.join(assetsDir, "hpe-logo.png");
    fs.renameSync(tempFilePath, logoPath);

    console.log("[settingsController] Logo updated:", logoPath);
    res.json({ success: true, logoUrl: "/api/settings/logo/file", message: "Logo uploaded successfully" });
  } catch (err) {
    if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    console.error("[settingsController] POST /logo error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET: List available templates ────────────────────────────────────────────
router.get("/templates", async (req, res) => {
  try {
    const templatesDir = path.join(__dirname, "../templates");
    if (!fs.existsSync(templatesDir)) return res.json([]);

    const files = fs.readdirSync(templatesDir);
    const templates = files
      .filter((file) => file.endsWith(".docx") || file.endsWith(".pptx"))
      .map((file) => {
        const filePath = path.join(templatesDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          type: file.endsWith(".docx") ? "docx" : "pptx",
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        };
      });

    templates.sort((a, b) => b.updatedAt - a.updatedAt);
    res.json(templates);
  } catch (err) {
    console.error("[settingsController] GET /templates error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET: Download a template file ────────────────────────────────────────────
router.get("/templates/:templateName/download/?", async (req, res) => {
  try {
    const templateName = req.params.templateName;
    const templatesDir = path.join(__dirname, "../templates");
    const templatePath = path.join(templatesDir, templateName);

    // Security: prevent directory traversal
    if (!templatePath.startsWith(templatesDir)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.download(templatePath, templateName);
  } catch (err) {
    console.error("[settingsController] GET /templates/:name/download error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST: Upload/replace template (with content migration) ───────────────────
router.post("/templates", upload.single("template"), async (req, res) => {
  const tempFilePath = req.file?.path;
  const templateName = req.body.templateName;

  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!templateName) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: "Template name required" });
    }

    const validMimes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (!validMimes.includes(req.file.mimetype)) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: "Only DOCX and PPTX files allowed for templates" });
    }

    const templatesDir = path.join(__dirname, "../templates");
    if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });

    const existingTemplatePath = path.join(templatesDir, templateName);
    const finalTemplatePath = path.join(templatesDir, templateName);

    // ── Content migration for DOCX ──────────────────────────────────────────
    // If an old template exists, extract its content and merge into the new one.
    // For PPTX or when there's no existing template, just copy the new file.
    if (fs.existsSync(existingTemplatePath) && templateName.endsWith(".docx")) {
      console.log("[settingsController] Merging content from old → new template:", templateName);

      // Backup old template just in case
      const backupPath = existingTemplatePath + ".bak";
      fs.copyFileSync(existingTemplatePath, backupPath);

      try {
        await mergeTemplates(existingTemplatePath, tempFilePath, finalTemplatePath);
        // Clean up temp upload
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        // Remove backup on success
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
        console.log("[settingsController] Template merge successful:", finalTemplatePath);
      } catch (mergeErr) {
        // If merge fails, fall back to plain replacement and restore backup
        console.error("[settingsController] Merge failed, falling back to plain replace:", mergeErr);
        if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, existingTemplatePath);
        fs.renameSync(tempFilePath, finalTemplatePath);
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      }
    } else {
      // No existing template or PPTX → just move the uploaded file
      fs.renameSync(tempFilePath, finalTemplatePath);
    }

    console.log("[settingsController] Template updated:", finalTemplatePath);
    res.json({
      success: true,
      templateName,
      message: `Template '${templateName}' updated successfully`,
    });
  } catch (err) {
    if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    console.error("[settingsController] POST /templates error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE: Remove template ──────────────────────────────────────────────────
router.delete("/templates/:templateName", async (req, res) => {
  try {
    const templateName = req.params.templateName;
    const templatesDir = path.join(__dirname, "../templates");
    const templatePath = path.join(templatesDir, templateName);

    // Security: Prevent directory traversal
    if (!templatePath.startsWith(templatesDir)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: "Template not found" });
    }

    fs.unlinkSync(templatePath);
    console.log("[settingsController] Template deleted:", templatePath);
    res.json({ success: true, message: `Template '${templateName}' deleted successfully` });
  } catch (err) {
    console.error("[settingsController] DELETE /templates error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;