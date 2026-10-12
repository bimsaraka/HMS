const express = require('express');
const router = express.Router();
const ChatbotController = require('../controllers/chatbotController');

// Chatbot Query Endpoints
router.post('/query', ChatbotController.query);
router.post('/', ChatbotController.query);

module.exports = router;
