/**
 * controllers/aiController.js
 *
 * Preserves the exact NDJSON streaming protocol the existing frontend
 * already parses (spec section 61):
 *   {"type":"chunk","text":"..."}
 *   {"type":"done","sources":[...],"searched":bool}
 *   {"type":"error","error":"..."}
 */

const aiService = require('../services/aiService');
const logger = require('../utils/logger');

function redact(message) {
  const secrets = [process.env.GEMINI_API_KEY].filter(Boolean);
  let text = String(message);
  for (const s of secrets) {
    if (s.length >= 6) text = text.split(s).join('[REDACTED]');
  }
  return text;
}

async function chat(req, res) {
  try {
    const { message, history } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'message is required.' } });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    const { sources, searched } = await aiService.streamChat({
      message,
      history,
      onChunk: (text) => {
        res.write(JSON.stringify({ type: 'chunk', text }) + '\n');
      }
    });

    res.write(JSON.stringify({ type: 'done', sources, searched }) + '\n');
    res.end();
  } catch (err) {
    const safeMsg = redact(err?.message || String(err));
    logger.error('Shreekunja AI request failed:', safeMsg);

    if (res.headersSent) {
      res.write(JSON.stringify({ type: 'error', error: safeMsg }) + '\n');
      res.end();
    } else {
      res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: safeMsg } });
    }
  }
}

module.exports = { chat };
