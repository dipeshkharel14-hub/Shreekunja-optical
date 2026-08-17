# Shreekunja Optical 2.0 — Backend

REST API for the Shreekunja Optical e-commerce + optical-management
platform, and the backend for **Shreekunja AI**.

This is **Phase 1** of the build: the backend skeleton and database
schema. Product/order/blog CRUD endpoints and auth are implemented and
working; the storefront frontend refactor, admin panel UI, image
storage provider, and full AI tool-calling are later phases (see
`config/env.js`, `services/storageService.js`, and `services/aiService.js`
for exact TODO markers).

## Stack

- Node.js + Express
- PostgreSQL (via `pg`, raw SQL — no ORM)
- JWT in an HTTP-only cookie for both admin and customer sessions
- Google Gemini (`@google/genai`) for Shreekunja AI

## Project layout

```
backend/
  server.js              — entry point, wires everything together
  config/
    env.js                — loads & validates environment variables
    database.js            — PostgreSQL connection pool
  routes/                 — one file per resource, thin (auth + validation wiring only)
  controllers/            — request handling, calls models/services
  middleware/
    auth.js                — identifies the caller from the session cookie
    adminAuth.js            — requires an active admin (re-checked against DB)
    roleGuard.js             — SUPER_ADMIN vs ADMIN permission checks
    rateLimit.js             — named rate-limit presets
    errorHandler.js          — consistent { success, error } JSON shape
    validation.js            — request body validation
  models/                  — SQL query layer, one file per table group
  services/
    aiService.js             — Shreekunja AI (Gemini streaming, NDJSON protocol preserved)
    storageService.js         — object storage interface (provider TODO)
    whatsappService.js         — wa.me deep-link notification builder
    orderService.js            — atomic order creation / stock reservation
  utils/
    security.js               — password hashing, JWT, CSRF, order numbers
    logger.js                  — secret-redacting structured logger
  migrations/                — numbered .sql files + a small runner (no ORM)
  seed/seed.js                — creates the exactly-three admin accounts
```

## Setup

```bash
npm install
cp .env.example .env
# fill in .env — see comments in that file for what each value means
```

You need a PostgreSQL database (Render's managed Postgres works well —
create one, copy its "External Database URL" into `DATABASE_URL`).

Generate strong secrets:

```bash
openssl rand -hex 64   # use for JWT_SECRET
openssl rand -hex 64   # use for SESSION_SECRET
```

## Database

```bash
npm run migrate          # applies all migrations in migrations/*.sql, in order
npm run migrate:status   # shows which have been applied
```

Migrations are plain numbered `.sql` files, tracked in a
`schema_migrations` table. Re-running `npm run migrate` is always safe
— already-applied files are skipped.

## Seeding the three admin accounts

Per spec, there are **exactly three** admin accounts, created only by
this script — there is no public admin-registration endpoint.

1. In `.env`, set `ADMIN_1_EMAIL`/`ADMIN_1_PASSWORD` (Dipesh Kharel,
   SUPER_ADMIN), `ADMIN_2_EMAIL`/`ADMIN_2_PASSWORD` (Durga Kharel),
   `ADMIN_3_EMAIL`/`ADMIN_3_PASSWORD` (Devi Prasad Kharel). Passwords
   need to be 10+ characters.
2. Set `ALLOW_ADMIN_SEED=true`.
3. Run:

```bash
npm run seed
```

4. **Remove the `ADMIN_*_PASSWORD` values from `.env`** once seeding
   is done — they're no longer needed and shouldn't sit in plaintext
   longer than necessary. Only bcrypt hashes are stored in the database.

Re-running the seed script is safe — it skips any admin whose email
already exists, and refuses outright to create a fourth account.

## Development

```bash
npm run dev      # node --watch server.js
npm start        # production start
```

Visit `GET /api/health` to confirm the server is up and the database
is reachable.

## Deployment (Render)

The existing deployment at `shreekunja-optical.onrender.com` is the
target. Set all `.env.example` variables as environment variables in
the Render service dashboard — never commit `.env`. Point
`DATABASE_URL` at your Render Postgres instance, run `npm run migrate`
and `npm run seed` once (Render's shell, or a one-off job), then
deploy normally.

## What's implemented vs. pending

**Implemented:** database schema (all tables from spec section 36),
admin + customer auth with RBAC, product/category/order/blog/service/
customer/settings CRUD APIs, atomic order creation with stock
reservation, audit logging, rate limiting, Shreekunja AI streaming
chat wired to live settings + knowledge base.

**Pending (later phases):** image upload to real object storage
(`services/storageService.js` currently throws until a provider is
chosen), blog HTML sanitization, AI backend tool-calling
(searchProducts/getStock/getCustomerOrder — the model layer they'll
call already exists), the storefront frontend refactor to consume
this API, the admin panel UI, wishlist/reviews/coupons routes (tables
exist, routes don't yet), SEO/structured data generation.
