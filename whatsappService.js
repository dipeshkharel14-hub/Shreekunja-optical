/**
 * services/whatsappService.js
 *
 * Preserves the existing site's WhatsApp deep-link notification concept
 * (spec section 14) — generating a wa.me link with a prefilled message
 * that staff send manually — but now driven by real order/customer
 * records instead of ad-hoc form fields.
 *
 * If WHATSAPP_BUSINESS_TOKEN is later configured, `sendViaBusinessApi`
 * can be filled in to send automatically instead of opening a deep
 * link; until then, `buildNotificationLink` is the supported path.
 */

const config = require('../config/env');

const TEMPLATES_EN = {
  order_confirmed: (order) =>
    `Hi ${order.customer_name}, your order ${order.order_number} at Shreekunja Optical has been confirmed. We'll notify you once it's ready.`,
  order_ready: (order) =>
    `Hi ${order.customer_name}, your order ${order.order_number} is ready for pickup at Shreekunja Optical.`,
  order_shipped: (order) =>
    `Hi ${order.customer_name}, your order ${order.order_number} has been shipped.`,
  pickup_reminder: (order) =>
    `Hi ${order.customer_name}, just a reminder that your order ${order.order_number} is still waiting for pickup at Shreekunja Optical.`
};

const TEMPLATES_NE = {
  order_confirmed: (order) =>
    `नमस्ते ${order.customer_name}, तपाईंको अर्डर ${order.order_number} श्रीकुञ्ज अप्टिकलमा पुष्टि भएको छ।`,
  order_ready: (order) =>
    `नमस्ते ${order.customer_name}, तपाईंको अर्डर ${order.order_number} श्रीकुञ्ज अप्टिकलमा उठाउनको लागि तयार छ।`,
  order_shipped: (order) =>
    `नमस्ते ${order.customer_name}, तपाईंको अर्डर ${order.order_number} पठाइएको छ।`,
  pickup_reminder: (order) =>
    `नमस्ते ${order.customer_name}, तपाईंको अर्डर ${order.order_number} अझै उठाउन बाँकी छ।`
};

function normalizePhone(phone) {
  // Assumes Nepali numbers; strips non-digits and ensures country code.
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('977')) return digits;
  if (digits.length === 10) return `977${digits}`;
  return digits;
}

/**
 * `template` is one of the keys in TEMPLATES_EN/TEMPLATES_NE, or
 * 'custom' with `customMessage` supplied.
 */
function buildNotificationLink({ order, template, language = 'en', customMessage = null }) {
  const templates = language === 'ne' ? TEMPLATES_NE : TEMPLATES_EN;

  const message = template === 'custom'
    ? customMessage
    : templates[template]
      ? templates[template](order)
      : null;

  if (!message) {
    throw new Error(`Unknown WhatsApp template: ${template}`);
  }

  const phone = normalizePhone(order.customer_phone);
  const encoded = encodeURIComponent(message);

  return { url: `https://wa.me/${phone}?text=${encoded}`, message };
}

// eslint-disable-next-line no-unused-vars
async function sendViaBusinessApi({ order, template, language }) {
  if (!config.whatsapp.businessToken) {
    throw new Error('WHATSAPP_BUSINESS_TOKEN is not configured — use buildNotificationLink() for the manual deep-link flow instead.');
  }
  // TODO: implement once/if migrating to the official WhatsApp Business API.
  throw new Error('Automatic WhatsApp Business API sending is not yet implemented.');
}

module.exports = { buildNotificationLink, sendViaBusinessApi, normalizePhone, TEMPLATES_EN, TEMPLATES_NE };
