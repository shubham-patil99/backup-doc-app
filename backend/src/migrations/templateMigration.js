

const fs = require("fs");
const path = require("path");
const os = require("os");
const AdmZip = require("adm-zip");
const { DOMParser, XMLSerializer } = require("@xmldom/xmldom");

// ── XML namespace helpers ─────────────────────────────────────────────────────

const NS = {
  w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
};

function getTag(node) {
  // Returns local name without namespace prefix
  return node.localName || node.nodeName.replace(/^.*:/, "");
}

function getText(node) {
  return node.textContent || "";
}

// ── Placeholder detection ─────────────────────────────────────────────────────

const PLACEHOLDER_RE = /\{\{[^}]+\}\}|\$\{[^}]+\}|\[[\w\s]+\]/;

function containsPlaceholder(paragraphNode) {
  return PLACEHOLDER_RE.test(getText(paragraphNode));
}

// ── Extract meaningful paragraphs from OLD doc ────────────────────────────────

/**
 * Returns an array of serialized XML strings for paragraphs worth migrating:
 *  - paragraphs with placeholders
 *  - non-empty paragraphs with visible text (skip pure whitespace / page breaks)
 *  - table nodes entirely
 * Excludes: cover-page sections (before first w:sectPr), pure image paragraphs.
 */
function extractMigratableContent(oldDocXml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(oldDocXml, "text/xml");
  const serializer = new XMLSerializer();

  const body = doc.getElementsByTagNameNS(NS.w, "body")[0];
  if (!body) return [];

  const results = [];
  const children = Array.from(body.childNodes);

  // Detect if there's a "cover" section – heuristic: first w:sectPr child of body
  // means everything before it is the cover. We skip up to first sectPr.
  let pastCover = false;
  let hasSectPr = children.some(
    (n) => n.nodeType === 1 && getTag(n) === "sectPr"
  );

  for (const child of children) {
    if (child.nodeType !== 1) continue;
    const tag = getTag(child);

    // Skip the sectPr itself
    if (tag === "sectPr") {
      pastCover = true;
      continue;
    }

    // If there's no sectPr, treat everything as body content
    if (!hasSectPr) pastCover = true;

    if (!pastCover) continue;

    if (tag === "tbl") {
      // Always migrate tables
      results.push({ type: "table", xml: serializer.serializeToString(child) });
      continue;
    }

    if (tag === "p") {
      const text = getText(child).trim();
      if (!text) continue; // skip empty paragraphs

      // Skip paragraphs that are purely page-break runs
      const isPageBreak =
        child
          .getElementsByTagNameNS(NS.w, "br")
          .length > 0 && text.length === 0;
      if (isPageBreak) continue;

      results.push({
        type: "paragraph",
        hasPlaceholder: containsPlaceholder(child),
        text,
        xml: serializer.serializeToString(child),
      });
    }
  }

  return results;
}

// ── Merge styles / numbering from OLD into NEW ────────────────────────────────

function mergeStylesXml(oldZip, newZip) {
  const oldStylesEntry = oldZip.getEntry("word/styles.xml");
  const newStylesEntry = newZip.getEntry("word/styles.xml");
  if (!oldStylesEntry || !newStylesEntry) return;

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const oldDoc = parser.parseFromString(
    oldStylesEntry.getData().toString("utf8"),
    "text/xml"
  );
  const newDoc = parser.parseFromString(
    newStylesEntry.getData().toString("utf8"),
    "text/xml"
  );

  const newStyles = newDoc.getElementsByTagNameNS(NS.w, "styles")[0];
  const oldStyleNodes = oldDoc.getElementsByTagNameNS(NS.w, "style");

  // Build set of styleIds already in NEW
  const existingIds = new Set();
  const newStyleNodes = newDoc.getElementsByTagNameNS(NS.w, "style");
  for (let i = 0; i < newStyleNodes.length; i++) {
    existingIds.add(newStyleNodes[i].getAttributeNS(NS.w, "styleId"));
  }

  // Append missing styles from OLD
  for (let i = 0; i < oldStyleNodes.length; i++) {
    const styleId = oldStyleNodes[i].getAttributeNS(NS.w, "styleId");
    if (!existingIds.has(styleId)) {
      const imported = newDoc.importNode(oldStyleNodes[i], true);
      newStyles.appendChild(imported);
    }
  }

  newZip.updateFile(
    "word/styles.xml",
    Buffer.from(serializer.serializeToString(newDoc), "utf8")
  );
}

