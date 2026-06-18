-- Ensure quotes table allows DELETE for authenticated users and service_role.
-- Run this if deleting quotes does nothing or returns a permission error.

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Drop and recreate to be safe
DROP POLICY IF EXISTS "auth full access" ON quotes;
CREATE POLICY "auth full access"
  ON quotes FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role full access quotes" ON quotes;
CREATE POLICY "service_role full access quotes"
  ON quotes FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
