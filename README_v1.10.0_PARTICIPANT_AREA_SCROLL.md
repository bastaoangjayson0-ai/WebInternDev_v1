# WebInternDev v1.10.0 — Participant Area Scroll

Applied to v1.9.9.

## Participant gallery behavior
- The participant gallery itself is always the scroll container when there are many participants.
- Desktop: one-column participant sidebar, about five tiles visible before vertical scrolling.
- Tablet: three-column gallery, about 6–9 tiles visible before vertical scrolling.
- Phone: two-column gallery, about 5–6 tiles visible before vertical scrolling.
- The main meeting page does not need to scroll to reach participants.
- Touch scrolling uses `pan-y` and momentum scrolling.
- Overflow in the horizontal direction is prevented for normal galleries.
- Host-first / active-speaker / emote ordering remains controlled by the existing React ordering logic.
- Pinned screen keeps a compact, scrollable participant strip.
