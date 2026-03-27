const { JSDOM } = require("jsdom");

function htmlToBlocks(html = "") {
  const dom = new JSDOM(`<body>${html}</body>`);
  const body = dom.window.document.body;

  const blocks = [];

  body.childNodes.forEach(node => {
    if (node.nodeType !== 1) return;

    switch (node.tagName.toLowerCase()) {

      case "p":
        blocks.push({
          type: "paragraph",
          text: node.textContent.trim()
        });
        break;

      case "table":
        const rows = [];
        node.querySelectorAll("tr").forEach(tr => {
          const cells = [];
          tr.querySelectorAll("th,td").forEach(td => {
            cells.push(td.textContent.trim());
          });
          rows.push(cells);
        });
        blocks.push({ type: "table", rows });
        break;

      case "ol":
        blocks.push({
          type: "numbered-list",
          items: [...node.querySelectorAll("li")].map(li =>
            li.textContent.trim()
          )
        });
        break;

      case "ul":
        blocks.push({
          type: "bullet-list",
          items: [...node.querySelectorAll("li")].map(li =>
            li.textContent.trim()
          )
        });
        break;
    }
  });

  return blocks;
}

module.exports = htmlToBlocks;
