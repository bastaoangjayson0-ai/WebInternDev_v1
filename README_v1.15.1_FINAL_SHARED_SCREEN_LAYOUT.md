# WebInternDev v1.15.1 — Final shared-screen focal layout

This patch fixes the meeting stage hierarchy so the shared screen is the main/focal area on desktop and tablet when screen sharing is active. The participant gallery is placed directly below it in the left/main column, while the Participants/Chat sidebar occupies the full right side.

## Behavior
- Shared screen fills the main presentation box without distortion.
- `object-fit: contain` preserves 16:9, 16:10, and portrait sources.
- Participant tiles stay below the presentation.
- Participant gallery scrolls only when content actually overflows.
- Wheel/touch scrolling remains confined to the participant gallery.
- Existing active-speaker/emote glow classes remain intact.
- Mobile layout remains a single-column presentation + gallery layout.
