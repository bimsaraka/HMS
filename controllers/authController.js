const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, poolPromise, fallbackDb } = require('../config/db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

function getRedirectUrlForRole(role) {
  const r = (role || '').toLowerCase();
  if (r === 'administrator' || r === 'admin') {
    return 'admin-dashboard.html';
  }
  if (r === 'receptionist') {
    return 'reception-dashboard.html';
  }
  if (r === 'operations') {
    return 'ops-dashboard.html';
  }
  if (r === 'accountant' || r === 'finance') {
    return 'finance-dashboard.html';
  }
  return 'admin-dashboard.html';
}

class AuthController {
  static async login(req, res) {
    try {
      const { email, username, password } = req.body;
      const userIdentifier = (email || username || '').trim();

      if (!userIdentifier || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username/email and password are required.'
        });
      }

      let user = null;
      const pool = await poolPromise;

      if (pool) {
        try {
          const query = `
            SELECT id, user_id, name, email, password, role, designation, status
            FROM Users
            WHERE LOWER(email) = LOWER(@identifier) OR LOWER(user_id) = LOWER(@identifier) OR LOWER(name) = LOWER(@identifier)
          `;
          const result = await pool.request()
            .input('identifier', sql.VarChar, userIdentifier)
            .query(query);

          if (result.recordset.length > 0) {
            user = result.recordset[0];
          }
        } catch (dbErr) {
          console.warn('DB query error in login, falling back to in-memory users:', dbErr.message);
        }
      }

      // Fallback in-memory search
      if (!user) {
        user = fallbackDb.users.find(u => 
          (u.email && u.email.toLowerCase() === userIdentifier.toLowerCase()) ||
          (u.user_id && u.user_id.toLowerCase() === userIdentifier.toLowerCase()) ||
          (u.name && u.name.toLowerCase() === userIdentifier.toLowerCase())
        );
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      if (user.status && user.status.toLowerCase() === 'inactive') {
        return res.status(403).json({
          success: false,
          message: 'Your account is deactivated. Please contact the administrator.'
        });
      }

      // Check password: plain text match or bcrypt compare
      let isMatch = false;
      if (user.password === password) {
        isMatch = true;
      } else {
        try {
          isMatch = await bcrypt.compare(password, user.password);
        } catch (e) {
          isMatch = false;
        }
      }

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      const usernameVal = user.username || user.user_id || user.name || user.email;
      const userIdVal = user.id !== undefined ? user.id : (user.user_id || 1);
      const redirectUrl = getRedirectUrlForRole(user.role);

      const tokenPayload = {
        id: userIdVal,
        username: usernameVal,
        role: user.role,
        user_id: user.user_id || userIdVal,
        name: user.name || usernameVal,
        email: user.email
      };

      const secret = process.env.JWT_SECRET || JWT_SECRET;
      const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
      const token = jwt.sign(tokenPayload, secret, { expiresIn });

      return res.status(200).json({
        success: true,
        message: 'Login successful!',
        token,
        redirect: redirectUrl,
        redirectUrl: redirectUrl,
        user: {
          id: userIdVal,
          username: usernameVal,
          role: user.role,
          user_id: user.user_id,
          name: user.name || usernameVal,
          email: user.email,
          designation: user.designation,
          redirect: redirectUrl,
          redirectUrl: redirectUrl
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authentication.'
      });
    }
  }

  static async logout(req, res) {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  }

  static async getProfile(req, res) {
    return res.status(200).json({
      success: true,
      user: req.user
    });
  }
}

module.exports = AuthController;
