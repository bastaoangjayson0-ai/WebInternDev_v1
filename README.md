# WebInternDev V1.2.4 — Room Visibility / Supabase Sync Fix

This version makes active meeting rooms server-authoritative through Supabase. Hosts publish rooms to `wid_rooms`; Users query active rooms on login/dashboard and refresh every 3 seconds. Supabase Realtime listens for INSERT/UPDATE/DELETE changes.

## Required Supabase step
Run `supabase_schema.sql` in Supabase SQL Editor. The script enables RLS policies and adds `wid_rooms` to the `supabase_realtime` publication.

## Vercel
Keep these variables:
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- LIVEKIT_URL
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET

After deployment, the User dashboard should show any active Host room. If it shows `Sync error`, use **Refresh meetings**; the error indicates Supabase table/RLS/configuration still needs fixing.

## Supabase Setup Checker
The dashboard now includes **⚙ Check Supabase setup**. It checks:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `public.wid_rooms`
- `public.wid_users`
- `public.wid_attendance`
- `public.wid_settings`

It distinguishes a missing table (`PGRST205`), RLS/permission blocking, and network/configuration errors, and gives the next action. If room sync fails, the checker also opens automatically.

If an environment variable is missing, add it in Vercel Project Settings → Environment Variables and redeploy. If a database table is missing, run `supabase_schema.sql` in Supabase SQL Editor.
