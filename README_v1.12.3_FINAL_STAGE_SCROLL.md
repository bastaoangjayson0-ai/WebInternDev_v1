# WebInternDev v1.12.3 — Final Google Meet Stage + Overflow-Gated Scroll

- Restores active-speaker-to-front ordering and emote priority.
- Screen sharing: large left shared screen + boxed participant rail on right.
- Participant rail does not scroll when all tiles fit.
- Scroll activates only when the participant content overflows the available rail.
- Wheel capture keeps desktop scrolling working even when the cursor is over a participant video/tile.
- Touch scrolling remains available on phone/tablet when overflow exists.
- No screen sharing: participant gallery fills the meeting stage.
- Removed the conflicting fixed/always-scroll CSS behavior from the effective cascade by placing a final authoritative layout block at the end.
