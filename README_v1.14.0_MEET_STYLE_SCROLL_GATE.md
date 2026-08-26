# WebInternDev v1.14.0 — Meet-style meeting redesign + overflow-gated scrolling

- Redesigned the meeting surface to a dark Google Meet-style layout.
- Shared screen gets the main focus area and participants use a compact tray underneath.
- Without screen sharing, participant tiles use the full meeting canvas.
- Participant scrolling is gated by actual rendered overflow.
- When all participant tiles fit, the scrollbar is hidden and the gallery does not consume wheel/touch scrolling.
- When tiles overflow, desktop mouse-wheel scrolling works over the participant tiles and mobile/tablet finger scrolling uses native vertical touch scrolling.
- Participant video elements do not intercept the wheel gesture.
- Existing screen-share aspect-ratio preservation remains intact.
