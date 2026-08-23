# WebInternDev v1.4.8 — Participant Mic Reliability Fix

- Explicitly subscribes to newly published and already-published remote tracks.
- Verifies microphone publication and unmutes the publication after enabling.
- Local mic mute/unmute events only affect the microphone source.
- Handles LiveKit TrackSubscriptionFailed for clearer diagnostics.
- Preserves Supabase room sync, user join, chat, and mobile screen-share fixes from v1.4.7.
