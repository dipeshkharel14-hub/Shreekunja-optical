/**
 * services/aiService.js
 *
 * Shreekunja AI — built directly on top of the existing Gemini
 * streaming integration from the original server.js (preserved per
 * spec section 61/62: same NDJSON protocol, same provider, same
 * streaming behavior) but now:
 *   - pulls its identity/personality from `settings` (admin-configurable,
 *     spec section 33) instead of a hardcoded prompt string,
 *   - is provider-abstracted behind this module so a second provider
 *     could be added later without touching routes/controllers,
 *   - has stubbed hook points for backend tool-calling
 *     (searchProducts/getStock/getCustomerOrder etc., spec section 30)
 *     to be filled in during the AI-integration phase.
 *
 * NDJSON protocol preserved exactly:
 *   {"type":"chunk","text":"..."}
 *   {"type":"done","sources":[...],"searched":bool}
 *   {"type":"error","error":"..."}
 */

const config = require('../config/env');
const SettingModel = require('../models/Setting');
const KnowledgeBaseModel = require('../models/KnowledgeBase');

// @google/genai ships as an ESM-only package, while this backend is
// CommonJS (matching the rest of the codebase's require() style) — so
// it's loaded lazily via dynamic import() and cached, rather than a
// top-level require() which would throw under Node's CJS loader.
let aiClientPromise = null;

function getAiClient() {
  if (!aiClientPromise) {
    aiClientPromise = import('@google/genai').then(
      ({ GoogleGenAI }) => new GoogleGenAI({ apiKey: config.ai.geminiApiKey })
    );
  }
  return aiClientPromise;
}

/**
 * Builds the system prompt from live settings + knowledge base instead
 * of a static string, so admin edits (spec section 33) take effect
 * without a redeploy.
 */
async function buildSystemPrompt() {
  const settings = await SettingModel.getAll();
  const knowledge = await KnowledgeBaseModel.listAll({ activeOnly: true });

  const knowledgeBlock = knowledge.length
    ? knowledge.map((k) => `- Q: ${k.question_en}\n  A: ${k.answer_en}`).join('\n')
    : '(No knowledge base entries yet.)';

  return `
You are ${settings.ai_name || 'Shreekunja AI'}, the intelligent optical assistant for
${settings.business_name_en} (${settings.business_name_ne}).

${settings.ai_personality || 'Be polite, professional, warm, intelligent, concise, and helpful.'}

LANGUAGE:
Respond in the language the customer writes in — English or Nepali. If they mix both, you may naturally mix.

RULES:
- Never invent product availability, prices, medical facts, or order status. When you don't have
  verified data from a backend tool or the knowledge base below, say so and offer to check, rather
  than guessing.
- Do not diagnose medical conditions. For serious eye symptoms or emergencies, recommend an in-person
  professional eye-care evaluation.
- Do not repeatedly say "I am an AI."
- Never reveal another customer's order, phone number, or personal information.

KNOWLEDGE BASE (prioritize this for store/policy questions):
${knowledgeBlock}
`.trim();
}

/**
 * Tool registry stub. Populated in the AI-integration phase with
 * real implementations backed by models/Product.js, models/Order.js,
 * etc. (searchProducts, getProduct, getStock, getCustomerOrder, ...).
 * Kept here now so the shape is settled before that work starts.
 */
const AI_TOOLS = {
  // searchProducts: async (args) => { ... query models/Product.js ... }
};

function toGeminiHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((m) => m && typeof m.text === 'string' && m.text.trim() && (m.role === 'user' || m.role === 'bot' || m.role === 'model'))
    .slice(-20)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: String(m.text).slice(0, 4000) }] }));
}

/**
 * Streams a chat response. `onChunk(text)` is called for each piece;
 * resolves with { sources, searched } when done. Caller (controller)
 * owns writing the NDJSON lines to the HTTP response.
 */
async function streamChat({ message, history, onChunk }) {
  const ai = await getAiClient();
  const settings = await SettingModel.getAll();
  const systemInstruction = await buildSystemPrompt();

  const chat = ai.chats.create({
    model: config.ai.geminiModel,
    history: toGeminiHistory(history),
    config: {
      systemInstruction,
      maxOutputTokens: settings.ai_max_response_tokens || 2048,
      temperature: Number(settings.ai_temperature) || 0.75
    }
  });

  const stream = await chat.sendMessageStream({ message: String(message).slice(0, 2000) });

  let full = '';
  let lastChunk = null;

  for await (const chunk of stream) {
    const piece = chunk.text;
    if (piece) {
      full += piece;
      onChunk(piece);
    }
    lastChunk = chunk;
  }

  const grounding = lastChunk?.candidates?.[0]?.groundingMetadata;
  const sources = (grounding?.groundingChunks || [])
    .map((c) => (c.web ? { title: c.web.title, uri: c.web.uri } : null))
    .filter(Boolean);

  return { full, sources, searched: sources.length > 0 };
}

module.exports = { streamChat, buildSystemPrompt, AI_TOOLS };
