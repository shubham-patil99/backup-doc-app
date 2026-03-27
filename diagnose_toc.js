/**
 * diagnose_toc.js  – Run with Node.js from your project root:
 *   node diagnose_toc.js "path/to/your/downloaded.docx"
 *
 * Checks:
 *   1. Does the document have a TOC field?
 *   2. What paragraph styles exist in the document?
 *   3. Are any paragraphs using Heading styles?
 *   4. Is the TOC configured to pick up those styles?
 */

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const docxPath = process.argv[2];
if (!docxPath || !fs.existsSync(docxPath)) {
  console.error("Usage: node diagnose_toc.js <path-to-docx>");
  process.exit(1);
}

const content = fs.readFileSync(docxPath, "binary");
const zip = new PizZip(content);

const xmlFile = zip.files["word/document.xml"];
if (!xmlFile) {
  console.error("No word/document.xml found — is this a valid docx?");
  process.exit(1);
}

const xml = xmlFile.asText();

console.log("\n========== TOC DIAGNOSTIC ==========\n");

// 1. Check for TOC field
const hasTOC =
  xml.includes("TOC") || (xml.includes("w:fldChar") && xml.includes("TOC"));
const tocFieldMatch = xml.match(/TOC[^"<]*/g);
console.log("1. TOC field found:", hasTOC ? "✅ YES" : "❌ NO");
if (tocFieldMatch) {
  console.log("   TOC field instruction:", tocFieldMatch[0]?.substring(0, 200));
}

// 2. Find all paragraph styles used in document
const styleMatches = [...xml.matchAll(/<w:pStyle w:val="([^"]+)"/g)];
const stylesUsed = [...new Set(styleMatches.map((m) => m[1]))];
console.log("\n2. Paragraph styles used in document:");
stylesUsed.forEach((s) => console.log("  -", s));

// 3. Check for heading styles specifically
const headingStyles = stylesUsed.filter(
  (s) =>
    /^heading\d+$/i.test(s) ||
    /^Heading\d+/i.test(s) ||
    s.toLowerCase().includes("heading"),
);
console.log(
  "\n3. Heading styles found:",
  headingStyles.length > 0 ? headingStyles.join(", ") : "❌ NONE FOUND",
);

if (headingStyles.length === 0) {
  console.log("\n   ⚠️  ROOT CAUSE: No heading styles in document.");
  console.log("   The TOC field scans for Heading 1/2/3 paragraphs.");
  console.log(
    "   Your section titles must use 'Heading 1' style for TOC to populate.",
  );
  console.log("\n   FIX OPTIONS:");
  console.log(
    "   A) In your Word template, select the {sectionNumber}. {title} paragraph",
  );
  console.log("      and apply 'Heading 1' style from the Styles panel.");
  console.log(
    "   B) Or update the TOC field instruction to scan for your custom style.",
  );
}

// 4. Check TOC field switches to see what styles it scans
const tocSwitches = xml.match(/TOC[^<"]{0,300}/);
if (tocSwitches) {
  console.log("\n4. TOC field switches:", tocSwitches[0]);
  if (tocSwitches[0].includes("\\t")) {
    console.log("   ✅ TOC uses custom styles (\\t switch)");
    const customStyleMatch = tocSwitches[0].match(/\\t\s+"([^"]+)"/);
    if (customStyleMatch) {
      console.log("   Custom styles configured:", customStyleMatch[1]);
    }
  } else if (tocSwitches[0].includes("\\o")) {
    console.log(
      "   ℹ️  TOC uses outline levels (\\o switch) — needs Heading styles",
    );
  } else {
    console.log(
      "   ℹ️  TOC uses default settings — needs Heading 1/2/3 styles",
    );
  }
}

// 5. Show paragraphs near section numbers to identify actual style used
console.log("\n5. Paragraphs containing section numbers (first 5):");
const sectionParaRegex =
  /<w:p[ >](?:(?!<w:p[ >]).)*?<w:t[^>]*>\s*\d+\.\s*(?:(?!<\/w:p>).)*<\/w:p>/gs;
const sectionParas = [...xml.matchAll(sectionParaRegex)].slice(0, 5);
sectionParas.forEach((m, i) => {
  const styleInPara = m[0].match(/<w:pStyle w:val="([^"]+)"/);
  const textInPara = [...m[0].matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g)]
    .map((t) => t[1])
    .join("")
    .substring(0, 80);
  console.log(
    `  Para ${i + 1}: style="${styleInPara?.[1] || "Normal"}" text="${textInPara}"`,
  );
});

// 6. Check styles.xml for custom heading-like styles
const stylesFile = zip.files["word/styles.xml"];
if (stylesFile) {
  const stylesXml = stylesFile.asText();
  const customHeadingLike = stylesXml.match(
    /<w:style[^>]*w:styleId="([^"]*(?:ection|itle|eading)[^"]*)"[^>]*>/gi,
  );
  if (customHeadingLike) {
    console.log("\n6. Custom heading-like styles in styles.xml:");
    customHeadingLike.forEach((s) => {
      const id = s.match(/w:styleId="([^"]+)"/)?.[1];
      if (id) console.log("  -", id);
    });
  }
}

console.log("\n=====================================\n");
