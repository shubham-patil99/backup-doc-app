const { Section } = require('../models').default;

exports.list = async (req, res) => {
  try {
    const userId = req.user.id;

    // Prefer ordering by `position` if the column exists, otherwise fallback to createdAt
    const orderClause = (Section && Section.rawAttributes && Section.rawAttributes.position)
      ? [['position', 'ASC']]
      : [['createdAt', 'ASC']];

    const sections = await Section.findAll({
      where: { createdBy: userId },
      order: orderClause
    });
    res.json(sections);
  } catch (err) {
    console.error("❌ Error fetching sections:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
