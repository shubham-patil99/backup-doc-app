/**
 * proposalController.js  —  backend/controllers/proposalController.js
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const PizZip = require("pizzip");
const Draft = require("../models/draft");

const TEMPLATE = path.join(__dirname, "../templates/hpe-proposal-template.pptx");
const FILLER   = path.join(__dirname, "../scripts/fill_proposal.py");
const TEMP_DIR = path.join(__dirname, "../temp");

const LAYOUT_MODE = "html";

// ── Helpers ───────────────────────────────────────────────────────────────────

const sanitize = (s = "") => s.replace(/[\/\\?%*:|"<>]/g, "_");

const stripHtml = (raw = "") =>
  raw
    .replace(/<br\s*\/?>/gi,  "\n")
    .replace(/<\/p\s*>/gi,    "\n")
    .replace(/<\/li\s*>/gi,   "\n")
    .replace(/<li[^>]*>/gi,   "")
    .replace(/<[^>]*>/g,      "")
    .replace(/&nbsp;/g,  " ")
    .replace(/&amp;/g,   "&")
    .replace(/&lt;/g,    "<")
    .replace(/&gt;/g,    ">")
    .replace(/&quot;/g,  '"')
    .replace(/&#39;/g,   "'")
    .replace(/\n{3,}/g,  "\n\n")
    .trim();

/**
 * FIX: Returns true only when the HTML string has real visible text content,
 * not just tags, whitespace, or empty paragraph wrappers.
 */
const hasVisibleText = (html = "") => {
  const plain = stripHtml(html).replace(/\s+/g, "");
  return plain.length > 0;
};

const runPython = (scriptPath, args = []) =>
  new Promise((resolve, reject) => {
    const tryExec = (cmd) =>
      new Promise((res, rej) => {
        const proc = spawn(cmd, [scriptPath, ...args]);
        let stderr = "";
        proc.stderr.on("data", (d) => { stderr += d.toString(); });
        proc.on("error", rej);
        proc.on("close", (code) =>
          code !== 0
            ? rej(new Error(stderr.trim() || `${cmd} exit ${code}`))
            : res()
        );
      });
    tryExec("python3")
      .then(resolve)
      .catch(() => tryExec("py").then(resolve).catch(reject));
  });

// ── Main handler ──────────────────────────────────────────────────────────────

