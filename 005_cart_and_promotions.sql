-- 005_cart_and_promotions.sql
-- Server-side cart persistence for logged-in customers, coupons/promotions.

-- ============================================================
-- CARTS
-- Guests use localStorage on the frontend; this table only
-- backs logged-in customers so their cart survives across devices.
-- ============================================================
CREATE TABLE IF NOT EXISTS carts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id         UUID NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items (cart_id);

-- ============================================================
-- COUPONS / PROMOTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(40) UNIQUE NOT NULL,
    description         VARCHAR(200),
    discount_type       VARCHAR(20) NOT NULL CHECK (discount_type IN ('percent', 'flat')),
    discount_value       NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
    min_order_amount     NUMERIC(10, 2) DEFAULT 0,
    max_uses             INTEGER,
    used_count           INTEGER NOT NULL DEFAULT 0,
    starts_at            TIMESTAMPTZ,
    expires_at            TIMESTAMPTZ,
    active                BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons (code);