function mergeNumberingXml(oldZip, newZip) {
  const oldEntry = oldZip.getEntry("word/numbering.xml");
  if (!oldEntry) return;

  const newEntry = newZip.getEntry("word/numbering.xml");
  if (!newEntry) {
    // Copy whole file from OLD to NEW
    newZip.addFile("word/numbering.xml", oldEntry.getData());
    return;
  }

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const oldDoc = parser.parseFromString(
    oldEntry.getData().toString("utf8"),
    "text/xml"
  );
  const newDoc = parser.parseFromString(
    newEntry.getData().toString("utf8"),
    "text/xml"
  );

  const newNumbering = newDoc.getElementsByTagNameNS(NS.w, "numbering")[0];

  // Collect existing abstractNumIds in NEW
  const existingAbstractIds = new Set();
  const newAbstractNums = newDoc.getElementsByTagNameNS(NS.w, "abstractNum");
  for (let i = 0; i < newAbstractNums.length; i++) {
    existingAbstractIds.add(
      newAbstractNums[i].getAttributeNS(NS.w, "abstractNumId")
    );
  }

  const oldAbstractNums = oldDoc.getElementsByTagNameNS(NS.w, "abstractNum");
  for (let i = 0; i < oldAbstractNums.length; i++) {
    const id = oldAbstractNums[i].getAttributeNS(NS.w, "abstractNumId");
    if (!existingAbstractIds.has(id)) {
      newNumbering.appendChild(newDoc.importNode(oldAbstractNums[i], true));
    }
  }

  const oldNums = oldDoc.getElementsByTagNameNS(NS.w, "num");
  const existingNumIds = new Set();
  const newNums = newDoc.getElementsByTagNameNS(NS.w, "num");
  for (let i = 0; i < newNums.length; i++) {
    existingNumIds.add(newNums[i].getAttributeNS(NS.w, "numId"));
  }
  for (let i = 0; i < oldNums.length; i++) {
    const id = oldNums[i].getAttributeNS(NS.w, "numId");
    if (!existingNumIds.has(id)) {
      newNumbering.appendChild(newDoc.importNode(oldNums[i], true));
    }
  }

  newZip.updateFile(
    "word/numbering.xml",
    Buffer.from(serializer.serializeToString(newDoc), "utf8")
  );
}

// ── Header / Footer migration ─────────────────────────────────────────────────

function migrateHeadersFooters(oldZip, newZip) {
  // Copy header*.xml and footer*.xml from OLD to NEW, updating relationships
  const oldEntries = oldZip.getEntries().filter((e) => {
    const n = e.entryName;
    return (
      (n.startsWith("word/header") || n.startsWith("word/footer")) &&
      n.endsWith(".xml")
    );
  });

  for (const entry of oldEntries) {
    const name = entry.entryName;
    // Only add if NEW doesn't already have a matching header/footer
    if (!newZip.getEntry(name)) {
      newZip.addFile(name, entry.getData());
    }
  }
}

// ── Inject content into NEW document body ────────────────────────────────────

/**
 * Takes migratableContent (array from extractMigratableContent) and injects
 * it into the NEW document's body.
 *
 * Strategy:
 *  - For each placeholder paragraph in OLD, try to find a matching placeholder
 *    key in NEW and REPLACE it. If not found, APPEND at end of body (before
 *    final sectPr).
 *  - For tables and non-placeholder text, APPEND at end of body.
 */
