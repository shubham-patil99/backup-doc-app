const User = require('../models/user');
const Role = require('../models/role');

// GET all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({ include: [{ model: Role, as: 'role' }] });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET single user by id
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { include: [{ model: Role, as: 'role' }] });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CREATE user
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;
    const user = await User.create({ name, email, password, role_id });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE user
exports.updateUser = async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await user.update({ name, email, password, role_id });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await user.destroy();
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
