-- WebInternDev V1.1 database schema
-- Run this in Supabase SQL Editor before deploying the connected build.

create table if not exists public.wid_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('host','user')),
  created_at timestamptz not null default now(),
  unique(name, role)
);

create table if not exists public.wid_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  host text not null,
  participants integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.wid_attendance (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('host','user')),
  room_id uuid not null,
  room_title text not null,
  host text not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  duration integer
);

create table if not exists public.wid_settings (
  id integer primary key default 1 check (id = 1),
  host_password text not null default 'BSIT',
  user_password text not null default 'CRT-NEUST-GSC',
  updated_at timestamptz not null default now()
);
insert into public.wid_settings(id) values (1) on conflict (id) do nothing;

alter table public.wid_users enable row level security;
alter table public.wid_rooms enable row level security;
alter table public.wid_attendance enable row level security;
alter table public.wid_settings enable row level security;

-- Prototype policies: the publishable key can read/write app data.
-- Replace these with authenticated/RBAC policies before public production.
drop policy if exists wid_users_public on public.wid_users;
create policy wid_users_public on public.wid_users for all to anon, authenticated using (true) with check (true);
drop policy if exists wid_rooms_public on public.wid_rooms;
create policy wid_rooms_public on public.wid_rooms for all to anon, authenticated using (true) with check (true);
drop policy if exists wid_attendance_public on public.wid_attendance;
create policy wid_attendance_public on public.wid_attendance for all to anon, authenticated using (true) with check (true);
drop policy if exists wid_settings_public on public.wid_settings;
create policy wid_settings_public on public.wid_settings for all to anon, authenticated using (true) with check (true);

-- Realtime for rooms/attendance.
alter publication supabase_realtime drop table if exists public.wid_rooms;
alter publication supabase_realtime drop table if exists public.wid_attendance;
alter publication supabase_realtime add table public.wid_rooms;
alter publication supabase_realtime add table public.wid_attendance;


-- WebInternDev v1.9.9 migration: room passwords + global Admin emote control.
alter table public.wid_rooms add column if not exists room_password text not null default '';
alter table public.wid_settings add column if not exists emote_enabled boolean not null default true;
update public.wid_settings set emote_enabled=true where id=1 and emote_enabled is null;

-- Realtime lets every active meeting immediately receive Admin emote enable/disable changes.
alter publication supabase_realtime drop table if exists public.wid_settings;
alter publication supabase_realtime add table public.wid_settings;
