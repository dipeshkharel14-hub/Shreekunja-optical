-- 002_catalog.sql
-- Categories, products, product images, inventory change log.

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en         VARCHAR(120) NOT NULL,
    name_ne         VARCHAR(120),
    slug            VARCHAR(140) UNIQUE NOT NULL,
    description_en  TEXT,
    description_ne  TEXT,
    image_url       TEXT,
    active          BOOLEAN NOT NULL DEFAULT true,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories (slug);
CREATE INDEX IF NOT EXISTS idx_categories_active_sort ON categories (active, sort_order);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku                     VARCHAR(64) UNIQUE NOT NULL,
    name_en                 VARCHAR(200) NOT NULL,
    name_ne                 VARCHAR(200),
    slug                    VARCHAR(220) UNIQUE NOT NULL,
    description_en          TEXT,
    description_ne          TEXT,

    category_id             UUID REFERENCES categories (id) ON DELETE SET NULL,
    subcategory             VARCHAR(100),
    brand                   VARCHAR(100),
    gender                  VARCHAR(20) CHECK (gender IN ('men', 'women', 'unisex', 'kids')),

    frame_type              VARCHAR(60),
    frame_material          VARCHAR(60),
    frame_shape             VARCHAR(60),
    color                   VARCHAR(60),
    size                    VARCHAR(40),
    lens_type               VARCHAR(60),

    features_en             TEXT[],
    features_ne             TEXT[],

    price                   NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    compare_at_price        NUMERIC(10, 2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
    discount_percent        NUMERIC(5, 2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),

    stock                   INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    reserved_stock          INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
    low_stock_threshold     INTEGER NOT NULL DEFAULT 3,
    stock_status            VARCHAR(20) NOT NULL DEFAULT 'in_stock'
                              CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock', 'pre_order')),

    -- Optical-specific
    prescription_supported  BOOLEAN NOT NULL DEFAULT false,
    lens_index              VARCHAR(20),
    uv_protection            BOOLEAN NOT NULL DEFAULT false,
    blue_cut                BOOLEAN NOT NULL DEFAULT false,
    anti_reflective         BOOLEAN NOT NULL DEFAULT false,
    photochromic            BOOLEAN NOT NULL DEFAULT false,
    polarized               BOOLEAN NOT NULL DEFAULT false,
    progressive             BOOLEAN NOT NULL DEFAULT false,
    water_repellent         BOOLEAN NOT NULL DEFAULT false,
    scratch_resistant       BOOLEAN NOT NULL DEFAULT false,

    featured                BOOLEAN NOT NULL DEFAULT false,
    best_seller             BOOLEAN NOT NULL DEFAULT false,
    new_arrival             BOOLEAN NOT NULL DEFAULT false,
    active                  BOOLEAN NOT NULL DEFAULT true,

    seo_title               VARCHAR(200),
    seo_description         VARCHAR(300),

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products (featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_products_best_seller ON products (best_seller) WHERE best_seller = true;
CREATE INDEX IF NOT EXISTS idx_products_new_arrival ON products (new_arrival) WHERE new_arrival = true;
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_price ON products (price);
-- Basic full-text search across bilingual name/description.
CREATE INDEX IF NOT EXISTS idx_products_search_en
    ON products USING GIN (to_tsvector('english', coalesce(name_en, '') || ' ' || coalesce(description_en, '')));

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    storage_key     TEXT,
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images (product_id);

-- ============================================================
-- INVENTORY CHANGE LOG (distinct from the general audit_logs —
-- this is fast, append-only, purpose-built for stock history)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_logs (
    id              BIGSERIAL PRIMARY KEY,
    product_id      UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    admin_id        UUID REFERENCES admins (id) ON DELETE SET NULL,
    change_type     VARCHAR(30) NOT NULL CHECK (change_type IN ('manual_adjust', 'order_reserved', 'order_released', 'order_fulfilled', 'restock')),
    quantity_delta  INTEGER NOT NULL,
    stock_after     INTEGER NOT NULL,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs (product_id);