function injectContentIntoNew(newDocXml, migratableContent) {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const newDoc = parser.parseFromString(newDocXml, "text/xml");
  const body = newDoc.getElementsByTagNameNS(NS.w, "body")[0];
  if (!body) return newDocXml;

  // Find the final sectPr (must remain last child of body)
  let finalSectPr = null;
  const bodyChildren = Array.from(body.childNodes);
  for (let i = bodyChildren.length - 1; i >= 0; i--) {
    if (
      bodyChildren[i].nodeType === 1 &&
      getTag(bodyChildren[i]) === "sectPr"
    ) {
      finalSectPr = bodyChildren[i];
      break;
    }
  }

  // Build a map of placeholder keys already present in NEW
  function buildPlaceholderMap(docNode) {
    const map = new Map(); // key -> paragraph node
    const paragraphs = docNode.getElementsByTagNameNS(NS.w, "p");
    for (let i = 0; i < paragraphs.length; i++) {
      const text = getText(paragraphs[i]);
      const match = text.match(/\{\{([^}]+)\}\}|\$\{([^}]+)\}|\[([\w\s]+)\]/);
      if (match) {
        const key = match[1] || match[2] || match[3];
        map.set(key, paragraphs[i]);
      }
    }
    return map;
  }

  const newPlaceholderMap = buildPlaceholderMap(newDoc);

  function appendBeforeSectPr(xmlString) {
    const fragDoc = parser.parseFromString(
      `<root xmlns:w="${NS.w}" xmlns:r="${NS.r}">${xmlString}</root>`,
      "text/xml"
    );
    const root = fragDoc.documentElement;
    const nodes = Array.from(root.childNodes);
    for (const node of nodes) {
      const imported = newDoc.importNode(node, true);
      if (finalSectPr) {
        body.insertBefore(imported, finalSectPr);
      } else {
        body.appendChild(imported);
      }
    }
  }

  for (const item of migratableContent) {
    if (item.type === "table") {
      appendBeforeSectPr(item.xml);
      continue;
    }

    // For paragraphs: try placeholder replacement first
    if (item.hasPlaceholder) {
      const keyMatch = item.text.match(
        /\{\{([^}]+)\}\}|\$\{([^}]+)\}|\[([\w\s]+)\]/
      );
      if (keyMatch) {
        const key = keyMatch[1] || keyMatch[2] || keyMatch[3];
        const existingNode = newPlaceholderMap.get(key);
        if (existingNode) {
          // Replace the matching NEW placeholder paragraph with OLD's version
          const fragDoc = parser.parseFromString(
            `<root xmlns:w="${NS.w}" xmlns:r="${NS.r}">${item.xml}</root>`,
            "text/xml"
          );
          const imported = newDoc.importNode(
            fragDoc.documentElement.firstChild,
            true
          );
          existingNode.parentNode.replaceChild(imported, existingNode);
          newPlaceholderMap.delete(key);
          continue;
        }
      }
    }

    // Otherwise append
    appendBeforeSectPr(item.xml);
  }

  return serializer.serializeToString(newDoc);
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Merges content from oldTemplatePath into newTemplatePath.
 * Writes the merged result to outputPath.
 *
 * @param {string} oldTemplatePath  - Path to the existing (old) template
 * @param {string} newTemplatePath  - Path to the newly uploaded template
 * @param {string} outputPath       - Where to write the merged .docx
 */
async function mergeTemplates(oldTemplatePath, newTemplatePath, outputPath) {
  if (!fs.existsSync(oldTemplatePath)) {
    // No old template – just copy new as-is
    fs.copyFileSync(newTemplatePath, outputPath);
    return;
  }

  const ext = path.extname(oldTemplatePath).toLowerCase();

  if (ext === ".pptx") {
    // For PPTX: content migration is structural and complex; just copy new file
    // (PPTX slide XML differs significantly from DOCX body XML)
    fs.copyFileSync(newTemplatePath, outputPath);
    return;
  }

  // ── DOCX merge ──────────────────────────────────────────────────────────────
  const oldZip = new AdmZip(oldTemplatePath);
  const newZip = new AdmZip(newTemplatePath);

  // 1. Extract migratable paragraphs/tables from OLD
  const oldDocEntry = oldZip.getEntry("word/document.xml");
  if (!oldDocEntry) {
    fs.copyFileSync(newTemplatePath, outputPath);
    return;
  }
  const oldDocXml = oldDocEntry.getData().toString("utf8");
  const migratableContent = extractMigratableContent(oldDocXml);

  if (migratableContent.length === 0) {
    // Nothing to migrate
    fs.copyFileSync(newTemplatePath, outputPath);
    return;
  }

  // 2. Merge styles & numbering so OLD formatting works in NEW
  mergeStylesXml(oldZip, newZip);
  mergeNumberingXml(oldZip, newZip);
  migrateHeadersFooters(oldZip, newZip);

  // 3. Inject content into NEW document.xml
  const newDocEntry = newZip.getEntry("word/document.xml");
  if (!newDocEntry) {
    fs.copyFileSync(newTemplatePath, outputPath);
    return;
  }
  const newDocXml = newDocEntry.getData().toString("utf8");
  const mergedXml = injectContentIntoNew(newDocXml, migratableContent);

  newZip.updateFile("word/document.xml", Buffer.from(mergedXml, "utf8"));

  // 4. Write merged zip to output
  newZip.writeZip(outputPath);
}

module.exports = { mergeTemplates };