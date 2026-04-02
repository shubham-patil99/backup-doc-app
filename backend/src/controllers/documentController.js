const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Media,
} = require("docx");
const ImageModule = require("docxtemplater-image-module-free");
const Draft = require("../models/draft");
const nodemailer = require("nodemailer");
const cheerio = require("cheerio");

// ── Regex patterns ────────────────────────────────────────────────────────
const REGEX_PATTERNS = {
  link: /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi,
  image: /<img\b[^>]*src="([^">]+)"[^>]*>/gi,
  table: /<table[^>]*>([\s\S]*?)<\/table>/gi,
  tbody: /<tbody[^>]*>([\s\S]*?)<\/tbody>/i,
  tableRow: /<tr[^>]*>([\s\S]*?)<\/tr>/gi,
  tableCell: /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi,
  listItem: /<li[^>]*>(.*?)<\/li>/gis,
  br: /<br\s*\/?>/gi,
  htmlTag: /<[^>]*>/g,
};

// ── XML character sanitizer ───────────────────────────────────────────────
// Removes/replaces characters that are illegal in XML 1.0.
// Word inserts \u000b (vertical tab) via Shift+Enter — docxtemplater rejects it.
const sanitizeXmlChars = (str) => {
  if (!str || typeof str !== "string") return str || "";
  return str
    .replace(/\u000b/g, "\n") // Word soft line-break → newline
    .replace(/[\u0000-\u0008\u000c\u000e-\u001f\u007f\ufffe\uffff]/g, "") // other illegal control chars
    .replace(/[\uD800-\uDFFF]/g, ""); // lone surrogates
};

// ── Image loader ──────────────────────────────────────────────────────────
const loadImageAsBuffer = (src) => {
  try {
    let relativePath = src;
    if (src.includes("localhost:5000/uploads/")) {
      relativePath = src.split("localhost:5000")[1];
    } else if (src.includes("/uploads/")) {
      relativePath = src.substring(src.indexOf("/uploads/"));
    }
    const candidatePaths = [
      path.join(__dirname, "..", "..", relativePath.replace(/^\/+/, "")),
      path.join(__dirname, "..", relativePath.replace(/^\/+/, "")),
      path.join(process.cwd(), relativePath.replace(/^\/+/, "")),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return fs.readFileSync(p);
    }
    return null;
  } catch {
    return null;
  }
};

