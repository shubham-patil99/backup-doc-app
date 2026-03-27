const express = require('express');
const router = express.Router();
const Module = require('../models/module');
const cheerio = require('cheerio');

const fs = require('fs');
const path = require('path');

// Ensure upload dir exists
const IMAGES_DIR = path.join(__dirname, '..', 'uploads', 'images');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

// Convert base64 images into files and replace src with absolute URL using baseUrl
const saveBase64Images = (html, baseUrl = "") => {
  if (!html) return html;
  return html.replace(/<img\b([^>]*?)\bsrc=["'](data:image\/(?:png|jpe?g|gif|webp);base64,([^"']+))["']([^>]*)>/gi,
    (match, preAttrs, fullDataUri, b64) => {
      try {
        const buffer = Buffer.from(b64, 'base64');
        // derive extension from data URI
        const extMatch = fullDataUri.match(/^data:image\/([a-z0-9]+);base64/i);
        const extension = extMatch ? (extMatch[1] === 'jpeg' ? 'jpg' : extMatch[1]) : 'png';
        const filename = `img_${Date.now()}_${Math.floor(Math.random() * 10000)}.${extension}`;
        const filepath = path.join(IMAGES_DIR, filename);
        fs.writeFileSync(filepath, buffer);
        const url = (baseUrl ? baseUrl.replace(/\/$/, '') : '') + `/uploads/images/${filename}`; // absolute if baseUrl provided
        return `<img${preAttrs || ''} src="${url}"${arguments[4] || ''}>`;
      } catch (e) {
        console.warn('Failed to persist base64 image:', e && e.message);
        return match;
      }
    }
  );
};

// --- Utility: strip all HTML inside <td> ---
const stripTagsInsideTd = (html) => {
  if (!html) return html;
  const $ = cheerio.load(html, { decodeEntities: true });

  $("td").each((i, td) => {
    const text = $(td).text().replace(/\n/g, ' ').trim(); // remove line breaks
    $(td).html(text); // replace inner HTML with plain text
  });

  return $.html();
};

// --- Utility: sanitize <p> and <li> tags ---
const sanitizeParagraphsAndLists = (html) => {
  if (!html) return html;
  const $ = cheerio.load(html, { decodeEntities: true });

  // Formatting tags to preserve: bold, italic, underline, strikethrough, span with color
  const formattingTags = ['b', 'i', 'u', 's', 'strong', 'em', 'span'];
  
  const preserveFormatting = (node) => {
    if (node.type !== 'tag') return null;
    if (formattingTags.includes(node.name)) {
      return $.html(node);
    }
    return null;
  };

  // Sanitize paragraphs but preserve <img>, <a>, <br>, formatting tags, and nested lists <ul>/<ol>
  $("p").each((i, p) => {
    let parts = [];
    $(p).contents().each((_, node) => {
      if (node.type === 'tag' && node.name === 'img') {
        parts.push($.html(node));
      } else if (node.type === 'tag' && node.name === 'br') {
        // Preserve <br> tags for line breaks
        parts.push('<br>');
      } else if (node.type === 'tag' && node.name === 'a') {
        const href = $(node).attr('href') || '';
        const text = $(node).text().replace(/&nbsp;/g, ' ').trim();
        parts.push(`<a href="${href}">${text}</a>`);
      } else if (node.type === 'tag' && (node.name === 'ul' || node.name === 'ol')) {
        // Preserve nested lists inside paragraphs
        parts.push($.html(node));
      } else {
        const formatted = preserveFormatting(node);
        if (formatted) {
          parts.push(formatted);
        } else {
          const text = $(node).text ? $(node).text().replace(/&nbsp;/g, ' ').trim() : '';
          if (text) parts.push(text);
        }
      }
    });
    $(p).html(parts.join(' '));
  });

  // Sanitize list items similarly, preserving images, links, <br>, formatting tags and nested lists
  $("ul li, ol li").each((i, li) => {
    let parts = [];
    $(li).contents().each((_, node) => {
      if (node.type === 'tag' && node.name === 'img') {
        parts.push($.html(node));
      } else if (node.type === 'tag' && node.name === 'br') {
        // Preserve <br> tags for line breaks
        parts.push('<br>');
      } else if (node.type === 'tag' && node.name === 'a') {
        const href = $(node).attr('href') || '';
        const text = $(node).text().replace(/&nbsp;/g, ' ').trim();
        parts.push(`<a href="${href}">${text}</a>`);
      } else if (node.type === 'tag' && (node.name === 'ul' || node.name === 'ol')) {
        // Preserve nested lists inside li
        parts.push($.html(node));
      } else {
        const formatted = preserveFormatting(node);
        if (formatted) {
          parts.push(formatted);
        } else {
          const text = $(node).text ? $(node).text().replace(/&nbsp;/g, ' ').trim() : '';
          if (text) parts.push(text);
        }
      }
    });
    $(li).html(parts.join(' '));
  });

  return $.html();
 };

// --- Combine sanitizers for description ---
const sanitizeHtml = (html, baseUrl = "") => {
  // Convert embedded base64 images to files and replace with URL first
  html = saveBase64Images(html, baseUrl);
  html = stripTagsInsideTd(html);               // clean <td> content
  html = sanitizeParagraphsAndLists(html);     // clean <p> and <li> content
  return html;
};

// Get All Modules
router.get('/', async (req, res) => {
  try {
    const modules = await Module.findAll({
      order: [
        ['sortOrder', 'ASC'],
        ['id', 'ASC']
      ]
    });
    res.json(modules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Module
router.post('/', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const payload = {
      name: req.body.name,
      description: sanitizeHtml(req.body.description, baseUrl), // pass baseUrl so DB stores absolute URL
      sectionId: req.body.sectionId || req.body.section_id,
      createdBy: req.body.createdBy || req.body.created_by,
      canEdit: req.body.canEdit ?? req.body.can_edit ?? false,
      sortOrder: typeof req.body.sortOrder !== 'undefined' ? req.body.sortOrder : (req.body.sort_order ?? 0),
    };
    console.log(`Saving module (len=${(payload.description||'').length}) preview:`, (payload.description||'').slice(0,200));
    const module = await Module.create(payload);
    res.status(201).json(module);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Module by ID
router.get('/:id', async (req, res) => {
  try {
    const module = await Module.findByPk(req.params.id);
    if (!module) return res.status(404).json({ error: 'Module not found' });
    res.json(module);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Module
router.put('/:id', async (req, res) => {
  try {
    const module = await Module.findByPk(req.params.id);
    if (!module) return res.status(404).json({ error: 'Module not found' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const { name, description, canEdit, sortOrder } = req.body;
    const updated = await module.update({
      name: typeof name !== 'undefined' ? name : module.name,
      description: typeof description !== 'undefined' ? sanitizeHtml(description, baseUrl) : module.description,
      canEdit: typeof canEdit !== 'undefined' ? canEdit : module.canEdit,
      ...(typeof sortOrder !== 'undefined' ? { sortOrder } : {})
    });

    console.log(`Updated module ${module.id} (len=${(updated.description||'').length})`);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Module
router.delete('/:id', async (req, res) => {
  try {
    const module = await Module.findByPk(req.params.id);
    if (!module) return res.status(404).json({ error: 'Module not found' });
    await module.destroy();
    res.json({ message: 'Module deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
