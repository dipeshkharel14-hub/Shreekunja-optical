/**
 * routes/ai.js
 * Mounted at /api/ai. Public chat (spec section 39: "AI basic chat"
 * is a public capability); `identify` still runs so a logged-in
 * customer's identity is available to the AI service for order
 * lookups (spec section 31), without requiring login to chat at all.
 */

const express = require('express');
const router = express.Router();

const aiController = require('../controllers/aiController');
const { identify } = require('../middleware/auth');
const { aiChatLimiter } = require('../middleware/rateLimit');

router.post('/chat', identify, aiChatLimiter, aiController.chat);

module.exports = router;
