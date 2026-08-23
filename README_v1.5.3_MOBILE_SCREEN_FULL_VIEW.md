# WebInternDev v1.5.3 — Mobile/Tablet Screen Share Full View

- Disabled LiveKit adaptiveStream/dynacast for screen-share clarity.
- Shared screen is always rendered with `object-fit: contain` so the full source frame is visible instead of cropped.
- Added responsive mobile/tablet stage sizing using dynamic viewport units.
- Pin Screen is available to all participants, not only the Host.
- Added Full screen control for the shared screen; uses the Fullscreen API with iOS video fallback where supported.
- Screen capture track requests `contentHint=detail` where the browser exposes it.
- Supabase and room-sharing behavior unchanged.
