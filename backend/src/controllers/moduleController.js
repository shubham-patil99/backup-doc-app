const { Module, Section, User } = require('../models').default;

exports.create = async (req, res) => {
  const { name, description, sectionId } = req.body;
  if (!name || !sectionId) {
    return res.status(400).json({ error: 'name and sectionId required' });
  }

  const section = await Section.findByPk(sectionId);
  if (!section) return res.status(404).json({ error: 'Section not found' });

  const mod = await Module.create({
    name,
    description,
    sectionId,
    createdBy: req.user.id, // ensure logged-in user is stored
  });

  res.status(201).json(mod);
};

exports.list = async (req, res) => {
  try {
    const userId = req.user.id; // comes from auth middleware

    const items = await Module.findAll({
      where: { createdBy: userId }, // only this user's modules
      include: [
        { model: Section, attributes: ['id', 'title'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
    });

    res.json(items);
  } catch (err) {
    console.error("❌ Error fetching modules:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