// ── HTML → plain text ─────────────────────────────────────────────────────
// NOTE: sanitizeXmlChars is applied at the END before returning.
const htmlToPlainText = (html) => {
  if (!html) return "";

  let text = html
    .replace(/(<\/p\s*>){2,}/gi, "\n\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(REGEX_PATTERNS.br, "\n")
    .replace(REGEX_PATTERNS.link, (match, url, linkText) => {
      const cleanText = linkText.replace(REGEX_PATTERNS.htmlTag, "").trim();
      return cleanText ? `${cleanText} (${url})` : url;
    })
    .replace(REGEX_PATTERNS.htmlTag, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const lines = text.split("\n");
  const normalizedLines = lines.map((line) => line.replace(/\s+/g, " ").trim());

  // ✅ sanitizeXmlChars called here — the ONE correct return path
  const result = normalizedLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return sanitizeXmlChars(result);
};

// ── Parse HTML list items ─────────────────────────────────────────────────
const parseHtmlList = (html) => {
  if (!html) return [];
  const $ = cheerio.load(`<div>${html}</div>`, { decodeEntities: true });

  const parseListItems = ($list, depth = 0) => {
    const items = [];
    $list.children("li").each((i, li) => {
      const $li = $(li);
      const $clone = $li.clone();
      $clone.find("ul, ol").remove();
      const text = $clone.text().trim();
      const $nestedList = $li.children("ul, ol").first();
      const hasNested = $nestedList.length > 0;
      const item = { text, html: $clone.html().trim(), depth };
      if (hasNested && depth < 3) {
        const nestedListType =
          $nestedList.prop("tagName").toLowerCase() === "ol"
            ? "number"
            : "bullet";
        item.hasNested = true;
        item.nestedListType = nestedListType;
        item.nestedItems = parseListItems($nestedList, depth + 1);
      } else {
        item.hasNested = false;
      }
      items.push(item);
    });
    return items;
  };

  const $root = $("div > ul, div > ol").first();
  if ($root.length === 0) return [];
  return parseListItems($root, 0);
};

// ── Extract tables from HTML ──────────────────────────────────────────────
const extractTables = (html) => {
  const tables = [];
  const tableRegex = new RegExp(REGEX_PATTERNS.table.source, "gi");
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    let tableHTML = tableMatch[1];
    const tbodyMatch = tableHTML.match(REGEX_PATTERNS.tbody);
    if (tbodyMatch) tableHTML = tbodyMatch[1];

    const tableRows = [];
    const rowMatches = [
      ...tableHTML.matchAll(new RegExp(REGEX_PATTERNS.tableRow.source, "gi")),
    ];

    for (let rowIndex = 0; rowIndex < rowMatches.length; rowIndex++) {
      const rowHTML = rowMatches[rowIndex][1];
      const cellMatches = [
        ...rowHTML.matchAll(new RegExp(REGEX_PATTERNS.tableCell.source, "gi")),
      ];
      const cells = cellMatches.map(
        (cellMatch) => htmlToPlainText(cellMatch[1]) || " ",
      );
      if (cells.length > 0) tableRows.push({ cells, isHeader: rowIndex === 0 });
    }

    if (tableRows.length === 0) continue;

    const maxColumns = Math.max(...tableRows.map((row) => row.cells.length));
    tableRows.forEach((row) => {
      while (row.cells.length < maxColumns) row.cells.push(" ");
    });

    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(1);
    const header = {};
    for (let i = 0; i < maxColumns; i++) header[`col${i}`] = headerRow.cells[i];
    const rows = dataRows.map((row) => {
      const rowObj = {};
      for (let i = 0; i < maxColumns; i++) rowObj[`col${i}`] = row.cells[i];
      return rowObj;
    });

    tables.push({
      header,
      rows,
      columnCount: maxColumns,
      rowCount: dataRows.length,
      hasRows: dataRows.length > 0,
      is1Col: maxColumns === 1,
      is2Col: maxColumns === 2,
      is3Col: maxColumns === 3,
      is4Col: maxColumns === 4,
      is5Col: maxColumns === 5,
      is6Col: maxColumns === 6,
      is7Col: maxColumns === 7,
      is8Col: maxColumns === 8,
      is9Col: maxColumns === 9,
      is10Col: maxColumns === 10,
      is11Col: maxColumns === 11,
      is12Col: maxColumns === 12,
    });
  }
  return tables;
};

// ── Parse HTML into structured content blocks ─────────────────────────────
const parseHtmlContent = (html) => {
  if (!html) return { blocks: [] };
  const blocks = [];

  const findTopLevelLists = (htmlStr) => {
    const listMatches = [];
    const processedRanges = [];
    const listRegex = /<(ul|ol)[^>]*>/gi;
    let match;

    while ((match = listRegex.exec(htmlStr)) !== null) {
      const startIndex = match.index;
      const isNested = processedRanges.some(
        (range) => startIndex > range.start && startIndex < range.end,
      );
      if (isNested) continue;

      const tagType = match[1].toLowerCase();
      let depth = 1;
      let currentPos = match.index + match[0].length;
      const openTag = new RegExp(`<${tagType}[^>]*>`, "gi");
      const closeTag = new RegExp(`</${tagType}>`, "gi");

      while (depth > 0 && currentPos < htmlStr.length) {
        openTag.lastIndex = currentPos;
        closeTag.lastIndex = currentPos;
        const nextOpen = openTag.exec(htmlStr);
        const nextClose = closeTag.exec(htmlStr);
        if (!nextClose) break;
        if (nextOpen && nextOpen.index < nextClose.index) {
          depth++;
          currentPos = nextOpen.index + nextOpen[0].length;
        } else {
          depth--;
          currentPos = nextClose.index + nextClose[0].length;
          if (depth === 0) {
            const endIndex = currentPos;
            processedRanges.push({ start: startIndex, end: endIndex });
            listMatches.push({
              type: "list",
              index: startIndex,
              match: htmlStr.slice(startIndex, endIndex),
              endIndex,
            });
          }
        }
      }
    }
    return listMatches;
  };

  const patterns = [
    { type: "table", re: new RegExp(REGEX_PATTERNS.table.source, "gi") },
    { type: "image", re: new RegExp(REGEX_PATTERNS.image.source, "gi") },
  ];
  const matches = [];
  patterns.forEach((p) => {
    let m;
    while ((m = p.re.exec(html)) !== null) {
      matches.push({
        type: p.type,
        index: m.index,
        match: m[0],
        endIndex: m.index + m[0].length,
      });
    }
  });
  matches.push(...findTopLevelLists(html));
  matches.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
  for (const item of matches) {
    if (item.index > lastIndex) {
      const rawHtml = html.slice(lastIndex, item.index);
      const gapText = htmlToPlainText(rawHtml);
      if (gapText && gapText.trim() !== ">") {
        blocks.push({ type: "paragraph", text: gapText, html: rawHtml });
      }
    }
    const nodeHtml = item.match;
    if (item.type === "table") {
      extractTables(nodeHtml).forEach((t) =>
        blocks.push({ type: "table", table: t }),
      );
    } else if (item.type === "image") {
      const imgMatch = nodeHtml.match(
        new RegExp(REGEX_PATTERNS.image.source, "i"),
      );
      if (imgMatch) blocks.push({ type: "image", src: imgMatch[1] });
    } else if (item.type === "list") {
      const listType = nodeHtml.trim().startsWith("<ol") ? "number" : "bullet";
      const items = parseHtmlList(nodeHtml);
      if (items.length > 0) blocks.push({ type: "list", items, listType });
    }
    lastIndex = item.endIndex;
  }

  if (lastIndex < html.length) {
    const tailText = htmlToPlainText(html.slice(lastIndex));
    if (tailText)
      blocks.push({
        type: "paragraph",
        text: tailText,
        html: html.slice(lastIndex),
      });
  }

  return { blocks };
};

// ── Process modules for template ──────────────────────────────────────────
const processModules = (mods, isAttachmentSection = false) => {
  if (!Array.isArray(mods)) return [];

  return mods.map((mod) => {
    const parsed = parseHtmlContent(mod.description || "");

    const mappedBlocks = parsed.blocks.map((b, idx) => {
      if (b.type === "paragraph") {
        return {
          isParagraph: true,
          // htmlToPlainText already calls sanitizeXmlChars internally
          text: htmlToPlainText(b.html || b.text),
          html: b.html || b.text,
          isAttachment: isAttachmentSection,
          _index: idx,
        };
      }

      if (b.type === "list") {
        const processListItems = (items, currentDepth = 0) => {
          return items.map((it, i) => {
            const processedItem = {
              index: i + 1,
              // htmlToPlainText already calls sanitizeXmlChars internally
              text: htmlToPlainText(it.text || it.html || it),
              html: it.html || it.text || it,
              hasNested: !!it.hasNested,
              depth: currentDepth,
              isDepth0: currentDepth === 0,
              isDepth1: currentDepth === 1,
              isDepth2: currentDepth === 2,
              isDepth3: currentDepth === 3,
            };
            if (it.hasNested && it.nestedItems && currentDepth < 3) {
              processedItem.isNestedNumber = it.nestedListType === "number";
              processedItem.isNestedBullet = it.nestedListType === "bullet";
              processedItem.nestedItems = processListItems(
                it.nestedItems,
                currentDepth + 1,
              );
              processedItem.hasNestedItems =
                processedItem.nestedItems.length > 0;
            }
            return processedItem;
          });
        };

        const itemsWithIndex = processListItems(b.items, 0);
        return {
          isList: true,
          isNumberList: b.listType === "number",
          isBulletList: b.listType === "bullet",
          items: itemsWithIndex,
          hasItems: itemsWithIndex.length > 0,
          isAttachment: isAttachmentSection,
          _index: idx,
        };
      }

      if (b.type === "table") {
        return {
          isTable: true,
          header: b.table.header,
          rows: b.table.rows,
          hasRows: b.table.hasRows,
          columnCount: b.table.columnCount,
          is1Col: b.table.is1Col,
          is2Col: b.table.is2Col,
          is3Col: b.table.is3Col,
          is4Col: b.table.is4Col,
          is5Col: b.table.is5Col,
          is6Col: b.table.is6Col,
          is7Col: b.table.is7Col,
          is8Col: b.table.is8Col,
          is9Col: b.table.is9Col,
          is10Col: b.table.is10Col,
          is11Col: b.table.is11Col,
          is12Col: b.table.is12Col,
          isAttachment: isAttachmentSection,
          _index: idx,
        };
      }

      if (b.type === "image") {
        return {
          isImage: true,
          imageSrc: b.src,
          isAttachment: isAttachmentSection,
          _index: idx,
        };
      }

      return { isParagraph: true, text: "", _index: idx };
    });

    const hasName = !!mod.name?.trim();
    const hasContent = mappedBlocks.length > 0;

    return {
      id: mod.id,
      // ✅ sanitize name — \u000b here caused the "invalid_xml_characters" error
      name: sanitizeXmlChars(mod.name || ""),
      hasName,
      sectionId: mod.sectionId || mod.section_id,
      blocks: mappedBlocks,
      hasContent,
      showNameSpace:
        hasName &&
        hasContent &&
        !(mappedBlocks.length > 0 && mappedBlocks[0].isList),
    };
  });
};

// ── File name sanitizer ───────────────────────────────────────────────────
const sanitizeFileName = (name) => name.replace(/[\/\\?%*:|"<>]/g, "_");

// ── Main controller ───────────────────────────────────────────────────────
exports.generateDocument = async (req, res) => {
  try {
    const { opeId } = req.params;
    
    // ✅ Backend ALWAYS returns DOCX — Electron on Windows handles TOC updates & PDF conversion
    // This keeps backend platform-agnostic (Ubuntu/Windows compatible)
    const type = "docx";
    const isPreview = req.query.preview === "true";
    const sendEmail = req.query.send === "true";

    const isElectronClient =
      req.headers?.["x-electron"] === "1" ||
      req.query?.client === "electron" ||
      req.headers?.["user-agent"]?.toLowerCase().includes("electron");

    console.log("[generateDocument] Generating DOCX for", isElectronClient ? "Electron client" : "web client");

    const status = req.body.status || req.query.status || "draft";
    const docVersion =
      parseInt(
        req.body.docVersion || req.query.docVersion || req.body.version,
      ) || 1;
    const recipients = req.body.to || process.env.DEFAULT_EMAIL_RECEIVER;
    const senderName = req.body.senderName || "HPE Document Creator";
    const senderEmail = req.body.senderEmail || process.env.MAIL_USER;

    const {
      customerName,
      customerEmail,
      customerAddress,
      partnerName,
      quoteId,
      sections: reqSections,
      assigned: reqAssigned,
      documentTitle,
      createdAtFormatted,
      sowType = "SMALL",
    } = req.body || {};

    const templateFile =
      sowType === "SMALL"
        ? status === "final"
          ? "small-word-template-final.docx"
          : "small-word-template-draft.docx"
        : status === "final"
          ? "word-template-final.docx"
          : "word-template-draft.docx";

    const templatePath = path.join(__dirname, "../templates/", templateFile);
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: "Word template not found" });
    }

    const draft = await Draft.findOne({ where: { opeId } });
    if (!draft) return res.status(404).json({ error: "Draft not found" });

    let sections = reqSections || draft.content?.body?.sections || [];
    let assignedRaw = reqAssigned || draft.content?.body?.assigned || {};
    if (!Array.isArray(sections)) sections = [];

    // Image cache (skip in preview for speed)
    const imageCache = new Map();
    if (!isPreview) {
      for (const secId in assignedRaw) {
        const mods = assignedRaw[secId];
        if (Array.isArray(mods)) {
          for (const mod of mods) {
            const imgRegex = new RegExp(REGEX_PATTERNS.image.source, "gi");
            let match;
            while ((match = imgRegex.exec(mod.description || "")) !== null) {
              const src = match[1];
              if (!imageCache.has(src)) {
                const buf = loadImageAsBuffer(src);
                if (buf) imageCache.set(src, buf);
              }
            }
          }
        }
      }
    }

    // Template load + cleanup
    const content = fs.readFileSync(templatePath, "binary");
    let zip = new PizZip(content);

    try {
      const xmlFile = zip.files["word/document.xml"];
      if (xmlFile) {
        let xml = xmlFile.asText();
        const before = xml.length;
        xml = xml
          .replace(/<w:t[^>]*>%imageSrc<\/w:t>/gi, "")
          .replace(/%imageSrc/gi, "");
        if (xml.length !== before) zip.file("word/document.xml", xml);
      }
    } catch (e) {
      console.warn("Template XML cleanup warning:", e.message);
    }

    let doc;
    try {
      doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        modules: [],
        nullGetter: () => "",
      });
    } catch (err) {
      return res.status(400).json({
        error: "Template compilation error",
        message: err.message,
        errors: err.properties?.errors?.map((e) => e.message) || [],
      });
    }

    // Build sections data
    const sectionsWithModules = sections.map((section, sectionIndex) => {
      const isAttachmentSection = /attachment/i.test(section.title || "");
      const sectionModules = assignedRaw[section.id] || [];
      const processedModules = Array.isArray(sectionModules)
        ? processModules(sectionModules, isAttachmentSection)
        : [];

      let moduleCounter = 0;
      const numberedModules = processedModules.map((mod) => {
        const shouldNumber = !!(mod.name || mod.hasName);
        if (shouldNumber) moduleCounter++;
        return {
          ...mod,
          moduleNumber: shouldNumber
            ? `${sectionIndex + 1}.${moduleCounter}`
            : "",
          moduleId: `mod_${section.id}_${mod.id}`
            .substring(0, 40)
            .replace(/[^a-zA-Z0-9_]/g, "_"),
        };
      });

      return {
        ...section,
        // ✅ sanitize section title too
        title: sanitizeXmlChars(section.title || ""),
        description: htmlToPlainText(section.description || ""),
        hasDescription: !!htmlToPlainText(section.description || ""),
        sectionNumber: sectionIndex + 1,
        sectionId: `sec_${section.id}`
          .substring(0, 40)
          .replace(/[^a-zA-Z0-9_]/g, "_"),
        isAttachment: isAttachmentSection,
        modules: numberedModules,
        hasModules: numberedModules.length > 0,
      };
    });

    const statementHeader = partnerName
      ? `Statement of Work to ${partnerName} for ${customerName}`
      : `Statement of Work for ${customerName}`;

    const docTitle = partnerName
      ? `Statement of Work to ${partnerName} from Hewlett Packard Enterprise Company for ${customerName} for the in-scope Nonstop Services`
      : `Statement of Work from Hewlett Packard Enterprise Company for ${customerName} for the in-scope Nonstop Services`;

    const templateData = {
      isDraft: status === "draft",
      isFinal: status === "final",
      documentStatus: status.toUpperCase(),
      customerName: sanitizeXmlChars(customerName || draft.customerName || ""),
      customerEmail: sanitizeXmlChars(
        customerEmail || draft.customerEmail || "",
      ),
      customerAddress: sanitizeXmlChars(
        customerAddress || draft.customerAddress || "",
      ),
      partnerName: sanitizeXmlChars(partnerName || draft.partnerName || ""),
      quoteId: sanitizeXmlChars(quoteId || draft.quoteId || ""),
      hasQuoteId: !!(quoteId || draft.quoteId),
      quoteIdLine:
        quoteId || draft.quoteId
          ? `Quote Id - ${quoteId || draft.quoteId}`
          : "",
      opeId: sanitizeXmlChars(opeId || draft.opeId || ""),
      documentTitle: sanitizeXmlChars(
        documentTitle ||
          draft.documentName ||
          draft.content?.title ||
          "Document",
      ),
      date:
        createdAtFormatted ||
        (draft && (draft.created_at || draft.createdAt)
          ? new Date(draft.created_at || draft.createdAt).toLocaleDateString()
          : new Date().toLocaleDateString()),
      sections: sectionsWithModules,
      version: docVersion,
      statementHeader: sanitizeXmlChars(statementHeader),
      docTitle: sanitizeXmlChars(docTitle),
      hasSections: sectionsWithModules.length > 0,
    };

    try {
      doc.render(templateData);
    } catch (err) {
      console.error("Render error:", err.message);
      if (err.properties?.errors) {
        err.properties.errors.forEach((e, i) =>
          console.error(`  Render error ${i + 1}: ${e.message}`, e.properties),
        );
      }
      return res.status(500).json({
        error: "Template rendering failed",
        details: err.message,
        templateErrors: err.properties?.errors?.map((e) => e.message) || [],
      });
    }

    // Post-render placeholder replacement
    const zipAfter = doc.getZip();
    const placeholders = {
      "{{customerName}}": templateData.customerName || "",
      "{{partnerName}}": templateData.partnerName || "",
      "{{partnerOrCustomerName}}":
        templateData.partnerName || templateData.customerName || "",
      "{{opeId}}": templateData.opeId || "",
      "{{quoteId}}": templateData.quoteId || "",
    };
    Object.keys(zipAfter.files).forEach((fname) => {
      if (!fname.endsWith(".xml")) return;
      try {
        let xml = zipAfter.file(fname).asText();
        let replaced = false;
        for (const [token, val] of Object.entries(placeholders)) {
          const re = new RegExp(
            token.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"),
            "g",
          );
          if (re.test(xml)) {
            xml = xml.replace(re, val);
            replaced = true;
          }
        }
        if (replaced) zipAfter.file(fname, xml);
      } catch (e) {
        console.warn("Post-replace warning in", fname, e.message);
      }
    });

    const docxBuffer = zipAfter.generate({ type: "nodebuffer" });
    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const tempDocxPath = path.join(tempDir, `temp_${Date.now()}.docx`);
    fs.writeFileSync(tempDocxPath, docxBuffer);

    const idPart =
      opeId ||
      templateData.opeId ||
      templateData.documentTitle ||
      `OPE-${Date.now()}`;
    const formattedName =
      partnerName && partnerName.trim()
        ? `${idPart} - HPE Nonstop PSD SOW to ${partnerName} for ${customerName}_${status}_v${docVersion}`
        : `${idPart} - HPE Nonstop PSD SOW for ${customerName}_${status}_v${docVersion}`;
    const sanitizedFileName = sanitizeFileName(formattedName);

    const sendEmailWithAttachment = async (attachmentPath, attachmentName) => {
      const transporter = nodemailer.createTransport({
        service: process.env.MAIL_SERVICE || "gmail",
        host:
          process.env.MAIL_SERVICE === "office365"
            ? "smtp.office365.com"
            : undefined,
        port: process.env.MAIL_SERVICE === "office365" ? 587 : undefined,
        secure: false,
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      });
      await transporter.sendMail({
        from: `"${senderName}" <${process.env.MAIL_USER}>`,
        cc: req.body.cc,
        to: recipients,
        subject: `Document Version ${docVersion} (${status.toUpperCase()}) - ${templateData.documentTitle}`,
        text: `Hi,\n\nPlease find attached version ${docVersion} (${status}) of the document "${templateData.documentTitle}".\n\nBest regards,\n${senderName}\n${senderEmail}`,
        attachments: [
          { filename: `${attachmentName}.${type}`, path: attachmentPath },
        ],
      });
      console.log(`📨 Email sent to ${recipients}`);
    };

    // ── DOCX only: Electron on Windows handles TOC updates & PDF conversion ──
    // Backend returns DOCX; Electron will:
    //   1. Save to Downloads
    //   2. Update TOC via Word COM
    //   3. Convert to PDF if needed
    console.log("[generateDocument] DOCX ready, Electron will handle TOC/PDF");

    // ── DOCX branch ────────────────────────────────────────────────────────
    try {
      if (sendEmail) {
        await sendEmailWithAttachment(tempDocxPath, sanitizedFileName);
        return res.json({ success: true, message: "Email sent successfully" });
      }
      const buf = fs.readFileSync(tempDocxPath);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${sanitizedFileName}.docx"`,
      );
      res.send(buf);
    } finally {
      try {
        fs.unlinkSync(tempDocxPath);
      } catch (_) {}
    }
  } catch (err) {
    console.error("❌ Error generating document:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to generate document" });
  }
};
