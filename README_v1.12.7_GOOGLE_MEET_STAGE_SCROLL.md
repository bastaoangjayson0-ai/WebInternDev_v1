# WebInternDev v1.12.7 — Google Meet stage + true overflow scrolling

- Screen share: large main stage on the left, participant rail on the right.
- Participant rows have a real minimum/fixed tile height so they can overflow.
- Scrolling is enabled from actual rendered overflow, not participant count.
- If every tile is visible, scrolling is disabled and normal page scrolling is preserved.
- Mouse wheel is captured at the gallery in capture phase only when the gallery can actually scroll, including when the pointer is directly over a video/avatar/emote.
- Touch scrolling uses native overflow when enabled.
- Small no-screen calls collapse to the actual participant tiles so controls stay close.
- Active-speaker-to-front and emote priority remain unchanged.
