-- 004_content_and_ai.sql
-- Blog CMS, services, store settings, AI knowledge base, AI conversation log.

-- ============================================================
-- BLOG POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS blog_posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_en        VARCHAR(220) NOT NULL,
    title_ne        VARCHAR(220),
    slug            VARCHAR(240) UNIQUE NOT NULL,
    excerpt_en       TEXT,
    excerpt_ne       TEXT,
    content_en       TEXT,   -- sanitized HTML
    content_ne       TEXT,   -- sanitized HTML
    cover_image      TEXT,
    category         VARCHAR(80),
    tags             TEXT[],
    author           VARCHAR(120),
    seo_title        VARCHAR(200),
    seo_description  VARCHAR(300),
    published        BOOLEAN NOT NULL DEFAULT false,
    published_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts (published, published_at DESC);

-- ============================================================
-- SERVICES (Eye Testing, Frame Fitting, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en         VARCHAR(150) NOT NULL,
    name_ne         VARCHAR(150),
    description_en  TEXT,
    description_ne  TEXT,
    icon            VARCHAR(60),
    active          BOOLEAN NOT NULL DEFAULT true,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_active_sort ON services (active, sort_order);

-- ============================================================
-- SETTINGS
-- Single-row key/value-ish table (we use one row with columns
-- rather than EAV, since the settings schema is well-defined and
-- rarely grows).
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
    business_name_en    VARCHAR(150) NOT NULL DEFAULT 'Shreekunja Optical',
    business_name_ne    VARCHAR(150) NOT NULL DEFAULT 'श्रीकुञ्ज अप्टिकल',
    phone               VARCHAR(20),
    whatsapp            VARCHAR(20),
    email               VARCHAR(255),
    address_en          TEXT,
    address_ne          TEXT,
    opening_hours       JSONB,
    google_maps_url     TEXT,
    social_links        JSONB,      -- {facebook, instagram, tiktok, ...}
    logo_url            TEXT,
    favicon_url         TEXT,
    store_description_en TEXT,
    store_description_ne TEXT,
    delivery_settings   JSONB,      -- {flat_fee, free_delivery_threshold, areas: [...]}
    currency            VARCHAR(10) NOT NULL DEFAULT 'NPR',
    tax_settings        JSONB,
    ai_name             VARCHAR(60) NOT NULL DEFAULT 'Shreekunja AI',
    ai_welcome_message_en TEXT,
    ai_welcome_message_ne TEXT,
    ai_personality       TEXT,
    ai_temperature        NUMERIC(3, 2) NOT NULL DEFAULT 0.75,
    ai_max_response_tokens INTEGER NOT NULL DEFAULT 2048,
    ai_enabled_features   JSONB,     -- {productSearch: true, orderLookup: true, ...}
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure the singleton row always exists.
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- AI KNOWLEDGE BASE
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_knowledge (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_en     TEXT NOT NULL,
    question_ne     TEXT,
    answer_en       TEXT NOT NULL,
    answer_ne       TEXT,
    category        VARCHAR(60) NOT NULL DEFAULT 'general'
                       CHECK (category IN ('optical', 'products', 'lenses', 'frames', 'eye_care', 'store', 'policies', 'delivery', 'returns', 'general')),
    keywords        TEXT[],
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_category ON ai_knowledge (category);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_active ON ai_knowledge (active);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_keywords ON ai_knowledge USING GIN (keywords);

-- ============================================================
-- AI CONVERSATIONS (for the admin "AI conversations" dashboard card)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID REFERENCES customers (id) ON DELETE SET NULL,
    session_id      VARCHAR(80) NOT NULL,
    role            VARCHAR(10) NOT NULL CHECK (role IN ('user', 'model')),
    message         TEXT NOT NULL,
    tools_used       JSONB,          -- e.g. [{"tool": "searchProducts", "args": {...}}]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_session_id ON ai_conversations (session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations (created_at DESC);
