-- Feature Sync Migration: Persimmon → Balfour Beatty
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS bal_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  phone        TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bal_sites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  address      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bal_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bal_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_bal_contacts" ON bal_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_bal_sites" ON bal_sites FOR ALL USING (true) WITH CHECK (true);

-- Add awaiting_po to the status CHECK constraint
ALTER TABLE bal_orders DROP CONSTRAINT IF EXISTS bal_orders_status_check;
ALTER TABLE bal_orders ADD CONSTRAINT bal_orders_status_check
  CHECK (status IN ('new','awaiting_po','in-progress','completed','cancelled'));

ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES bal_contacts(id);
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES bal_sites(id);
CREATE INDEX IF NOT EXISTS idx_bal_orders_contact_id ON bal_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_bal_orders_site_id ON bal_orders(site_id);

-- Safety no-op: custom_data already exists in the base schema but included for environments
-- where the column may have been dropped or never created
ALTER TABLE bal_order_items ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT NULL;

-- ============================================================
-- Rollback (if needed)
-- ============================================================
-- DROP INDEX IF EXISTS idx_bal_orders_contact_id;
-- DROP INDEX IF EXISTS idx_bal_orders_site_id;
-- ALTER TABLE bal_orders DROP COLUMN IF EXISTS contact_id;
-- ALTER TABLE bal_orders DROP COLUMN IF EXISTS site_id;
-- ALTER TABLE bal_orders DROP CONSTRAINT IF EXISTS bal_orders_status_check;
-- ALTER TABLE bal_orders ADD CONSTRAINT bal_orders_status_check
--   CHECK (status IN ('new','in-progress','completed','cancelled'));
-- DROP TABLE IF EXISTS bal_contacts CASCADE;
-- DROP TABLE IF EXISTS bal_sites CASCADE;
