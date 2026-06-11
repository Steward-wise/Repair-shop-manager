-- Business Tasks (internal kanban / to-do board)
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS business_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'todo'
                  CHECK (status IN ('backlog','todo','in_progress','review','done')),
  priority      text NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','urgent')),
  category      text,
  assigned_to   text,
  due_date      date,
  order_index   integer NOT NULL DEFAULT 0,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_business_tasks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_business_tasks_updated_at ON business_tasks;
CREATE TRIGGER trg_business_tasks_updated_at
  BEFORE UPDATE ON business_tasks
  FOR EACH ROW EXECUTE FUNCTION update_business_tasks_updated_at();

-- RLS
ALTER TABLE business_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can manage business_tasks" ON business_tasks;
CREATE POLICY "authenticated can manage business_tasks"
  ON business_tasks FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role full access business_tasks" ON business_tasks;
CREATE POLICY "service_role full access business_tasks"
  ON business_tasks FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Index for ordering within columns
CREATE INDEX IF NOT EXISTS idx_business_tasks_status_order
  ON business_tasks (status, order_index);
