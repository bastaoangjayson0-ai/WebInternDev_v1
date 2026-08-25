# WebInternDev v1.10.7 — Admin Password Controls, Developer Join Notice, Chat Read Indicators

## Changes

- Admin room security now has explicit **Set Password**, **Change Password**, and **Remove Password** actions for every active Host-created room.
- Admin joining a meeting broadcasts: **Developer of this Site is joining the meeting.**
- The Admin also sees the same join notification locally.
- Chat now shows a persistent unread dot on the Chat button when a new incoming message has not been opened/read.
- When a user opens Chat, read receipts are sent for incoming messages.
- Sent messages show a red dot while at least one currently connected recipient has not read them, and a check mark when all recipients have read them.
- Chat uses reliable LiveKit data messages with message IDs so read receipts can match the correct message.

## Supabase

No new database table is required for these features. Room password storage still requires `public.wid_rooms.room_password`; run `supabase_room_password_migration.sql` once if that column is missing.
