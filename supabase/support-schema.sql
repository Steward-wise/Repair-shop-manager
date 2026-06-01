-- Support Clients (CRM)
create table if not exists public.support_clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  website text,
  client_type text not null default 'prospect', -- prospect, active, inactive
  industry text,
  notes text,
  monthly_value numeric
);

-- Support Tickets
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ticket_number serial,
  ticket_type text not null default 'service_desk', -- service_desk, incident
  title text not null,
  description text,
  status text not null default 'open', -- open, in_progress, pending_client, resolved, closed
  priority text, -- p1, p2, p3, p4 (incidents only)
  client_id uuid references public.support_clients(id),
  contact_name text,
  contact_email text,
  contact_phone text,
  assigned_to text,
  resolved_at timestamptz,
  closed_at timestamptz
);

-- Ticket Messages (email thread)
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  direction text not null default 'outbound', -- outbound, inbound, internal
  from_name text,
  from_email text,
  body text not null,
  sent boolean not null default false
);

-- Ticket Attachments
create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_size integer,
  uploaded_by text
);

-- Ticket Timeline (activity log)
create table if not exists public.ticket_timeline (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  event_type text not null, -- created, status_changed, message_sent, assigned, note_added, attachment_added, priority_changed
  description text not null
);

-- IT Quotes
create table if not exists public.it_quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ticket_id uuid references public.support_tickets(id),
  client_id uuid references public.support_clients(id),
  title text not null,
  items jsonb not null default '[]',
  subtotal numeric not null default 0,
  vat_rate numeric not null default 20,
  total numeric not null default 0,
  notes text,
  status text not null default 'draft', -- draft, sent, accepted
  quote_token uuid not null default gen_random_uuid(),
  sent_at timestamptz,
  accepted_at timestamptz,
  valid_until date
);

-- Extend appointments table for IT callouts
alter table public.appointments
  add column if not exists appointment_type text not null default 'repair',
  add column if not exists ticket_id uuid references public.support_tickets(id);
