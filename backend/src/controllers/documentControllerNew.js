/**
 * ENTERPRISE DOCUMENT CONTROLLER (Word COM-based)
 * Generates documents using Word COM instead of docxtemplater
 * Direct conversion to JSON blocks, no intermediate DOCX
 */

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const nodemailer = require("nodemailer");
const Draft = require("../models/draft");
const { buildDocumentBlocks, htmlToPlainText } = require("../services/blockGenerator");

/**
 * Clean filename for download
 */
const sanitizeFileName = (name) => {
  return name.replace(/[\/\\?%*:|"<>]/g, "_").substring(0, 200);
};

/**
 * Main document generation endpoint
 * POST /api/generate-document/:opeId
 * Query: ?type=docx|pdf
 * Body: { status, docVersion, customerName, partnerName, ... }
 */
const generateDocument = async (req, res) => {
  try {
    const { opeId } = req.params;
    const type = req.query.type || "docx";
    const status = req.body.status || "draft";
    const docVersion = parseInt(req.body.docVersion || 1);

    const isPreview = req.query.preview === "true";
    const sendEmail = req.query.send === "true";

    const {
      customerName,
      customerEmail,
      customerAddress,
      partnerName,
      sections: reqSections,
      assigned: reqAssigned,
      documentTitle,
      createdAtFormatted,
      sowType = "SMALL"
    } = req.body || {};

    console.log(`[${opeId}] Generating ${status} document v${docVersion}`);

    // Load draft from database
    const draft = await Draft.findOne({ where: { opeId } });
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }

    // Get data from request or draft
    let sections = reqSections || draft.content?.body?.sections || [];
    let assignedRaw = reqAssigned || draft.content?.body?.assigned || {};

    if (!Array.isArray(sections)) sections = [];
    if (typeof assignedRaw !== 'object') assignedRaw = {};

    // Build metadata
    const metadata = {
      customerName: customerName || draft.customerName || "",
      customerEmail: customerEmail || draft.customerEmail || "",
      customerAddress: customerAddress || draft.customerAddress || "",
      partnerName: partnerName || draft.partnerName || "",
      opeId: opeId || draft.opeId || "",
      documentTitle: documentTitle || draft.documentName || draft.content?.title || "Document",
      date: createdAtFormatted || new Date().toLocaleDateString(),
      documentStatus: status.toUpperCase(),
      sowType: sowType,
      docVersion: docVersion
    };

    // Convert content to blocks for Word COM
    const blocks = buildDocumentBlocks(sections, assignedRaw, metadata);

    console.log(`[${opeId}] Generated ${blocks.length} blocks`);

    if (isPreview) {
      // For preview, just return blocks (Electron won't process)
      return res.json({
        success: true,
        blocks: blocks,
        message: "Preview data ready"
      });
    }

    // For actual document generation, call Electron/PowerShell
    return generateDocumentWithWordCom(
      blocks,
      opeId,
      metadata,
      type,
      sendEmail,
      req,
      res
    );

  } catch (error) {
    console.error("[ERROR] Document generation failed:", error);
    return res.status(500).json({
      error: "Failed to generate document",
      details: error.message
    });
  }
};

/**
 * Generate document using Word COM (calls PowerShell)
 */
const generateDocumentWithWordCom = async (
  blocks,
  opeId,
  metadata,
  type,
  sendEmail,
  req,
  res
) => {
  try {
    const { customerName, partnerName, documentTitle, docVersion, documentStatus } = metadata;

    // Create output filename
    const idPart = opeId || documentTitle || `DOC-${Date.now()}`;
    const formattedName = partnerName && partnerName.trim()
      ? `${idPart} - HPE SOW to ${partnerName} for ${customerName}_${documentStatus}_v${docVersion}`
      : `${idPart} - HPE SOW for ${customerName}_${documentStatus}_v${docVersion}`;
    const sanitizedFileName = sanitizeFileName(formattedName);

    // Create temp directory
    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create output paths
    const tempDocxPath = path.join(tempDir, `temp_${Date.now()}.docx`);
    const tempPdfPath = tempDocxPath.replace(/\.docx$/, ".pdf");
    const finalPath = type === "pdf" ? tempPdfPath : tempDocxPath;

    // Create payload for PowerShell
    const payload = {
      blocks: blocks,
      outputPath: finalPath,
      convertToPdf: type === "pdf",
      metadata: metadata
    };

    const payloadPath = path.join(tempDir, `payload_${Date.now()}.json`);
    fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));

    console.log(`[${opeId}] Calling PowerShell to build document...`);

    // Execute PowerShell script
    // Path from src/controllers up to root: ../../.. then to electron/
    const scriptPath = path.join(__dirname, "../../../electron/generate-word-com.ps1");

    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({
        error: "PowerShell script not found",
        path: scriptPath
      });
    }

    const command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -payloadFilePath "${payloadPath}"`;

    exec(command, async (error, stdout, stderr) => {
      // Log PowerShell output for debugging
      if (stdout) {
        console.log(`[${opeId}] PowerShell stdout:`, stdout);
      }
      if (stderr) {
        console.error(`[${opeId}] PowerShell stderr:`, stderr);
      }

      // Cleanup payload
      try {
        fs.unlinkSync(payloadPath);
      } catch (e) {
        // Ignore cleanup errors
      }

      if (error) {
        console.error(`[${opeId}] PowerShell error:`, error.message);
        console.error(`[${opeId}] Error code:`, error.code);

        // Cleanup temp files
        try {
          fs.unlinkSync(tempDocxPath);
          fs.unlinkSync(tempPdfPath);
        } catch (e) {
          // Ignore
        }

        return res.status(500).json({
          error: "Failed to generate document with Word COM",
          details: stderr || error.message,
          stdout: stdout
        });
      }

      // Verify output file was created
      if (!fs.existsSync(finalPath)) {
        console.error(`[${opeId}] Output file not created: ${finalPath}`);
        return res.status(500).json({
          error: "Document file was not created"
        });
      }

      console.log(`[${opeId}] Document created successfully: ${finalPath}`);

      try {
        // Handle email or download
        if (sendEmail) {
          await sendDocumentViaEmail(finalPath, sanitizedFileName, type, req, metadata);
          
          // Cleanup temp files
          try {
            fs.unlinkSync(tempDocxPath);
            if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
          } catch (e) {
            // Ignore
          }

          return res.json({
            success: true,
            message: "Email sent successfully"
          });
        } else {
          // Send file as download
          const fileBuffer = fs.readFileSync(finalPath);

          if (type === "pdf") {
            res.setHeader("Content-Type", "application/pdf");
          } else {
            res.setHeader(
              "Content-Type",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            );
          }

          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${sanitizedFileName}.${type}"`
          );
          res.send(fileBuffer);

          // Cleanup temp files
          setTimeout(() => {
            try {
              fs.unlinkSync(tempDocxPath);
              if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
            } catch (e) {
              // Ignore
            }
          }, 1000);
        }
      } catch (err) {
        console.error(`[${opeId}] Error handling response:`, err);
        return res.status(500).json({
          error: "Failed to process generated document",
          details: err.message
        });
      }
    });

  } catch (error) {
    console.error("[ERROR] Word COM generation error:", error);
    return res.status(500).json({
      error: "Failed to generate document",
      details: error.message
    });
  }
};

