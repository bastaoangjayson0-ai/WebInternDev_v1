# WebInternDev v1.7.6 — Self Avatar Interactive Emote

## Behavior
- User, Host, and Admin trigger Interactive Emote by holding their own avatar.
- Holding another participant does nothing.
- The default avatar temporarily hides while the emote is active and returns after the effect ends.
- Interactive emote events are broadcast through LiveKit data messages so other participants render the effect and play the sound.
- Event IDs are deduplicated locally to prevent the sender from replaying the same sound if the server echoes its own event.
