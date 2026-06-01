const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const isPasswordValid = password === user.password; // or bcrypt.compare(password, user.password)
    if (!isPasswordValid) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Send cookie along with JSON response
    res.cookie('token', token, {
      httpOnly: true,
      secure: false,       // true if using HTTPS
      sameSite: 'lax',     // 'none' + HTTPS if cross-domain
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    });

res.cookie('role', user.role_id, {
  httpOnly: false,     // frontend JS needs to read this
  secure: false,
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
});

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_id
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
