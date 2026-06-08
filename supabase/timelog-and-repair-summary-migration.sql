-- Fix: job_time_logs was missing RLS policies (causes schema cache error)
-- Run this if you see "Could not find the table 'public.job_time_logs' in the schema cache"
CREATE TABLE IF NOT EXISTS job_time_logs (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician   text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_logs_job_id ON job_time_logs (job_id);

ALTER TABLE job_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth full access" ON job_time_logs;
CREATE POLICY "auth full access" ON job_time_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "service full access" ON job_time_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add repair_summary field to jobs (what the technician actually did)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS repair_summary text,
  ADD COLUMN IF NOT EXISTS repair_report_sent_at timestamptz;
