import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretk8sdashboardtokenkey';

/**
 * JWT Authentication Middleware
 * Validates bearer token and attaches decoded user to request
 */
export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
      if (err) {
        console.error('JWT Verification Error:', err.message);
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Invalid or expired token.'
        });
      }

      req.user = decodedUser;
      next();
    });
  } else {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing authorization header.'
    });
  }
};

/**
 * RBAC Middleware
 * Restricts access to endpoints based on user roles
 * @param {Array<string>} allowedRoles
 */
export const authorizeRBAC = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Session not found.'
      });
    }

    const { role } = req.user;

    // Check if role matches allowed list
    if (allowedRoles.includes(role)) {
      next();
    } else {
      console.warn(`RBAC Warning: User "${req.user.username}" with role "${role}" attempted unauthorized access to ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permissions to perform this action.'
      });
    }
  };
};
