/**
 * proposalController.js  —  backend/controllers/proposalController.js
 *
 * HPE Proposal generator — template-based PPTX via fill_proposal.py.
 *
 * Requires:
 *   backend/templates/hpe-proposal-template.pptx
 *   backend/scripts/fill_proposal.py
 *   pip install python-pptx lxml beautifulsoup4
 *
 * Layout strategy (LAYOUT_MODE):
 *
 *   "html"  — LAYOUT_HTML (recommended)
 *             One slide per module.  Raw HTML description is sent to Python
 *             which parses paragraph text and <table> elements separately.
 *             → paragraph text fills the slide body placeholder
 *             → <table> elements become real PPTX tables stacked below
 *
 *   "table" — LAYOUT_TABLE (classic)
 *             One slide per section.  All module names + stripped descriptions
 *             become rows in a single section-level table (no embedded tables).
 *
 *   "content" — LAYOUT_CONTENT
 *             One slide per module.  Description is HTML-stripped to plain text.
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const Draft = require("../models/draft");

const TEMPLATE = path.join(__dirname, "../templates/hpe-proposal-template.pptx");
const FILLER   = path.join(__dirname, "../scripts/fill_proposal.py");
const TEMP_DIR = path.join(__dirname, "../temp");

// ── Config ────────────────────────────────────────────────────────────────────
// "html"    → parse HTML, embedded tables become real PPTX tables  ← recommended
// "table"   → classic one-table-per-section layout
// "content" → plain text, one slide per module
const LAYOUT_MODE = "html";

// ── Helpers ───────────────────────────────────────────────────────────────────

const sanitize = (s = "") => s.replace(/[\/\\?%*:|"<>]/g, "_");

/** Strip all HTML tags → plain text (used only in "table"/"content" modes). */
const stripHtml = (raw = "") =>
  raw
    .replace(/<br\s*\/?>/gi,         "\n")
    .replace(/<\/p\s*>/gi,           "\n")
    .replace(/<\/li\s*>/gi,          "\n")
    .replace(/<li[^>]*>/gi,          "")
    .replace(/<[^>]*>/g,             "")
    .replace(/&nbsp;/g,  " ")
    .replace(/&amp;/g,   "&")
    .replace(/&lt;/g,    "<")
    .replace(/&gt;/g,    ">")
    .replace(/&quot;/g,  '"')
    .replace(/&#39;/g,   "'")
    .replace(/\n{3,}/g,  "\n\n")
    .trim();

/**
 * Run fill_proposal.py via python3 (falls back to "py" on Windows).
 */
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
      order: [["version", "DESC"]]  // ← GET LATEST VERSION
    });
    if (!draft) return res.status(404).json({ error: "Draft not found" });

    // DEBUG: Log what's actually in the database
    console.log("📊 [generateProposal] Draft from DB:");
    if (draft.content?.documentSections) {
      draft.content.documentSections.forEach((sec, sIdx) => {
        console.log(`  Section ${sIdx} (${sec.id}): "${sec.title}"`);
        (sec.modules || []).forEach((mod, mIdx) => {
          console.log(`    Module ${mIdx}: name="${mod.name}" | description=${mod.description ? `[${mod.description.substring(0, 80)}...]` : "[MISSING]"}`);
        });
      });
    } else {
      console.log("  ⚠️  NO documentSections in draft.content!");
    }

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

    // Fall back to DB content when frontend sends empty arrays
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

    // DEBUG: Log assigned modules to trace description issue
    console.log("📊 [generateProposal] DEBUG assignedRaw structure:");
    Object.entries(assignedRaw).forEach(([sectionId, mods]) => {
      console.log(`  Section ${sectionId}:`, 
        Array.isArray(mods) ? mods.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description ? `[${m.description.substring(0, 100)}...]` : "[EMPTY]",
        })) : "NOT_ARRAY"
      );
    });
    console.log("📊 [generateProposal] reqAssigned was:", 
      reqAssigned && Object.keys(reqAssigned).length ? "PROVIDED" : "EMPTY_FALLBACK_TO_DRAFT"
    );

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

    // 2 — Content slides (one per module or one per section depending on mode)
    sections.forEach((section, sIdx) => {
      const sNum   = sIdx + 1;
      const sTitle = stripHtml(section.title || `Section ${sNum}`);
      const mods   = Array.isArray(assignedRaw[section.id])
        ? assignedRaw[section.id]
        : [];

      if (mods.length === 0) return;

      const breadcrumb = `${sNum}.   ${sTitle}`;

      if (LAYOUT_MODE === "html") {
        // ── HTML mode: one slide per module, raw HTML passed to Python ────────
        mods.forEach((mod, modIdx) => {
          const hasName   = !!(mod.name || "").trim();
          const modNum    = hasName ? `${sNum}.${modIdx + 1}` : "";
          const modName   = stripHtml(mod.name || "");
          const bodyHtml  = (mod.description || "").trim();

          slides.push({
            layout: "LAYOUT_HTML",
            fields: {
              "{{breadcrumb}}": breadcrumb,
              "{{moduleNum}}":  modNum,
              "{{moduleName}}": modName,
              "__html__":       bodyHtml,
            },
          });
        });

      } else if (LAYOUT_MODE === "table") {
        // ── Table mode: one slide per section, rows = module summaries ────────
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
        // ── Content mode: one slide per module, plain text ────────────────────
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

    const dataJson = { template: TEMPLATE, output: outputPath, slides };
    
    // DEBUG: Log first module's HTML to verify it's being sent
    if (slides.length > 1 && slides[1].layout === "LAYOUT_HTML") {
      const firstHtmlSlide = slides[1];
      const htmlContent = firstHtmlSlide.fields["__html__"];
      console.log("📊 [generateProposal] First LAYOUT_HTML slide:");
      console.log("  fields:", Object.keys(firstHtmlSlide.fields));
      console.log("  __html__ length:", htmlContent?.length || 0);
      if (htmlContent) {
        console.log("  __html__ preview:", htmlContent.substring(0, 150) + "...");
      } else {
        console.log("  ⚠️  __html__ is EMPTY or MISSING!");
      }
    }

    fs.writeFileSync(
      dataPath,
      JSON.stringify(dataJson, null, 2),
      "utf8"
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
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitize(baseName)}.pptx"`
    );
    res.send(fs.readFileSync(outputPath));

  } catch (err) {
    console.error("❌ generateProposal:", err.message);
    res.status(500).json({ error: err.message || "Failed to generate proposal" });
  } finally {
    [dataPath, outputPath].forEach((f) => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
    });
  }
};