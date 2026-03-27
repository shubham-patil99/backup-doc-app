/**
 * ENTERPRISE GRADE DOCUMENT GENERATOR
 * Converts structured content to Word COM-compatible JSON blocks
 * No templates, pure programmatic document generation
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Regex patterns for HTML parsing
const REGEX_PATTERNS = {
  link: /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi,
  image: /<img\b[^>]*src="([^">]+)"[^>]*(?:width="([^"]+)")?[^>]*(?:height="([^"]+)")?[^>]*>/gi,
  table: /<table[^>]*>([\s\S]*?)<\/table>/gi,
  tbody: /<tbody[^>]*>([\s\S]*?)<\/tbody>/i,
  tableRow: /<tr[^>]*>([\s\S]*?)<\/tr>/gi,
  tableCell: /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi,
  br: /<br\s*\/?>/gi,
  htmlTag: /<[^>]*>/g
};

/**
 * Convert HTML to plain text (removes all tags and decodes entities)
 */
const htmlToPlainText = (html) => {
  if (!html) return '';

  let text = html
    .replace(/(<\/p\s*>){2,}/gi, '\n\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(REGEX_PATTERNS.br, '\n')
    .replace(REGEX_PATTERNS.link, (match, url, linkText) => {
      const cleanText = linkText.replace(REGEX_PATTERNS.htmlTag, '').trim();
      return cleanText ? `${cleanText} (${url})` : url;
    })
    .replace(REGEX_PATTERNS.htmlTag, '')
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

/**
 * Extract image dimensions from HTML
 * Supports: width="" height="" and style="width:300px; height:200px"
 */
const extractImageDimensions = (imgTag) => {
  const dimensions = {
    width: 0,
    height: 0
  };

  // Try width="" attribute
  const widthMatch = imgTag.match(/width\s*=\s*["']?(\d+)/i);
  if (widthMatch) {
    dimensions.width = parseInt(widthMatch[1], 10);
  }

  // Try height="" attribute
  const heightMatch = imgTag.match(/height\s*=\s*["']?(\d+)/i);
  if (heightMatch) {
    dimensions.height = parseInt(heightMatch[1], 10);
  }

  // Try style attribute: style="width:300px; height:200px"
  const styleMatch = imgTag.match(/style\s*=\s*["']([^"']+)/i);
  if (styleMatch) {
    const style = styleMatch[1];
    
    const widthStyleMatch = style.match(/width\s*:\s*(\d+)px/i);
    if (widthStyleMatch && !widthMatch) {
      dimensions.width = parseInt(widthStyleMatch[1], 10);
    }

    const heightStyleMatch = style.match(/height\s*:\s*(\d+)px/i);
    if (heightStyleMatch && !heightMatch) {
      dimensions.height = parseInt(heightStyleMatch[1], 10);
    }
  }

  return dimensions;
};

/**
 * Extract tables from HTML
 */
const extractTables = (html) => {
  const tables = [];
  const tableRegex = new RegExp(REGEX_PATTERNS.table.source, 'gi');
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    let tableHTML = tableMatch[1];
    const tbodyMatch = tableHTML.match(REGEX_PATTERNS.tbody);
    if (tbodyMatch) {
      tableHTML = tbodyMatch[1];
    }

    const tableRows = [];
    const rowMatches = [...tableHTML.matchAll(new RegExp(REGEX_PATTERNS.tableRow.source, 'gi'))];

    for (let rowIndex = 0; rowIndex < rowMatches.length; rowIndex++) {
      const rowHTML = rowMatches[rowIndex][1];
      const cellMatches = [...rowHTML.matchAll(new RegExp(REGEX_PATTERNS.tableCell.source, 'gi'))];

      const cells = cellMatches.map(cellMatch => {
        return htmlToPlainText(cellMatch[1]) || ' ';
      });

      if (cells.length > 0) {
        tableRows.push({
          cells,
          isHeader: rowIndex === 0
        });
      }
    }

    if (tableRows.length === 0) continue;

    const maxColumns = Math.max(...tableRows.map(row => row.cells.length));

    // Pad rows
    tableRows.forEach(row => {
      while (row.cells.length < maxColumns) {
        row.cells.push(' ');
      }
    });

    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(1);

    // Create header array
    const header = headerRow.cells;

    // Create rows array (array of arrays, not objects)
    const rows = dataRows.map(row => row.cells);

    tables.push({
      header: header,
      rows: rows,
      columnCount: maxColumns,
      rowCount: dataRows.length
    });
  }

  return tables;
};

/**
 * Parse HTML list items with nesting support
 */
const parseHtmlList = (html) => {
  if (!html) return [];
  const $ = cheerio.load(`<div>${html}</div>`, { decodeEntities: true });

  const parseListItems = ($list, depth = 0) => {
    const items = [];

    $list.children('li').each((i, li) => {
      const $li = $(li);

      // Get text without nested lists
      const $clone = $li.clone();
      $clone.find('ul, ol').remove();
      const text = $clone.text().trim();

      // Check for nested lists
      const $nestedList = $li.children('ul, ol').first();
      const hasNested = $nestedList.length > 0;

      const item = {
        text: text,
        depth: depth
      };

      if (hasNested && depth < 3) {
        const nestedListType = $nestedList.prop('tagName').toLowerCase() === 'ol' ? 'number' : 'bullet';
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

  const $root = $('div > ul, div > ol').first();
  if ($root.length === 0) return [];

  return parseListItems($root, 0);
};

/**
 * Parse HTML content into structured blocks for Word COM
 * Returns array of blocks: [{ type, text, src, width, height, header, rows, items, listType }]
 */
const parseHtmlToBlocks = (html) => {
  if (!html) return [];

  const blocks = [];

  // Remove width/height attributes to avoid conflicts
  html = html.replace(/\s*(?:width|height)\s*=\s*"[^"]*"/gi, '');

  // Find all major elements
  const patterns = [
    { type: 'table', re: new RegExp(REGEX_PATTERNS.table.source, 'gi') },
    { type: 'image', re: new RegExp(REGEX_PATTERNS.image.source, 'gi') },
  ];

  const matches = [];

  patterns.forEach(p => {
    let m;
    while ((m = p.re.exec(html)) !== null) {
      matches.push({
        type: p.type,
        index: m.index,
        match: m[0],
        endIndex: m.index + m[0].length,
        groups: m
      });
    }
  });

  // Find top-level lists
  const listRegex = /<(ul|ol)[^>]*>[\s\S]*?<\/\1>/gi;
  let listMatch;
  while ((listMatch = listRegex.exec(html)) !== null) {
    matches.push({
      type: 'list',
      index: listMatch.index,
      match: listMatch[0],
      endIndex: listMatch.index + listMatch[0].length
    });
  }

  // Sort by position
  matches.sort((a, b) => a.index - b.index);

  let lastIndex = 0;

  for (const item of matches) {
    // Add text before this element as paragraph
    if (item.index > lastIndex) {
      const textBefore = html.slice(lastIndex, item.index);
      const plainText = htmlToPlainText(textBefore);

      if (plainText && plainText.trim().length > 0 && plainText.trim() !== '>') {
        blocks.push({
          type: 'paragraph',
          text: plainText,
          format: 'justify',
          fontSize: 11,
          fontName: 'Calibri'
        });
      }
    }

    if (item.type === 'table') {
      const tables = extractTables(item.match);
      tables.forEach(tbl => {
        blocks.push({
          type: 'table',
          header: tbl.header,
          rows: tbl.rows,
          columnCount: tbl.columnCount,
          rowCount: tbl.rowCount
        });
      });
    } else if (item.type === 'image') {
      const imgMatch = item.match.match(new RegExp(REGEX_PATTERNS.image.source, 'i'));
      if (imgMatch) {
        const src = imgMatch[1];
        const dimensions = extractImageDimensions(item.match);

        blocks.push({
          type: 'image',
          src: src,
          width: dimensions.width || 300,  // Default: 300px if not specified
          height: dimensions.height || 200 // Default: 200px if not specified
        });
      }
    } else if (item.type === 'list') {
      const listType = item.match.trim().startsWith('<ol') ? 'number' : 'bullet';
      const items = parseHtmlList(item.match);

      if (items.length > 0) {
        blocks.push({
          type: 'list',
          listType: listType,
          items: items
        });
      }
    }

    lastIndex = item.endIndex;
  }

  // Add trailing text
  if (lastIndex < html.length) {
    const tailText = html.slice(lastIndex);
    const plainText = htmlToPlainText(tailText);

    if (plainText && plainText.trim().length > 0 && plainText.trim() !== '>') {
      blocks.push({
        type: 'paragraph',
        text: plainText,
        format: 'justify',
        fontSize: 11,
        fontName: 'Calibri'
      });
    }
  }

  return blocks;
};

/**
 * Build complete document blocks from sections and modules
 * This is the main function that creates the final block structure
 */
const buildDocumentBlocks = (sections, assignedModules, metadata = {}) => {
  const blocks = [];
  const { customerName, partnerName, opeId, documentTitle, date, documentStatus } = metadata;

  // Add title
  if (documentTitle) {
    blocks.push({
      type: 'heading',
      text: documentTitle,
      level: 1,
      fontSize: 16,
      bold: true
    });
  }

  // Add document header info
  if (customerName || partnerName || opeId) {
    const headerInfo = [];
    if (customerName) headerInfo.push(`Customer: ${customerName}`);
    if (partnerName) headerInfo.push(`Partner: ${partnerName}`);
    if (opeId) headerInfo.push(`OPE ID: ${opeId}`);
    if (date) headerInfo.push(`Date: ${date}`);
    if (documentStatus) headerInfo.push(`Status: ${documentStatus}`);

    if (headerInfo.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: headerInfo.join(' | '),
        fontSize: 10,
        italics: true
      });
    }

    // Add spacing
    blocks.push({
      type: 'paragraph',
      text: ''
    });
  }

  // Process sections
  if (Array.isArray(sections)) {
    sections.forEach((section, sectionIndex) => {
      // Add section heading
      if (section.title) {
        blocks.push({
          type: 'heading',
          text: `${sectionIndex + 1}. ${section.title}`,
          level: 2,
          fontSize: 13,
          bold: true
        });
      }

      // Add section description
      if (section.description) {
        blocks.push({
          type: 'paragraph',
          text: section.description,
          format: 'justify'
        });
      }

      // Add modules in this section
      const sectionModules = assignedModules && assignedModules[section.id];
      if (Array.isArray(sectionModules)) {
        sectionModules.forEach((mod, modIndex) => {
          // Add module name if present
          if (mod.name) {
            blocks.push({
              type: 'heading',
              text: `${sectionIndex + 1}.${modIndex + 1}. ${mod.name}`,
              level: 3,
              fontSize: 12
            });
          }

          // Parse module description into blocks
          if (mod.description) {
            const contentBlocks = parseHtmlToBlocks(mod.description);
            blocks.push(...contentBlocks);
          }
        });
      }

      // Add spacing between sections
      blocks.push({
        type: 'paragraph',
        text: ''
      });
    });
  }

  return blocks;
};

module.exports = {
  htmlToPlainText,
  extractImageDimensions,
  extractTables,
  parseHtmlList,
  parseHtmlToBlocks,
  buildDocumentBlocks
};
