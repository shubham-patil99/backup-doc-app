const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

/**
 * Build a Word document entirely with Word COM (no docxtemplater)
 * 
 * Usage:
 * const blocks = [
 *   { type: "paragraph", text: "Hello world" },
 *   { type: "image", src: "http://...", width: 300, height: 200 },
 *   { type: "list", listType: "bullet", items: [{text: "Item 1"}, {text: "Item 2"}] },
 *   { type: "table", columnCount: 2, header: ["Name", "Value"], rows: [["John", "25"], ["Jane", "30"]] }
 * ];
 * 
 * const result = await buildDocumentWithWordCom(blocks, outputPath);
 */

const buildDocumentWithWordCom = (blocks, outputPath, convertToPdf = false) => {
  return new Promise((resolve, reject) => {
    try {
      // Create payload for PowerShell
      const payload = {
        blocks: blocks || [],
        outputPath: outputPath,
        convertToPdf: convertToPdf || false
      };

      // Save payload to temp file
      const tempDir = path.join(__dirname, "..", "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const payloadPath = path.join(tempDir, `payload_${Date.now()}.json`);
      fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));

      // Get PowerShell script path
      const scriptPath = path.join(__dirname, "..", "..", "..", "electron", "generate-word-com.ps1");
      
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`PowerShell script not found: ${scriptPath}`);
      }

      // Execute PowerShell script
      const command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -payloadFilePath "${payloadPath}"`;
      
      exec(command, (error, stdout, stderr) => {
        // Clean up payload file
        try {
          fs.unlinkSync(payloadPath);
        } catch (e) {
          // Ignore cleanup errors
        }

        if (error) {
          console.error("PowerShell error:", error);
          console.error("stderr:", stderr);
          return reject(new Error(`Word COM generation failed: ${error.message}`));
        }

        // Log PowerShell output for debugging
        if (stdout) {
          console.log("PowerShell output:", stdout);
        }

        // Verify output file exists
        if (!fs.existsSync(outputPath)) {
          return reject(new Error("Output document was not created"));
        }

        resolve({
          success: true,
          path: outputPath,
          size: fs.statSync(outputPath).size
        });
      });

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Convert HTML content to block array for Word COM
 * This parses sections and modules into blocks
 */
const htmlContentToBlocks = (sections, modules = null) => {
  const blocks = [];

  // If modules provided, use them directly
  if (Array.isArray(modules)) {
    modules.forEach(mod => {
      // Handle different module types
      if (mod.isParagraph && mod.text) {
        blocks.push({
          type: "paragraph",
          text: mod.text
        });
      }
      if (mod.isList && Array.isArray(mod.items)) {
        blocks.push({
          type: "list",
          listType: mod.isNumberList ? "number" : "bullet",
          items: mod.items.map(i => ({ text: i.text }))
        });
      }
      if (mod.isTable) {
        blocks.push({
          type: "table",
          columnCount: mod.columnCount || 2,
          header: mod.header || [],
          rows: mod.rows || []
        });
      }
      if (mod.isImage && mod.imageSrc) {
        blocks.push({
          type: "image",
          src: mod.imageSrc,
          width: mod.width || 300,
          height: mod.height || 200
        });
      }
    });
    return blocks;
  }

  // Parse sections
  if (Array.isArray(sections)) {
    sections.forEach(section => {
      // Add section heading
      if (section.title) {
        blocks.push({
          type: "heading",
          text: section.title
        });
      }

      // Add section description
      if (section.description) {
        blocks.push({
          type: "paragraph",
          text: section.description
        });
      }

      // Add modules
      if (Array.isArray(section.modules)) {
        section.modules.forEach(mod => {
          if (mod.isParagraph && mod.text) {
            blocks.push({
              type: "paragraph",
              text: mod.text
            });
          }
          if (mod.isList && Array.isArray(mod.items)) {
            blocks.push({
              type: "list",
              listType: mod.isNumberList ? "number" : "bullet",
              items: mod.items.map(i => ({ text: i.text }))
            });
          }
          if (mod.isTable) {
            blocks.push({
              type: "table",
              columnCount: mod.columnCount || 2,
              header: mod.header || [],
              rows: mod.rows || []
            });
          }
          if (mod.isImage && mod.imageSrc) {
            blocks.push({
              type: "image",
              src: mod.imageSrc,
              width: mod.width || 300,
              height: mod.height || 200
            });
          }
        });
      }
    });
  }

  return blocks;
};

module.exports = {
  buildDocumentWithWordCom,
  htmlContentToBlocks
};
