const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const cheerio = require("cheerio");
const Docxtemplater = require("docxtemplater");
const PizZip = require("pizzip");
const Draft = require("../models/draft");

// Convert HTML to plain text
const htmlToPlainText = (html) => {
  if (!html) return '';

  let text = html
    .replace(/(<\/p\s*>){2,}/gi, '\n\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (match, url, linkText) => {
      const cleanText = linkText.replace(/<[^>]*>/g, '').trim();
      return cleanText ? `${cleanText} (${url})` : url;
    })
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const lines = text.split('\n');
  const normalizedLines = lines.map(line => line.replace(/\s+/g, ' ').trim());

  return normalizedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

// Extract formatting info from HTML (for post-processing in PowerShell)
const extractFormattingInfo = (html) => {
  if (!html) return [];
  
  const $ = cheerio.load(`<div>${html}</div>`, { decodeEntities: true });
  const formatting = [];
  
  const plainText = htmlToPlainText(html);
  let offset = 0;
  
  const parseNode = (node, state = {}) => {
    const tagName = node.name ? node.name.toLowerCase() : null;
    let currentState = { ...state };

    if (tagName === 'strong' || tagName === 'b') currentState.bold = true;
    if (tagName === 'em' || tagName === 'i') currentState.italic = true;
    if (tagName === 'u') currentState.underline = true;
    if (tagName === 's' || tagName === 'strike') currentState.strikethrough = true;

    if (node.type === 'text') {
      const text = node.data || "";
      if (text.trim()) {
        const plainLength = text.length;
        if (currentState.bold || currentState.italic || currentState.underline || currentState.strikethrough) {
          formatting.push({
            text: text.trim(),
            bold: !!currentState.bold,
            italic: !!currentState.italic,
            underline: !!currentState.underline,
            strikethrough: !!currentState.strikethrough
          });
        }
      }
      return;
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        parseNode(child, currentState);
      }
    }
  };

  $('div').children().each((i, el) => {
    if (el.type === 'tag') {
      parseNode(el, {});
    }
  });

  return formatting;
};

// Parse HTML list items into structured format
const parseListItems = (html) => {
  if (!html) return [];
  const $ = cheerio.load(`<div>${html}</div>`, { decodeEntities: true });
  
  const items = [];
  const parseItems = ($list, depth = 0) => {
    $list.children('li').each((i, li) => {
      const $li = $(li);
      const $clone = $li.clone();
      $clone.find('ul, ol').remove();
      const text = $clone.text().trim();
      const html = $clone.html().trim();
      
      const $nested = $li.children('ul, ol').first();
      const item = {
        text: text,
        html: html,
        depth: depth,
        nestedItems: []
      };
      
      if ($nested.length > 0 && depth < 3) {
        item.nestedItems = parseItems($nested, depth + 1);
      }
      
      items.push(item);
    });
    return items;
  };
  
  const $root = $('div > ul, div > ol').first();
  if ($root.length === 0) return [];
  
  return parseItems($root, 0);
};

// Parse HTML content into blocks
const parseHtmlContent = (html) => {
  if (!html) return { blocks: [] };
  
  const blocks = [];
  const listRegex = /<(ul|ol)[^>]*>/gi;
  const matches = [];
  let match;

  // Find tables
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  while ((match = tableRegex.exec(html)) !== null) {
    matches.push({ type: 'table', index: match.index, match: match[0], endIndex: match.index + match[0].length });
  }

  // Find lists
  listRegex.lastIndex = 0;
  while ((match = listRegex.exec(html)) !== null) {
    const startIndex = match.index;
    const tagType = match[1].toLowerCase();
    
    let depth = 1;
    let currentPos = match.index + match[0].length;
    const openTag = new RegExp(`<${tagType}[^>]*>`, 'gi');
    const closeTag = new RegExp(`</${tagType}>`, 'gi');
    
    while (depth > 0 && currentPos < html.length) {
      openTag.lastIndex = currentPos;
      closeTag.lastIndex = currentPos;
      
      const nextOpen = openTag.exec(html);
      const nextClose = closeTag.exec(html);
      
      if (!nextClose) break;
      
      if (nextOpen && nextOpen.index < nextClose.index) {
        depth++;
        currentPos = nextOpen.index + nextOpen[0].length;
      } else {
        depth--;
        currentPos = nextClose.index + nextClose[0].length;
        
        if (depth === 0) {
          const endIndex = currentPos;
          const listHtml = html.slice(startIndex, endIndex);
          matches.push({
            type: 'list',
            index: startIndex,
            match: listHtml,
            endIndex: endIndex
          });
        }
      }
    }
  }

  matches.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
  for (const item of matches) {
    if (item.index > lastIndex) {
      const rawHtml = html.slice(lastIndex, item.index);
      const gapText = htmlToPlainText(rawHtml);
      if (gapText) {
        blocks.push({ 
          type: 'paragraph', 
          text: gapText, 
          html: rawHtml,
          formatting: extractFormattingInfo(rawHtml)
        });
      }
    }

    if (item.type === 'list') {
      const listType = item.match.trim().startsWith("<ol") ? "numbered" : "bulleted";
      const listItems = parseListItems(item.match);
      
      if (listItems.length > 0) {
        blocks.push({
          type: 'list',
          listType,
          items: listItems,
          formatting: listItems.map(it => extractFormattingInfo(it.html))
        });
      }
    }
    
    lastIndex = item.endIndex;
  }

  if (lastIndex < html.length) {
    const tailRaw = html.slice(lastIndex);
    const tailText = htmlToPlainText(tailRaw);
    if (tailText) {
      blocks.push({ 
        type: 'paragraph', 
        text: tailText, 
        html: tailRaw,
        formatting: extractFormattingInfo(tailRaw)
      });
    }
  }

  return { blocks };
};