/**
 * Send document via email
 */
const sendDocumentViaEmail = async (filePath, fileName, type, req, metadata) => {
  const { to, cc, senderName, senderEmail } = req.body;
  const recipients = to || process.env.DEFAULT_EMAIL_RECEIVER;

  if (!recipients) {
    throw new Error("No email recipients specified");
  }

  const transporter = nodemailer.createTransport({
    service: process.env.MAIL_SERVICE || "gmail",
    host: process.env.MAIL_SERVICE === "office365" ? "smtp.office365.com" : undefined,
    port: process.env.MAIL_SERVICE === "office365" ? 587 : undefined,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  const mailOptions = {
    from: `"${senderName || "HPE Document Creator"}" <${process.env.MAIL_USER}>`,
    cc: cc || undefined,
    to: recipients,
    subject: `Document v${metadata.docVersion} (${metadata.documentStatus}) - ${metadata.documentTitle}`,
    text: `Hi,\n\nPlease find attached version ${metadata.docVersion} (${metadata.documentStatus}) of the document "${metadata.documentTitle}".\n\nCustomer: ${metadata.customerName}\nPartner: ${metadata.partnerName || "N/A"}\nOPE ID: ${metadata.opeId}\n\nBest regards,\n${senderName || "HPE Document Creator"}\n${senderEmail || process.env.MAIL_USER}`,
    attachments: [{
      filename: `${fileName}.${type}`,
      path: filePath
    }]
  };

  await transporter.sendMail(mailOptions);
  console.log(`[Email] Sent to ${recipients}`);
};

module.exports = {
  generateDocument
};
