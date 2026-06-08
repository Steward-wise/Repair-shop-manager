-- Performance indexes for tables added in feature waves
-- Run this in the Supabase SQL editor

-- job_notes (timeline queries)
CREATE INDEX IF NOT EXISTS idx_job_notes_job_id     ON job_notes (job_id);
CREATE INDEX IF NOT EXISTS idx_job_notes_created_at ON job_notes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_notes_source     ON job_notes (source);

-- job_custody_events
CREATE INDEX IF NOT EXISTS idx_custody_job_id     ON job_custody_events (job_id);
CREATE INDEX IF NOT EXISTS idx_custody_created_at ON job_custody_events (created_at DESC);

-- pos_sales
CREATE INDEX IF NOT EXISTS idx_pos_sales_created_at ON pos_sales (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_voided     ON pos_sales (voided);

-- purchase_orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status     ON purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders (created_at DESC);

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity     ON audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log (action);

-- consent_audit
CREATE INDEX IF NOT EXISTS idx_consent_audit_customer_id ON consent_audit (customer_id);

-- jobs: additional useful indexes for common filter patterns
CREATE INDEX IF NOT EXISTS idx_jobs_payment_status    ON jobs (payment_status);
CREATE INDEX IF NOT EXISTS idx_jobs_technician        ON jobs (technician_name);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at        ON jobs (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_followup_sent     ON jobs (followup_sent_at) WHERE followup_sent_at IS NULL;

-- job_ratings
CREATE INDEX IF NOT EXISTS idx_job_ratings_submitted  ON job_ratings (submitted_at DESC) WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_ratings_job_id     ON job_ratings (job_id);
