# WebInternDev v1.10.1 — Phone & Tablet Participant Scrolling Fix

Applied to v1.10.0.

- Participant gallery is a dedicated flex scroll viewport.
- Uses `height: 0` + `flex: 1 1 0` so the browser has a definite scrollable height.
- Phone: 2-column vertical gallery.
- Tablet: 3-column vertical gallery.
- Touch `pan-y` and momentum scrolling enabled.
- Main meeting page remains fixed; only participant gallery scrolls.
- Supports the existing Host-first, active-speaker and emote ordering.
