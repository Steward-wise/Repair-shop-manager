-- Add approval workflow fields to jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS approval_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_link text;

-- Update status check constraint to include new statuses
-- (Run this if your jobs table has a status constraint)
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('intake','diagnosed','awaiting_approval','awaiting_repair','in_progress','waiting_parts','ready','collected'));
