-- Fix appointments FK so deleting a quote automatically nulls the quote_id
-- instead of blocking the delete with a constraint violation.

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_quote_id_fkey;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_quote_id_fkey
    FOREIGN KEY (quote_id)
    REFERENCES quotes(id)
    ON DELETE SET NULL;
