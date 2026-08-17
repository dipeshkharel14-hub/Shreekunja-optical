-- 003_orders.sql
-- Orders, order items, prescriptions, wishlists, product reviews.

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number        VARCHAR(40) UNIQUE NOT NULL, -- e.g. SKO-2026-000123
    customer_id         UUID REFERENCES customers (id) ON DELETE SET NULL,

    -- Snapshot fields so the order record survives if the customer/address changes later.
    customer_name       VARCHAR(120) NOT NULL,
    customer_phone      VARCHAR(20) NOT NULL,
    customer_email      VARCHAR(255),
    shipping_address    JSONB NOT NULL, -- {city, area, address_line, delivery_notes}

    subtotal            NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount            NUMERIC(10, 2) NOT NULL DEFAULT 0,
    delivery_fee        NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total                NUMERIC(10, 2) NOT NULL DEFAULT 0,

    payment_method       VARCHAR(30) NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'online')),
    payment_status       VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'failed')),
    order_status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (order_status IN ('pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'cancelled', 'returned')),

    customer_note        TEXT,
    admin_note           TEXT,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- ============================================================
-- ORDER ITEMS
-- Snapshots product name/price at time of order so later price
-- changes never rewrite order history.
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products (id) ON DELETE SET NULL,
    product_name_en VARCHAR(200) NOT NULL,
    product_name_ne VARCHAR(200),
    sku             VARCHAR(64),
    unit_price      NUMERIC(10, 2) NOT NULL,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    line_total      NUMERIC(10, 2) NOT NULL,
    prescription_id UUID, -- nullable FK, added after prescriptions table below
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);

-- ============================================================
-- PRESCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS prescriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID REFERENCES customers (id) ON DELETE CASCADE,
    source          VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'upload', 'provide_later')),
    image_url       TEXT,

    od_sph          VARCHAR(10),
    od_cyl          VARCHAR(10),
    od_axis         VARCHAR(10),
    od_add          VARCHAR(10),

    os_sph          VARCHAR(10),
    os_cyl          VARCHAR(10),
    os_axis         VARCHAR(10),
    os_add          VARCHAR(10),

    pd              VARCHAR(10),
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_customer_id ON prescriptions (customer_id);

ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_prescription
    FOREIGN KEY (prescription_id) REFERENCES prescriptions (id) ON DELETE SET NULL;

-- ============================================================
-- WISHLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS wishlists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_id)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wishlist_id     UUID NOT NULL REFERENCES wishlists (id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (wishlist_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist_id ON wishlist_items (wishlist_id);

-- ============================================================
-- PRODUCT REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    customer_id         UUID REFERENCES customers (id) ON DELETE SET NULL,
    rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment             TEXT,
    image_url           TEXT,
    verified_purchase   BOOLEAN NOT NULL DEFAULT false,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden')),
    featured            BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews (status);