// Process modules for template
const processModulesForTemplate = (mods) => {
  if (!Array.isArray(mods)) return [];
  
  return mods.map((mod) => {
    const parsed = parseHtmlContent(mod.description || "");

    const displayText = parsed.blocks
      .map(b => {
        if (b.type === 'paragraph') return b.text;
        if (b.type === 'list') {
          const flatItems = (items, depth = 0) => {
            const result = [];
            for (const it of items) {
              const prefix = b.listType === 'numbered' ? `${it.index || 1}.` : '•';
              const indent = '  '.repeat(depth);
              const line = `${indent}${prefix} ${it.text}`;
              result.push(line);
              
              if (it.nestedItems && it.nestedItems.length > 0 && depth < 3) {
                result.push(...flatItems(it.nestedItems, depth + 1));
              }
            }
            return result;
          };
          return flatItems(b.items).join('\n');
        }
        return '';
      })
      .join('\n\n');

    return {
      id: mod.id,
      name: mod.name || "",
      description: displayText,
      html: mod.description || "",
      blocks: parsed.blocks
    };
  });
};

// Main document generation function
exports.generateDocument = async (req, res) => {
  try {
    const { opeId } = req.params;
    const status = req.body.status || req.query.status || "draft";
    const docVersion = parseInt(req.body.docVersion || req.query.docVersion || 1);

    const {
      customerName,
      customerEmail,
      customerAddress,
      partnerName,
      sections: reqSections,
      assigned: reqAssigned,
      documentTitle,
      createdAtFormatted,
    } = req.body || {};

    const draft = await Draft.findOne({ where: { opeId } });
    if (!draft) return res.status(404).json({ error: "Draft not found" });

    let sections = reqSections || draft.content?.body?.sections || [];
    let assignedRaw = reqAssigned || draft.content?.body?.assigned || {};
    if (!Array.isArray(sections)) sections = [];

    // Build template data
    const templateData = {
      isDraft: status === "draft",
      isFinal: status === "final",
      documentStatus: status.toUpperCase(),
      customerName: customerName || draft.customerName || "",
      partnerName: partnerName || draft.partnerName || "",
      opeId: opeId || draft.opeId || "",
      documentTitle: documentTitle || draft.documentName || "Document",
      date: createdAtFormatted || (draft && (draft.created_at || draft.createdAt) 
        ? new Date(draft.created_at || draft.createdAt).toLocaleDateString() 
        : new Date().toLocaleDateString()),
      version: docVersion,
      sections: []
    };

    // Process sections
    sections.forEach((section, sectionIndex) => {
      const sectionModules = assignedRaw[section.id] || [];
      const processedModules = Array.isArray(sectionModules) 
        ? processModulesForTemplate(sectionModules) 
        : [];

      const sectionData = {
        title: section.title,
        description: htmlToPlainText(section.description || ""),
        sectionNumber: sectionIndex + 1,
        modules: processedModules.map((mod, idx) => ({
          ...mod,
          moduleNumber: mod.name ? `${sectionIndex + 1}.${idx + 1}` : ""
        }))
      };

      templateData.sections.push(sectionData);
    });

    // Get template path
    const templatePath = path.join(__dirname, "../templates/template.docx");
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: "Template file not found" });
    }

    // Load and render template
    const templateContent = fs.readFileSync(templatePath);
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, { linebreaks: true });

    doc.render(templateData);

    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const outputDocPath = path.join(tempDir, `document-${Date.now()}.docx`);
    fs.writeFileSync(outputDocPath, buffer);

    console.log("✅ Document generated from template:", outputDocPath);

    // Read and send
    const docxBuffer = fs.readFileSync(outputDocPath);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${documentTitle}-v${docVersion}.docx"`);
    res.send(docxBuffer);

    // Cleanup
    try { fs.unlinkSync(outputDocPath); } catch {}

  } catch (err) {
    console.error("❌ Error generating document:", err);
    res.status(500).json({ error: err.message || "Failed to generate document" });
  }
};
