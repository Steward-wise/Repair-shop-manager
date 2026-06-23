-- License keys for Repair Shop product distribution
-- Run this in the 404 Fixed (your) Supabase project only

CREATE TABLE IF NOT EXISTS licenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key             text UNIQUE NOT NULL,
  customer_email  text,
  customer_name   text,
  plan            text NOT NULL DEFAULT 'standard' CHECK (plan IN ('standard', 'pro')),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  activations     integer NOT NULL DEFAULT 0,
  max_activations integer NOT NULL DEFAULT 3,
  notes           text,
  activated_domains text[] DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz
);

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access licenses"
  ON licenses FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read licenses"
  ON licenses FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses (key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses (status);

-- Helper function: generate a readable license key RSP-XXXXX-XXXXX-XXXXX
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'RSP';
  i int;
  seg int;
BEGIN
  FOR seg IN 1..3 LOOP
    result := result || '-';
    FOR i IN 1..5 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
  END LOOP;
  RETURN result;
END;
$$;
