const express = require("express");
const path = require("path");
const fs = require("fs");
const { templateName } = require("../config/template.config");
const { templateVersion } = require("../config/template.config");

const router = express.Router();

router.get("/word-template", (req, res) => {
  const templatePath = path.join(
    __dirname,
    "..",
    "templates",
    templateName
  );

  console.log("📄 Template path:", templatePath);

  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({
      message: "Word template not found",
      templateName,
      path: templatePath
    });
  }

  res.download(templatePath, templateName);
});

router.get("/word-template/meta", (req, res) => {
  const templatePath = path.join(
    __dirname,
    "..",
    "templates",
    templateName
  );

  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({
      message: "Word template not found"
    });
  }

  const stats = fs.statSync(templatePath);

  res.json({
    templateName,
    templateVersion,
    lastModified: stats.mtime.toISOString()
  });
});

module.exports = router;
