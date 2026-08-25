# WebInternDev v1.10.6 — Room Password Fix

## What was fixed

The Admin **Room passwords** control can now target rooms created by the Host without requiring the Host to recreate the room.

The error shown in the previous build:

`PGRST204 ... Could not find the 'room_password' column of 'wid_rooms' in the schema cache`

means the live Supabase database does not currently expose `public.wid_rooms.room_password`.

### Required one-time Supabase step

1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Open `supabase_room_password_migration.sql` from this ZIP.
4. Run the SQL.
5. Refresh/reload the WebInternDev website.

The migration is safe to run even if the column already exists.

## After the migration

- Host creates a meeting normally.
- Admin opens **Emote & Room Security**.
- The Host-created room appears under **Room passwords**.
- Admin enters a password and clicks **Save**.
- The password is stored in Supabase and is available across devices.
- Users are asked for the room password before joining.
- Admin and Host can enter without the room password.

## Important

The browser cannot create a missing PostgreSQL column by itself. The one-time SQL migration is required because `room_password` is a database schema change.

The build also gives a specific error message when the migration has not been applied instead of showing only the raw PostgREST error.
