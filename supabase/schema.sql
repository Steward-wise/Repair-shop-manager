-- ============================================================
--  Repair Shop — Supabase Schema
--  Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────
--  CUSTOMERS
-- ────────────────────────────────────────────
create table if not exists customers (
  id                 uuid primary key default uuid_generate_v4(),
  name               text not null,
  phone              text,
  email              text,
  notes              text,
  marketing_consent  boolean not null default false,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- Migration for existing databases:
-- alter table customers add column if not exists marketing_consent boolean not null default false;

create index if not exists idx_customers_name  on customers (name);
create index if not exists idx_customers_phone on customers (phone);
create index if not exists idx_customers_email on customers (email);

-- ────────────────────────────────────────────
--  JOBS
-- ────────────────────────────────────────────
create table if not exists jobs (
  id               uuid primary key default uuid_generate_v4(),
  ticket_number    serial not null,
  customer_id      uuid references customers (id) on delete set null,

  -- Device info
  device_type      text not null check (device_type in ('phone','tablet','computer','console','other')),
  device_make      text not null,
  device_model     text not null,
  imei             text,
  reported_fault   text not null,

  -- Security / data
  password         text,
  backup_required  boolean default false,
  backup_completed boolean default false,

  -- Workflow
  status           text not null default 'intake'
                   check (status in ('intake','diagnosed','in_progress','waiting_parts','ready','collected')),
  technician_name  text,

  -- Financials
  quoted_price     numeric(10,2),
  final_price      numeric(10,2),

  -- Notes
  notes            text,
  internal_notes   text,

  -- Payments
  payment_status   text not null default 'unpaid'
                   check (payment_status in ('unpaid','deposit_paid','paid')),
  deposit_amount   numeric(10,2) default 0,
  deposit_paid     boolean default false,
  payment_method   text,

  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  collected_at     timestamptz
);

create index if not exists idx_jobs_status      on jobs (status);
create index if not exists idx_jobs_customer_id on jobs (customer_id);
create index if not exists idx_jobs_created_at  on jobs (created_at desc);

-- ────────────────────────────────────────────
--  JOB PHOTOS
-- ────────────────────────────────────────────
create table if not exists job_photos (
  id          uuid primary key default uuid_generate_v4(),
  job_id      uuid not null references jobs (id) on delete cascade,
  url         text not null,
  photo_type  text not null check (photo_type in ('intake','damage','repair','completion')),
  caption     text,
  created_at  timestamptz default now()
);

create index if not exists idx_job_photos_job_id on job_photos (job_id);

-- ────────────────────────────────────────────
--  SIGNATURES
-- ────────────────────────────────────────────
create table if not exists signatures (
  id             uuid primary key default uuid_generate_v4(),
  job_id         uuid not null references jobs (id) on delete cascade unique,
  signature_url  text not null,
  collected_by   text,
  customer_name  text,
  created_at     timestamptz default now()
);

-- ────────────────────────────────────────────
--  INVENTORY
-- ────────────────────────────────────────────
create table if not exists inventory (
  id                 uuid primary key default uuid_generate_v4(),
  part_name          text not null,
  sku                text,
  description        text,
  quantity           integer not null default 0,
  reorder_threshold  integer default 5,
  cost_price         numeric(10,2),
  sell_price         numeric(10,2),
  supplier           text,
  supplier_email     text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index if not exists idx_inventory_sku on inventory (sku);

-- ────────────────────────────────────────────
--  JOB PARTS (parts used on a job)
-- ────────────────────────────────────────────
create table if not exists job_parts (
  id            uuid primary key default uuid_generate_v4(),
  job_id        uuid not null references jobs (id) on delete cascade,
  inventory_id  uuid references inventory (id) on delete set null,
  part_name     text not null,
  quantity      integer not null default 1,
  unit_price    numeric(10,2),
  created_at    timestamptz default now()
);

create index if not exists idx_job_parts_job_id on job_parts (job_id);

-- ────────────────────────────────────────────
--  NOTIFICATION LOG
-- ────────────────────────────────────────────
create table if not exists notification_log (
  id         uuid primary key default uuid_generate_v4(),
  job_id     uuid not null references jobs (id) on delete cascade,
  type       text not null check (type in ('sms','email','whatsapp')),
  recipient  text not null,
  message    text,
  status     text default 'sent',
  sent_at    timestamptz default now()
);

create index if not exists idx_notification_log_job_id on notification_log (job_id);

-- ────────────────────────────────────────────
--  AUTO-UPDATE updated_at
-- ────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger customers_updated_at
  before update on customers
  for each row execute function update_updated_at();

create or replace trigger jobs_updated_at
  before update on jobs
  for each row execute function update_updated_at();

create or replace trigger inventory_updated_at
  before update on inventory
  for each row execute function update_updated_at();

-- ────────────────────────────────────────────
--  ROW LEVEL SECURITY
--  Authenticated users (your staff) can read/write everything.
--  The collect page uses the service-role key server-side only.
-- ────────────────────────────────────────────
alter table customers        enable row level security;
alter table jobs             enable row level security;
alter table job_photos       enable row level security;
alter table signatures       enable row level security;
alter table inventory        enable row level security;
alter table job_parts        enable row level security;
alter table notification_log enable row level security;

-- Authenticated users: full access
create policy "auth full access" on customers        for all to authenticated using (true) with check (true);
create policy "auth full access" on jobs             for all to authenticated using (true) with check (true);
create policy "auth full access" on job_photos       for all to authenticated using (true) with check (true);
create policy "auth full access" on signatures       for all to authenticated using (true) with check (true);
create policy "auth full access" on inventory        for all to authenticated using (true) with check (true);
create policy "auth full access" on job_parts        for all to authenticated using (true) with check (true);
create policy "auth full access" on notification_log for all to authenticated using (true) with check (true);

-- ────────────────────────────────────────────
--  QUOTE RULES
-- ────────────────────────────────────────────
create table if not exists quote_rules (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  device_type  text,
  keywords     text not null default '',
  min_price    numeric not null default 0,
  max_price    numeric,
  notes        text,
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz default now()
);

-- ────────────────────────────────────────────
--  QUOTES
-- ────────────────────────────────────────────
create table if not exists quotes (
  id                  uuid primary key default uuid_generate_v4(),
  first_name          text not null,
  last_name           text not null,
  email               text not null,
  phone               text,
  device_type         text,
  device_make_model   text,
  problem_description text not null,
  suggested_price     numeric,
  final_price         numeric,
  price_notes         text,
  matched_rule_id     uuid references quote_rules(id) on delete set null,
  status              text not null default 'pending'
                        check (status in ('pending','sent','accepted','declined','booked','closed')),
  admin_notes         text,
  quote_token         uuid not null default uuid_generate_v4(),
  sent_at             timestamptz,
  responded_at        timestamptz,
  followup_sent_at    timestamptz,
  created_at          timestamptz default now()
);
create index if not exists idx_quotes_status  on quotes (status);
create index if not exists idx_quotes_token   on quotes (quote_token);
create index if not exists idx_quotes_created on quotes (created_at desc);

-- ────────────────────────────────────────────
--  AVAILABILITY (weekly recurring schedule)
-- ────────────────────────────────────────────
create table if not exists availability (
  id                 uuid primary key default uuid_generate_v4(),
  day_of_week        smallint not null check (day_of_week between 0 and 6), -- 0=Sun
  start_time         time not null,
  end_time           time not null,
  slot_duration_mins int not null default 60,
  is_active          boolean not null default true,
  unique (day_of_week)
);

-- Default schedule (Mon-Fri 9-6, Sat 10-12, Sun closed)
insert into availability (day_of_week, start_time, end_time, slot_duration_mins, is_active) values
  (1, '09:00', '18:00', 60, true),
  (2, '09:00', '18:00', 60, true),
  (3, '09:00', '18:00', 60, true),
  (4, '09:00', '18:00', 60, true),
  (5, '09:00', '18:00', 60, true),
  (6, '10:00', '12:00', 60, true),
  (0, '09:00', '18:00', 60, false)
on conflict (day_of_week) do nothing;

-- ────────────────────────────────────────────
--  AVAILABILITY BLOCKS
-- ────────────────────────────────────────────
create table if not exists availability_blocks (
  id          uuid primary key default uuid_generate_v4(),
  block_date  date not null,
  start_time  time,
  end_time    time,
  reason      text,
  created_at  timestamptz default now()
);
create index if not exists idx_avail_blocks_date on availability_blocks (block_date);

-- ────────────────────────────────────────────
--  APPOINTMENTS
-- ────────────────────────────────────────────
create table if not exists appointments (
  id               uuid primary key default uuid_generate_v4(),
  quote_id         uuid references quotes(id) on delete set null,
  customer_name    text not null,
  customer_email   text not null,
  customer_phone   text,
  appointment_date date not null,
  appointment_time time not null,
  duration_mins    int not null default 60,
  device_info      text,
  notes            text,
  status           text not null default 'scheduled'
                     check (status in ('scheduled','completed','cancelled','no_show')),
  created_at       timestamptz default now()
);
create index if not exists idx_appointments_date on appointments (appointment_date);

alter table quote_rules         enable row level security;
alter table quotes              enable row level security;
alter table availability        enable row level security;
alter table availability_blocks enable row level security;
alter table appointments        enable row level security;

create policy "auth full access" on quote_rules         for all to authenticated using (true) with check (true);
create policy "auth full access" on quotes              for all to authenticated using (true) with check (true);
create policy "auth full access" on availability        for all to authenticated using (true) with check (true);
create policy "auth full access" on availability_blocks for all to authenticated using (true) with check (true);
create policy "auth full access" on appointments        for all to authenticated using (true) with check (true);

-- Migrations for existing databases:
-- create table if not exists quote_rules (...);  (run the full blocks above)
-- create table if not exists quotes (...);
-- create table if not exists availability (...);
-- create table if not exists availability_blocks (...);
-- create table if not exists appointments (...);

-- ────────────────────────────────────────────
--  STORAGE BUCKET for photos & signatures
-- ────────────────────────────────────────────
-- Run this separately in the Storage section or via the SQL editor:
-- insert into storage.buckets (id, name, public) values ('repair-media', 'repair-media', true);

-- ────────────────────────────────────────────
--  JOB TIME LOGS
-- ────────────────────────────────────────────
create table if not exists job_time_logs (
  id           uuid primary key default uuid_generate_v4(),
  job_id       uuid not null references jobs(id) on delete cascade,
  technician   text,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  notes        text,
  created_at   timestamptz default now()
);

create index if not exists idx_time_logs_job_id on job_time_logs (job_id);

-- ────────────────────────────────────────────
--  QUICKBOOKS TOKENS
-- ────────────────────────────────────────────
create table if not exists quickbooks_tokens (
  id            uuid primary key default uuid_generate_v4(),
  access_token  text not null,
  refresh_token text not null,
  realm_id      text not null,
  expires_at    timestamptz not null,
  updated_at    timestamptz default now()
);

-- ────────────────────────────────────────────
--  FEATURE 1: Follow-up Reminders
-- ────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;

-- ────────────────────────────────────────────
--  FEATURE 2: Customer Satisfaction Ratings
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_ratings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  token        TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rating_token TEXT;

-- RLS for job_ratings
ALTER TABLE job_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON job_ratings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service full access" ON job_ratings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────
--  FEATURE 3: Job Templates + Checklists
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  device_type    TEXT DEFAULT 'phone',
  device_make    TEXT,
  device_model   TEXT,
  reported_fault TEXT,
  quoted_price   NUMERIC,
  warranty_days  INTEGER DEFAULT 90,
  checklist      JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 90;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS warranty_expires_at TIMESTAMPTZ;

-- RLS for job_templates
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON job_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────
--  FEATURE 8: Web Push Subscriptions
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID REFERENCES jobs(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service full access" ON push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────
--  MIGRATIONS (run these if upgrading an existing DB)
-- ────────────────────────────────────────────
-- alter table jobs add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid','deposit_paid','paid'));
-- alter table jobs add column if not exists deposit_amount numeric(10,2) default 0;
-- alter table jobs add column if not exists deposit_paid boolean default false;
-- alter table jobs add column if not exists payment_method text;
-- alter table inventory add column if not exists supplier_email text;
-- alter table notification_log drop constraint if exists notification_log_type_check;
-- alter table notification_log add constraint notification_log_type_check check (type in ('sms','email','whatsapp'));
-- alter table customers add column if not exists auth_user_id uuid references auth.users(id);
-- alter table customers add column if not exists deleted_at timestamptz;
-- Phase 4-12 migrations:
-- create table if not exists job_time_logs (id uuid primary key default uuid_generate_v4(), job_id uuid not null references jobs(id) on delete cascade, technician text, started_at timestamptz not null default now(), ended_at timestamptz, notes text, created_at timestamptz default now());
-- create index if not exists idx_time_logs_job_id on job_time_logs (job_id);
-- create table if not exists quickbooks_tokens (id uuid primary key default uuid_generate_v4(), access_token text not null, refresh_token text not null, realm_id text not null, expires_at timestamptz not null, updated_at timestamptz default now());
