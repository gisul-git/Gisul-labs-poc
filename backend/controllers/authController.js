const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Demo user store — replace with DB in production
const USERS = [
  {
    id: '1',
    username: process.env.ADMIN_USERNAME || 'admin',
    // Store hashed password — this is generated at startup
    passwordHash: null,
  },
];

// Hash the admin password at startup
(async () => {
  const plain = process.env.ADMIN_PASSWORD || 'admin123';
  USERS[0].passwordHash = await bcrypt.hash(plain, 12);
})();

function issueToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const user = USERS.find(u => u.username === username);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = issueToken(user);

    // HTTP-only cookie — not accessible via JS
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    res.json({ message: 'Logged in', user: { id: user.id, username: user.username } });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
}

function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, logout, me };
