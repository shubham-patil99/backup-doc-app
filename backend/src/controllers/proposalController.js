/**
 * proposalController.js  —  backend/controllers/proposalController.js
 *
 * Template-based HPE Proposal generator.
 * Calls fill_proposal.py (python3) to clone slides + fill {{placeholders}}.
 *
 * Requires:
 *   backend/templates/hpe-proposal-template.pptx  (3 slides)
 *   backend/scripts/fill_proposal.py
 *   pip install python-pptx
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const Draft = require("../models/draft");

const TEMPLATE = path.join(
  __dirname,
  "../templates/hpe-proposal-template.pptx",
);
const FILLER = path.join(__dirname, "../scripts/fill_proposal.py");
const TEMP_DIR = path.join(__dirname, "../temp");

// ── Helpers ──────────────────────────────────────────────────────────────────
const sanitize = (s = "") => s.replace(/[\/\\?%*:|"<>]/g, "_");

const stripHtml = (html = "") =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * Run fill_proposal.py via python3.
 * On Windows the executable may be "py" — we try python3 first, then py.
 */
const runPython = (scriptPath, args = []) =>
  new Promise((resolve, reject) => {
    // Try python3 first (Linux/Mac/server), fall back to py (Windows dev)
    const tryExec = (cmd) =>
      new Promise((res, rej) => {
        const proc = spawn(cmd, [scriptPath, ...args]);
        let stderr = "";
        proc.stderr.on("data", (d) => {
          stderr += d.toString();
        });
        proc.on("error", (err) => rej(err)); // command not found
        proc.on("close", (code) => {
          if (code !== 0)
            rej(new Error(stderr.trim() || `${cmd} exit ${code}`));
          else res();
        });
      });

    tryExec("python3")
      .then(resolve)
      .catch(() => tryExec("py").then(resolve).catch(reject));
  });

// ── Main handler ─────────────────────────────────────────────────────────────
exports.generateProposal = async (req, res) => {
  const ts = Date.now();
  const dataPath = path.join(TEMP_DIR, `proposal_data_${ts}.json`);
  const outputPath = path.join(TEMP_DIR, `proposal_out_${ts}.pptx`);

  try {
    if (!fs.existsSync(TEMPLATE)) {
      return res.status(404).json({
        error: "HPE proposal template not found",
        hint: "Place hpe-proposal-template.pptx in backend/templates/",
      });
    }

    const { opeId } = req.params;
    const draft = await Draft.findOne({ where: { opeId } });
    if (!draft) return res.status(404).json({ error: "Draft not found" });

    // ── Extract payload ──────────────────────────────────────────────────────
    const {
      customerName = draft.customerName || "",
      partnerName = draft.partnerName || "",
      quoteId = draft.quoteId || "",
      documentTitle,
      sections: reqSections = [],
      assigned: reqAssigned = {},
      createdAtFormatted,
      status = "draft",
      docVersion = 1,
    } = req.body || {};

    // Fall back to DB content when frontend sends empty arrays
    let sections =
      Array.isArray(reqSections) && reqSections.length
        ? reqSections
        : (draft.content?.documentSections || []).map((s) => ({
            id: s.id,
            title: s.title || "",
            description: s.description || "",
          }));

    let assignedRaw =
      reqAssigned && Object.keys(reqAssigned).length
        ? reqAssigned
        : (draft.content?.documentSections || []).reduce((acc, sec) => {
            acc[sec.id] = sec.modules || [];
            return acc;
          }, {});

    const date =
      createdAtFormatted ||
      new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

    const docTitle =
      documentTitle ||
      (partnerName
        ? `HPE Nonstop Services Proposal for ${partnerName} / ${customerName}`
        : `HPE Nonstop Services Proposal for ${customerName}`);

    const subtitle = partnerName
      ? `Prepared for ${partnerName} on behalf of ${customerName}`
      : `Prepared for ${customerName}`;

    const quoteIdLine = quoteId ? `Quote ID — ${quoteId}` : "";

    // ── Build slides array ───────────────────────────────────────────────────
    const slides = [];

    // Cover (always first)
    slides.push({
      layout: "LAYOUT_COVER",
      fields: {
        "{{docTitle}}": docTitle,
        "{{subtitle}}": subtitle,
        "{{date}}": date,
        "{{opeId}}": opeId,
        "{{status}}": status.toUpperCase(),
        "{{version}}": `v${docVersion}`,
        "{{quoteIdLine}}": quoteIdLine,
      },
    });

    // One content slide per module across all sections
    sections.forEach((section, sIdx) => {
      const sNum = sIdx + 1;
      const sTitle = stripHtml(section.title || `Section ${sNum}`);
      const mods = Array.isArray(assignedRaw[section.id])
        ? assignedRaw[section.id]
        : [];

      let modCounter = 0;
      mods.forEach((mod) => {
        const hasName = !!(mod.name || "").trim();
        if (hasName) modCounter++;

        slides.push({
          layout: "LAYOUT_CONTENT_BODY",
          fields: {
            "{{breadcrumb}}": `${sNum}.   ${sTitle}`,
            "{{moduleNum}}": hasName ? `${sNum}.${modCounter}` : "",
            "{{moduleName}}": stripHtml(mod.name || ""),
            "{{moduleBody}}": stripHtml(mod.description || "").slice(0, 1200),
          },
        });
      });
    });

    // Closing (always last)
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

    fs.writeFileSync(
      dataPath,
      JSON.stringify({
        template: TEMPLATE,
        output: outputPath,
        slides,
      }),
      "utf8",
    );

    await runPython(FILLER, [dataPath]);

    if (!fs.existsSync(outputPath)) {
      throw new Error("fill_proposal.py did not produce an output file");
    }

    // ── Stream response ──────────────────────────────────────────────────────
    const baseName = partnerName
      ? `${opeId} - HPE Nonstop Proposal to ${partnerName} for ${customerName}_${status}_v${docVersion}`
      : `${opeId} - HPE Nonstop Proposal for ${customerName}_${status}_v${docVersion}`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitize(baseName)}.pptx"`,
    );
    res.send(fs.readFileSync(outputPath));
  } catch (err) {
    console.error("❌ generateProposal:", err.message);
    res
      .status(500)
      .json({ error: err.message || "Failed to generate proposal" });
  } finally {
    [dataPath, outputPath].forEach((f) => {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (_) {}
    });
  }
};
