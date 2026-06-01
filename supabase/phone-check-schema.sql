-- Phone check sessions
CREATE TABLE IF NOT EXISTS phone_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,

  -- Device identification
  platform text,                -- 'android' | 'ios' | 'unknown'
  device_name text,
  manufacturer text,
  model text,
  os_version text,
  serial_number text,
  imei text,
  imei2 text,
  udid text,                    -- iOS UDID
  battery_health integer,       -- percentage reported by device

  -- Security results
  frp_status text DEFAULT 'unknown',        -- 'clean' | 'locked' | 'unknown'
  mdm_status text DEFAULT 'unknown',        -- 'clean' | 'supervised' | 'unknown'
  icloud_status text DEFAULT 'unknown',     -- 'clean' | 'locked' | 'unknown'
  blacklist_status text DEFAULT 'unknown',  -- 'clean' | 'blacklisted' | 'unknown'
  blacklist_data jsonb,

  -- Test checklist [{id,name,category,result,notes,value}]
  tests jsonb DEFAULT '[]'::jsonb,

  -- Media
  video_url text,

  -- Summary
  notes text,
  grade text,                   -- 'A' | 'B' | 'C' | 'D' | 'F'
  status text DEFAULT 'in_progress',  -- 'in_progress' | 'completed'
  purpose text DEFAULT 'repair',      -- 'repair' | 'valuation'

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for job lookups
CREATE INDEX IF NOT EXISTS idx_phone_checks_job_id ON phone_checks(job_id);
CREATE INDEX IF NOT EXISTS idx_phone_checks_imei ON phone_checks(imei);
CREATE INDEX IF NOT EXISTS idx_phone_checks_created ON phone_checks(created_at DESC);
