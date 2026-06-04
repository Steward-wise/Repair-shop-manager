-- Add intake method, date, and alternate contact to jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS intake_method text CHECK (intake_method IN ('drop_off', 'collection')) DEFAULT 'drop_off',
  ADD COLUMN IF NOT EXISTS intake_date date,
  ADD COLUMN IF NOT EXISTS alternate_contact text;
