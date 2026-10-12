const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pinnacle_bay_hotel_super_secret_jwt_key_2026';

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token missing or required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: 'Unauthorized: User role not specified' });
    }
    const userRole = req.user.role.toLowerCase();
    const isAllowed = allowedRoles.some(role => role.toLowerCase() === userRole);
    if (!isAllowed) {
      return res.status(403).json({ success: false, message: `Access denied for role ${req.user.role}` });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  authorizeRoles,
  JWT_SECRET
};
