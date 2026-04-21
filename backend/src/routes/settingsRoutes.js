// @ts-nocheck
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ── Multer configuration for file uploads ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Temporary directory for uploads
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
    
    // Check if logo exists
    if (!fs.existsSync(logoPath)) {
      return res.json({ logoUrl: null, message: "No logo found" });
    }

    // Return URL to logo (frontend will fetch from /uploads/assets/hpe-logo.png or similar)
    res.json({
      logoUrl: "/api/settings/logo/file", // Endpoint to serve the actual file
    });
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
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate file type (logo should be image only)
    if (!["image/png", "image/jpeg"].includes(req.file.mimetype)) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: "Only PNG and JPG files allowed for logo" });
    }

    // Ensure assets directory exists
    const assetsDir = path.join(__dirname, "../assets");
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Target path for logo
    const logoPath = path.join(assetsDir, "hpe-logo.png");

    // Move file to assets folder
    fs.renameSync(tempFilePath, logoPath);

    console.log("[settingsController] Logo updated:", logoPath);

    res.json({
      success: true,
      logoUrl: "/api/settings/logo/file",
      message: "Logo uploaded successfully",
    });
  } catch (err) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    console.error("[settingsController] POST /logo error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET: List available templates ────────────────────────────────────────────
router.get("/templates", async (req, res) => {
  try {
    const templatesDir = path.join(__dirname, "../templates");

    // Check if templates directory exists
    if (!fs.existsSync(templatesDir)) {
      return res.json([]);
    }

    // Read all files in templates directory
    const files = fs.readdirSync(templatesDir);

    // Filter only DOCX and PPTX files, get file stats
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

    // Sort by update time (newest first)
    templates.sort((a, b) => b.updatedAt - a.updatedAt);

    res.json(templates);
  } catch (err) {
    console.error("[settingsController] GET /templates error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST: Upload/replace template ────────────────────────────────────────────
router.post("/templates", upload.single("template"), async (req, res) => {
  const tempFilePath = req.file?.path;
  const templateName = req.body.templateName;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!templateName) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: "Template name required" });
    }

    // Validate file type (template should be DOCX or PPTX only)
    const validMimes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (!validMimes.includes(req.file.mimetype)) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: "Only DOCX and PPTX files allowed for templates" });
    }

    // Ensure templates directory exists
    const templatesDir = path.join(__dirname, "../templates");
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    // Target path for template
    const templatePath = path.join(templatesDir, templateName);

    // Move file to templates folder (replace if exists)
    fs.renameSync(tempFilePath, templatePath);

    console.log("[settingsController] Template updated:", templatePath);

    res.json({
      success: true,
      templateName,
      message: `Template '${templateName}' updated successfully`,
    });
  } catch (err) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
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

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Delete file
    fs.unlinkSync(templatePath);

    console.log("[settingsController] Template deleted:", templatePath);

    res.json({
      success: true,
      message: `Template '${templateName}' deleted successfully`,
    });
  } catch (err) {
    console.error("[settingsController] DELETE /templates error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
