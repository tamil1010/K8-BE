import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretk8sdashboardtokenkey';

// Mock credentials database
const USERS = [
  { username: 'admin', password: 'admin123', role: 'Admin' },
  { username: 'developer', password: 'dev123', role: 'Developer' },
  { username: 'viewer', password: 'viewer123', role: 'Viewer' }
];

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password fields are required.'
      });
    }

    const user = USERS.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    // Generate JWT Token with role payload
    const token = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      data: {
        token,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    next(err);
  }
};
