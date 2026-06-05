-- ─────────────────────────────────────────────────────────────────
-- Feature batch migration — all waves
-- Run this in the Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────

-- Wave 1: Purchase orders (persisted)
create table if not exists purchase_orders (
  id            uuid primary key default uuid_generate_v4(),
  po_ref        text not null unique,
  supplier      text not null,
  supplier_email text,
  items         jsonb not null default '[]',
  status        text not null default 'sent' check (status in ('sent', 'partially_received', 'received', 'cancelled')),
  sent_at       timestamptz default now(),
  received_at   timestamptz,
  notes         text,
  created_at    timestamptz default now()
);
alter table purchase_orders enable row level security;
create policy "auth full access" on purchase_orders for all to authenticated using (true) with check (true);

-- Wave 2 / Wave 6: App settings (key-value store)
create table if not exists app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);
alter table app_settings enable row level security;
create policy "auth full access" on app_settings for all to authenticated using (true) with check (true);
-- Seed default settings
insert into app_settings (key, value) values
  ('ready_reminder_days', '3'),
  ('data_retention_years', '7'),
  ('shop_name', ''),
  ('privacy_officer_email', '')
on conflict (key) do nothing;

-- Wave 3: POS sales
create table if not exists pos_sales (
  id             uuid primary key default uuid_generate_v4(),
  items          jsonb not null default '[]',
  subtotal       numeric(10,2) not null default 0,
  discount       numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  payment_method text not null default 'cash',
  customer_name  text,
  customer_email text,
  created_by     text,
  voided         boolean not null default false,
  voided_at      timestamptz,
  created_at     timestamptz default now()
);
alter table pos_sales enable row level security;
create policy "auth full access" on pos_sales for all to authenticated using (true) with check (true);

-- Wave 4: Audit log
create table if not exists audit_log (
  id          uuid primary key default uuid_generate_v4(),
  action      text not null,
  entity      text not null,
  entity_id   text,
  user_email  text,
  description text,
  old_value   jsonb,
  new_value   jsonb,
  ip          text,
  created_at  timestamptz default now()
);
alter table audit_log enable row level security;
create policy "auth full access" on audit_log for all to authenticated using (true) with check (true);

-- Wave 5: Consent audit trail (GDPR / PECR)
create table if not exists consent_audit (
  id           uuid primary key default uuid_generate_v4(),
  customer_id  uuid references customers(id) on delete set null,
  consent_type text not null check (consent_type in ('marketing_email', 'marketing_sms', 'data_processing', 'cookies')),
  granted      boolean not null,
  method       text,
  ip           text,
  user_agent   text,
  created_at   timestamptz default now()
);
alter table consent_audit enable row level security;
create policy "auth full access" on consent_audit for all to authenticated using (true) with check (true);

-- Wave 5: GDPR — soft-delete / anonymisation fields on customers
alter table customers
  add column if not exists anonymised_at timestamptz,
  add column if not exists deletion_requested_at timestamptz;

-- Wave 1 / Wave 2: Add source field to job_notes (customer vs staff)
alter table job_notes add column if not exists source text not null default 'staff' check (source in ('staff', 'customer', 'system'));

-- Wave 2: Progress photos need a caption already supported — just confirm photo_type 'repair' is valid
-- (photo_type is text with no CHECK constraint — already works)

-- Wave 3: Portal messaging — customers need a token to post messages
alter table jobs add column if not exists portal_token text unique;
-- generate tokens for existing jobs
update jobs set portal_token = gen_random_uuid()::text where portal_token is null;
