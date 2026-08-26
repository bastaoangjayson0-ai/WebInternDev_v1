# WebInternDev v1.13.2 — Aspect-Ratio-Safe Screen Share

- Shared-screen video uses `object-fit: contain` and never stretches.
- The meeting stage/container controls available space; the video does not force a 16:9 container.
- 16:9, 16:10, portrait phone, and other captured aspect ratios are preserved.
- Black/empty space is allowed around the shared screen when the container ratio differs.
- Removed the inline screen-share aspect-ratio constraint from the React stage tile.
- Participant gallery, active-speaker ordering, screen pinning, and scrolling behavior are preserved.