exports.generateProposal = async (req, res) => {
  const ts         = Date.now();
  const dataPath   = path.join(TEMP_DIR, `proposal_data_${ts}.json`);
  const outputPath = path.join(TEMP_DIR, `proposal_out_${ts}.pptx`);

  try {
    if (!fs.existsSync(TEMPLATE)) {
      return res.status(404).json({
        error: "HPE proposal template not found",
        hint:  "Place hpe-proposal-template.pptx in backend/templates/",
      });
    }

    const { opeId } = req.params;
    const draft = await Draft.findOne({
      where: { opeId },
      order: [["version", "DESC"]],
    });
    if (!draft) return res.status(404).json({ error: "Draft not found" });

    // ── Extract payload ──────────────────────────────────────────────────────
    const {
      customerName = draft.customerName || "",
      partnerName  = draft.partnerName  || "",
      quoteId      = draft.quoteId      || "",
      sections:  reqSections = [],
      assigned:  reqAssigned = {},
      createdAtFormatted,
      status     = "draft",
      docVersion = 1,
    } = req.body || {};

    const sections =
      Array.isArray(reqSections) && reqSections.length
        ? reqSections
        : (draft.content?.documentSections || []).map((s) => ({
            id:          s.id,
            title:       s.title       || "",
            description: s.description || "",
          }));

    const assignedRaw =
      reqAssigned && Object.keys(reqAssigned).length
        ? reqAssigned
        : (draft.content?.documentSections || []).reduce((acc, sec) => {
            acc[sec.id] = sec.modules || [];
            return acc;
          }, {});

    const date =
      createdAtFormatted ||
      new Date().toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });

    const docTitle = partnerName
      ? `HPE Nonstop Professional Services Proposal to ${partnerName} For The ${customerName || "Benefit Company"}`
      : `HPE Nonstop Professional Services Proposal for ${customerName || "Benefit Company"}`;

    const subtitle = partnerName
      ? `Prepared for ${partnerName} on behalf of ${customerName}`
      : `Prepared for ${customerName || "Benefit Company"}`;

    const quoteIdLine = quoteId ? `Quote ID — ${quoteId}` : "";

    // ── Build slides array ───────────────────────────────────────────────────
    const slides = [];

    // 1 — Cover
    slides.push({
      layout: "LAYOUT_COVER",
      fields: {
        "{{docTitle}}":    docTitle,
        "{{subtitle}}":    subtitle,
        "{{date}}":        date,
        "{{opeId}}":       opeId,
        "{{status}}":      status.toUpperCase(),
        "{{version}}":     `v${docVersion}`,
        "{{quoteIdLine}}": quoteIdLine,
      },
    });

    // 2 — Content slides
    sections.forEach((section, sIdx) => {
      const sNum   = sIdx + 1;
      const sTitle = stripHtml(section.title || `Section ${sNum}`);
      const mods   = Array.isArray(assignedRaw[section.id])
        ? assignedRaw[section.id]
        : [];

      if (mods.length === 0) return;

      const breadcrumb = `  ${sTitle}`;

      if (LAYOUT_MODE === "html") {
        // ── HTML mode ────────────────────────────────────────────────────────
        const combinedHtml = mods.map((mod, modIdx) => {
          const hasName = !!(mod.name || "").trim();
          const modNum  = hasName ? `${sNum}.${modIdx + 1}` : "";
          const modName = stripHtml(mod.name || "");
          const body    = (mod.description || "").trim();

          const heading = (modNum || modName)
            ? `<p><strong>${[modNum, modName].filter(Boolean).join(" ")}</strong></p>`
            : "";

          return `${heading}${body}`;
        }).join("\n");

        // FIX: skip the section entirely if there is no visible content —
        // prevents blank slides being generated for sections whose modules
        // have no description text yet.
        if (!hasVisibleText(combinedHtml)) {
          console.log(`[generateProposal] Section "${sTitle}" skipped — no visible content`);
          return;
        }

        slides.push({
          layout: "LAYOUT_HTML",
          fields: {
            "{{breadcrumb}}": breadcrumb,
            "{{moduleNum}}":  "",
            "{{moduleName}}": sTitle,
            "__html__":       combinedHtml,
          },
        });

      } else if (LAYOUT_MODE === "table") {
        // ── Table mode ───────────────────────────────────────────────────────
        const rows = mods.map((mod, modIdx) => {
          const hasName = !!(mod.name || "").trim();
          return [
            hasName ? `${sNum}.${modIdx + 1}` : "",
            stripHtml(mod.name        || ""),
            stripHtml(mod.description || "").slice(0, 900),
          ];
        });
        slides.push({
          layout: "LAYOUT_TABLE",
          fields: {
            "{{breadcrumb}}":   breadcrumb,
            "{{sectionTitle}}": sTitle,
            "__tableHeader__":  ["#", "Module", "Description"],
            "__tableRows__":    rows,
          },
        });

      } else {
        // ── Content mode ─────────────────────────────────────────────────────
        mods.forEach((mod, modIdx) => {
          const hasName = !!(mod.name || "").trim();
          slides.push({
            layout: "LAYOUT_CONTENT",
            fields: {
              "{{breadcrumb}}":  breadcrumb,
              "{{moduleNum}}":   hasName ? `${sNum}.${modIdx + 1}` : "",
              "{{moduleName}}":  stripHtml(mod.name        || ""),
              "{{moduleBody}}":  stripHtml(mod.description || "").slice(0, 2000),
            },
          });
        });
      }
    });

    // 3 — Closing
    slides.push({
      layout: "LAYOUT_CLOSING",
      fields: {
        "{{contactLine}}": partnerName
          ? `${partnerName}   |   ${customerName}`
          : customerName,
      },
    });

    // ── Write data JSON + run Python ─────────────────────────────────────────
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    fs.writeFileSync(dataPath, JSON.stringify({ template: TEMPLATE, output: outputPath, slides }, null, 2), "utf8");

    await runPython(FILLER, [dataPath]);

    if (!fs.existsSync(outputPath)) {
      throw new Error("fill_proposal.py did not produce an output file");
    }

    // ── Post-generate placeholder replacement (same as DOCX) ─────────────────
    try {
      const pptxContent = fs.readFileSync(outputPath);
      const zipPptx = new PizZip(pptxContent);

      const placeholders = {
        "{{customerName}}": customerName || "",
        "{{partnerName}}": partnerName || "",
        "{{partnerOrCustomerName}}": partnerName || customerName || "",
        "{{opeId}}": opeId || "",
        "{{quoteId}}": quoteId || "",
      };

      Object.keys(zipPptx.files).forEach((fname) => {
        if (!fname.endsWith(".xml")) return;
        try {
          let xml = zipPptx.file(fname).asText();
          let replaced = false;
          for (const [token, val] of Object.entries(placeholders)) {
            const re = new RegExp(
              token.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"),
              "g"
            );
            if (re.test(xml)) {
              xml = xml.replace(re, val);
              replaced = true;
            }
          }
          if (replaced) zipPptx.file(fname, xml);
        } catch (e) {
          console.warn("Post-replace warning in", fname, e.message);
        }
      });

      // Write updated PPTX back to file
      const updatedPptxContent = zipPptx.generate({ type: "nodebuffer" });
      fs.writeFileSync(outputPath, updatedPptxContent);
      console.log("[generateProposal] Placeholder replacement complete");
    } catch (err) {
      console.warn("[generateProposal] Placeholder replacement failed:", err.message);
      // Don't stop the flow if placeholder replacement fails
    }

    // ── Stream response ──────────────────────────────────────────────────────
    const isPreview = req.query.preview === "true";
    const baseName = partnerName
      ? `${opeId} - HPE Nonstop Proposal to ${partnerName} for ${customerName}_${status}_v${docVersion}`
      : `${opeId} - HPE Nonstop Proposal for ${customerName}_${status}_v${docVersion}`;

    if (isPreview) {
      const previewPdfPath = outputPath.replace(/\.pptx$/, ".pdf");
      const sofficeCmds = [
        `soffice --headless --convert-to pdf --outdir "${TEMP_DIR}" "${outputPath}"`,
        `soffice.exe --headless --convert-to pdf --outdir "${TEMP_DIR}" "${outputPath}"`,
        `"C:\\Program Files\\LibreOffice\\program\\soffice.exe" --headless --convert-to pdf --outdir "${TEMP_DIR}" "${outputPath}"`,
        `"C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe" --headless --convert-to pdf --outdir "${TEMP_DIR}" "${outputPath}"`,
      ];
      const { exec: execCb } = require("child_process");

      const tryConvert = (cmds, attemptIndex = 0) => {
        if (cmds.length === 0) {
          try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
          return res.status(500).json({
            error: "LibreOffice not found for proposal preview.",
            hint:  "Download from https://www.libreoffice.org/download and add to PATH",
          });
        }
        execCb(cmds[0], { timeout: 60_000 }, (error, stdout, stderr) => {
          if (error || !fs.existsSync(previewPdfPath)) {
            return tryConvert(cmds.slice(1), attemptIndex + 1);
          }
          try {
            const pdfBuffer = fs.readFileSync(previewPdfPath);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="${sanitize(baseName)}_preview.pdf"`);
            res.send(pdfBuffer);
          } finally {
            try { if (fs.existsSync(outputPath))    fs.unlinkSync(outputPath);    } catch (_) {}
            try { if (fs.existsSync(previewPdfPath)) fs.unlinkSync(previewPdfPath); } catch (_) {}
          }
        });
      };
      tryConvert(sofficeCmds);
      return;
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${sanitize(baseName)}.pptx"`);
    res.send(fs.readFileSync(outputPath));

  } catch (err) {
    console.error("❌ generateProposal:", err.message);
    res.status(500).json({ error: err.message || "Failed to generate proposal" });
  } finally {
    try { if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath); } catch (_) {}
  }
};