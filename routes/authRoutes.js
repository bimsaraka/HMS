const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Authentication routes
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/profile', verifyToken, AuthController.getProfile);
router.get('/verify', verifyToken, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

module.exports = router;
