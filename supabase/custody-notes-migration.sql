-- Chain-of-custody events table (replaces single-signature pattern for multi-handover tracking)
create table if not exists job_custody_events (
  id            uuid primary key default uuid_generate_v4(),
  job_id        uuid not null references jobs (id) on delete cascade,
  event_type    text not null check (event_type in ('intake', 'return_to_customer', 'collection')),
  direction     text not null check (direction in ('in', 'out')),
  event_date    date not null default current_date,
  signature_url text,
  person_name   text,
  notes         text,
  created_at    timestamptz default now()
);

alter table job_custody_events enable row level security;
create policy "auth full access" on job_custody_events for all to authenticated using (true) with check (true);

-- Job notes / timeline table
create table if not exists job_notes (
  id          uuid primary key default uuid_generate_v4(),
  job_id      uuid not null references jobs (id) on delete cascade,
  content     text not null,
  note_type   text not null default 'note' check (note_type in ('note', 'status_change', 'custody', 'payment')),
  staff_name  text,
  meta        jsonb,
  created_at  timestamptz default now()
);

alter table job_notes enable row level security;
create policy "auth full access" on job_notes for all to authenticated using (true) with check (true);
