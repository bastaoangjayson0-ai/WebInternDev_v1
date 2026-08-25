# WebInternDev v1.12.4 — True Overflow-Gated Participant Scrolling

## Behavior
- Scrolling is disabled when every participant tile is visible in the available gallery viewport.
- Scrolling activates only when the actual tile geometry or scroll height exceeds the viewport.
- Desktop wheel scrolling is captured at the gallery container in the native capture phase, so it still works when the pointer is directly over a video, avatar, or emote overlay.
- Phone/tablet use native touch scrolling only while the gallery is overflowing.
- Active-speaker priority remains intact: speaking participants move to the front, then active emotes, then stable original order.
- Screen share uses a large main stage with a compact participant rail.
