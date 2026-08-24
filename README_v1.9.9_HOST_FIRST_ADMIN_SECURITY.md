# WebInternDev v1.9.9 — Host First + Admin Emote/Room Security + Responsive Performance

## Added
- Host is always the first participant in the participant gallery.
- Active speaker/emote participants are promoted after the Host so they are easy to spot.
- When speaking/emote activity ends, normal participant order returns.
- Uses both LiveKit ActiveSpeakersChanged and `participant.isSpeaking` for more reliable speaker highlighting.
- Phone: 2-column participant gallery with a real vertical scrolling viewport.
- Tablet: 3-column participant gallery with a real vertical scrolling viewport.
- Desktop: participant gallery remains scrollable for large meetings.
- Reduced dashboard room polling from 3 seconds to 12 seconds because Supabase realtime handles room changes; this reduces unnecessary network work.
- Admin can disable/enable Interactive Emotes globally at any time.
- When disabled, the Emote button/picker disappears and incoming emote events are ignored.
- Admin can set/remove a password for any active Host-created room.
- Users must enter the room password before joining a protected room. Host and Admin can enter without the room password.

## Supabase migration required
Run the updated `supabase_schema.sql` in the Supabase SQL Editor. It adds:
- `public.wid_rooms.room_password`
- `public.wid_settings.emote_enabled`
- Realtime publication for `wid_settings`

Without this migration, room passwords and cross-device Admin emote control cannot be synchronized online.

## Performance/reliability notes
- LiveKit remains the real-time media transport.
- Room list changes are primarily handled through Supabase realtime.
- Dashboard fallback polling is 12 seconds instead of 3 seconds.
- Participant gallery scrolling is contained inside the meeting layout so page scrolling does not replace participant scrolling on touch devices.
