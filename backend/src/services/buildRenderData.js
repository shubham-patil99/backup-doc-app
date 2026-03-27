const htmlToBlocks = require("../utils/htmlToBlocks");

function buildRenderData(draft, options = {}) {
  const sections = draft.content?.documentSections || [];
  const assigned = draft.content?.assigned || {};

  let sectionCounter = 0;

  const renderSections = sections.map(section => {
    sectionCounter++;

    const sectionBlocks = [];

    const modules = assigned[section.id] || [];

    modules.forEach(module => {
      if (module.name?.trim()) {
        sectionBlocks.push({
          type: "heading",
          level: 2,
          text: module.name
        });
      }

      const blocks = htmlToBlocks(module.description || "");
      sectionBlocks.push(...blocks);
    });

    sectionBlocks.push({ type: "page-break" });

    return {
      sectionNumber: String(sectionCounter),
      title: section.title,
      blocks: sectionBlocks
    };
  });

  return {
    meta: {
      docTitle: draft.fileName,
      customerName: draft.customerName,
      partnerName: draft.partnerName || "",
      version: draft.version,
      date: new Date(draft.updatedAt).toLocaleDateString(),
      opeId: draft.opeId,
      status: draft.status
    },
    sections: renderSections
  };
}

module.exports = buildRenderData;
