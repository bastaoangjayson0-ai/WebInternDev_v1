# WebInternDev V1.2.5 — Reliable Host/User Room Sync

This version makes active meeting rooms server-authoritative through Supabase and fixes a sync bug where a missing optional table (users, attendance, or settings) could prevent the room list from loading at all.

## How room sharing works
- Host creates a room → the room is written to `public.wid_rooms`.
- User dashboard → reads active rows from `public.wid_rooms` every 3 seconds.
- Supabase Realtime listens for room INSERT/UPDATE/DELETE events.
- The room list is no longer blocked by optional `wid_users`, `wid_attendance`, or `wid_settings` errors.

## Required Supabase step
Run `supabase_schema.sql` in the Supabase SQL Editor. The script creates `wid_rooms` and the other app tables, enables RLS policies, and adds rooms/attendance to Realtime.

**Important:** If `public.wid_rooms` does not exist, a Host cannot publish a room to the shared database and Users on other devices cannot see it. Local browser storage is not shared between devices.

## Vercel
Recommended variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

The current build also contains a built-in Supabase fallback so the existing deployment can continue using the configured project, but adding the Vercel variables is recommended.

## Supabase Setup Checker
The dashboard includes **⚙ Check Supabase setup**. It checks the connection and the required tables and specifically reports whether `public.wid_rooms` is reachable. Missing optional tables no longer prevent active room discovery.
