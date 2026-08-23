# WebInternDev v1.6.4 — Screen Toggle Reset Fix

Fixed the bug where screen sharing could be turned on/off once, but after another on/off cycle the main area stayed black or empty instead of restoring the default Screen Share view.

Changes:
- Fully clears local and remote screen-track references on every screen-share stop.
- Handles both `screen_share` and `screenShare` LiveKit source names.
- Handles TrackUnpublished and TrackUnsubscribed events.
- Detects browser capture `ended` events, including stopping from the browser's share bar.
- Ignores ended MediaStreamTracks.
- Forces a clean remount between live screen video and the Screen Share placeholder.

Result: after every ON -> OFF cycle, both host and users return to the Screen Share placeholder, and the next share starts cleanly.
