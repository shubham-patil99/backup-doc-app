const Draft = require("../models/draft");
const Final = require("../models/final");

exports.getUserDashboardData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search ? req.query.search.toLowerCase() : null;

    // Fetch all drafts and documents ordered by createdAt DESC
    const drafts = await Draft.findAll({
      order: [["createdAt", "DESC"]],
    });

    const documents = await Final.findAll({
      order: [["createdAt", "DESC"]],
    });

    // Merge all unique OPE IDs
    const opeIds = new Set([
      ...drafts.map((d) => d.opeId),
      ...documents.map((doc) => doc.opeId),
    ]);

   const merged = Array.from(opeIds).map((opeId) => {
  const draft = drafts.find((d) => d.opeId === opeId) || null;
  const document = documents.find((doc) => doc.opeId === opeId) || null;

  let status = "Pending";
  if (draft && !document) status = "Drafted";
  if (document) status = "Finalized";

  return {
    opeId,
    status,
    draftCustomer: draft ? {
      name: draft.customerName,
      email: draft.customerEmail,
      address: draft.customerAddress
    } : null,
    documentCustomer: document ? {
      name: document.customerName,
      email: document.customerEmail,
      address: document.customerAddress 
    } : null,
    draft,
    document,
  };
});


    // Apply search filter (on OPE ID + customer name/email)
    const filtered = search
      ? merged.filter(
          (r) =>
          r.opeId.toLowerCase().includes(search) ||
          r.draftCustomer?.name?.toLowerCase().includes(search) ||
          r.draftCustomer?.email?.toLowerCase().includes(search) ||
          r.documentCustomer?.name?.toLowerCase().includes(search) ||
          r.documentCustomer?.email?.toLowerCase().includes(search)
        )
      : merged;

    // Sort merged results by createdAt (latest first)
    filtered.sort((a, b) => {
      const aDate = a.document?.createdAt || a.draft?.createdAt || 0;
      const bDate = b.document?.createdAt || b.draft?.createdAt || 0;
      return new Date(bDate) - new Date(aDate); // latest first
    });

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      page,
      totalPages,
      totalItems,
      data: paginated,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch user dashboard data" });
  }
};
