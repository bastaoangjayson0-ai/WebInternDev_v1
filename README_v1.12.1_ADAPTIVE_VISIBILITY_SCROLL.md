# v1.12.1 — Adaptive Visibility-Based Participant Scrolling

- The participant gallery no longer decides scrolling only from participant count.
- The gallery gets the available vertical space above the meeting controls.
- If every participant tile is visible, the native scrollbar does not appear.
- If any participant tile would be below the visible gallery, `overflow-y:auto` allows scrolling.
- Works with desktop mouse-wheel, laptop trackpad, phone touch, and tablet touch.
- Screen-sharing participant rail uses the same visibility-based behavior.
- Active-speaker priority and emote priority from v1.11.1 are preserved.
- A ResizeObserver detects changes in viewport/tile size and marks the gallery with `needs-scroll` when its content overflows.
