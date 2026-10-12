const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026';

function normalizeRole(role) {
  if (!role) return '';
  const r = String(role).toLowerCase().trim();
  if (r === 'administrator' || r === 'admin' || r === 'sysadmin') return 'admin';
  if (r === 'accountant' || r === 'finance') return 'accountant';
  if (r === 'receptionist' || r === 'reception') return 'receptionist';
  if (r === 'operations' || r === 'ops' || r === 'housekeeper') return 'operations';
  return r;
}

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim());

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Access token missing or required'
    });
  }

  const secret = process.env.JWT_SECRET || JWT_SECRET;
  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Invalid or expired token'
      });
    }
    req.user = decoded;
    next();
  });
}

function authorizeRoles(...roles) {
  const allowedRoles = roles.flat();
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'Access denied for this role'
      });
    }

    const userRoleStr = String(req.user.role).trim().toLowerCase();
    const normalizedUser = normalizeRole(userRoleStr);

    const isAllowed = allowedRoles.some(allowed => {
      const allowedStr = String(allowed).trim().toLowerCase();
      return allowedStr === userRoleStr || normalizeRole(allowedStr) === normalizedUser;
    });

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Access denied for this role'
      });
    }

    next();
  };
}

module.exports = {
  verifyToken,
  authorizeRoles,
  normalizeRole,
  JWT_SECRET
};

