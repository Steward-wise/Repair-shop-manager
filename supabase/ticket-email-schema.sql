-- Email threading on ticket messages
alter table public.ticket_messages
  add column if not exists email_message_id text,
  add column if not exists email_in_reply_to text;

-- Actor (who performed the action) on timeline events
alter table public.ticket_timeline
  add column if not exists actor text;

-- Source of ticket (manual, email, web, phone)
alter table public.support_tickets
  add column if not exists source text not null default 'manual';

-- Index to speed up email threading lookups
create index if not exists idx_ticket_messages_email_message_id on public.ticket_messages (email_message_id);
