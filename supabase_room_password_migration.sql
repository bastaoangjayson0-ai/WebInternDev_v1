-- WebInternDev v1.10.6
-- Fix: Admin cannot save a password for a Host-created room because
-- public.wid_rooms.room_password is missing from the live Supabase schema.
--
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> Run.
-- Safe to run even if the column already exists.

alter table public.wid_rooms
  add column if not exists room_password text not null default '';

-- Refresh PostgREST's schema cache so the REST API sees the new column immediately.
notify pgrst, 'reload schema';

-- Optional verification:
-- select id, title, host, room_password from public.wid_rooms order by created_at desc;
