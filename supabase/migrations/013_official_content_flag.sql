-- ============================================================
-- Adds is_official to marketplace_products and posts, so content
-- pushed directly by an admin (official Finora listings,
-- announcements) can be visually distinguished in the UI from
-- user-submitted content, rather than looking identical.
-- ============================================================

ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS marketplace_products_is_official_idx ON marketplace_products(is_official);
