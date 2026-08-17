/**
 * models/Setting.js
 * Singleton store-settings row (id = 1). See spec section 25.
 */

const { query } = require('../config/database');

// Fields any authenticated storefront visitor may see (spec section 39: public settings).
const PUBLIC_FIELDS = [
  'business_name_en', 'business_name_ne', 'phone', 'whatsapp', 'email',
  'address_en', 'address_ne', 'opening_hours', 'google_maps_url', 'social_links',
  'logo_url', 'favicon_url', 'store_description_en', 'store_description_ne',
  'delivery_settings', 'currency', 'ai_name', 'ai_welcome_message_en', 'ai_welcome_message_ne'
];

async function getAll() {
  const result = await query('SELECT * FROM settings WHERE id = 1');
  return result.rows[0];
}

async function getPublic() {
  const all = await getAll();
  const publicSettings = {};
  for (const field of PUBLIC_FIELDS) {
    publicSettings[field] = all[field];
  }
  return publicSettings;
}

/**
 * `fields` should already be scoped by the caller to what the
 * requesting admin's role is allowed to change (see roleGuard —
 * AI configuration and store-wide/critical settings are SUPER_ADMIN-only).
 */
async function update(fields) {
  const columns = Object.keys(fields);
  if (columns.length === 0) return getAll();

  const setClauses = columns.map((col, idx) => `${col} = $${idx + 1}`);
  const values = columns.map((col) => fields[col]);

  const result = await query(
    `UPDATE settings SET ${setClauses.join(', ')}, updated_at = now() WHERE id = 1 RETURNING *`,
    values
  );
  return result.rows[0];
}

module.exports = { getAll, getPublic, update, PUBLIC_FIELDS };
