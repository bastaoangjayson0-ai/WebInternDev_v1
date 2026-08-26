# WebInternDev v1.14.1 — Final Meet-style meeting canvas

- Screen sharing uses a large presentation area with a participant tray underneath.
- Without screen sharing, participants fill the meeting canvas.
- Participant scrolling is gated by actual rendered overflow.
- When all tiles fit, scrolling is hidden and disabled.
- When tiles overflow, desktop wheel scrolling works over tiles and mobile/tablet finger scrolling works in the participant gallery.
- Shared screen remains `object-fit: contain` and preserves its captured aspect ratio.
- The final CSS override is intentionally placed at the end of the stylesheet to override older meeting-layout rules.
