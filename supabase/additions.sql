-- Run this in Supabase SQL Editor after support-schema.sql

-- Add reschedule support to appointments
alter table public.appointments
  add column if not exists reschedule_token uuid default gen_random_uuid(),
  add column if not exists reschedule_count integer not null default 0;

-- Ensure every existing appointment gets a reschedule token
update public.appointments set reschedule_token = gen_random_uuid() where reschedule_token is null;

-- Knowledge base
create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  content text not null,
  category text not null default 'general',
  tags text[] default '{}',
  is_published boolean not null default true,
  author text
);
