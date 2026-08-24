# WebInternDev v1.9.6 — Active Speaker + Emote Highlight

## Added
- Google Meet-style participant highlight when LiveKit reports an active speaker.
- The speaking participant tile gets a teal border/glow and a small **Speaking** badge.
- Emote-active participant tile gets a purple border/glow and a small **Emote** badge.
- If someone is speaking while an emote is playing, both states are visually combined without changing the grid layout.
- The highlight is contained entirely inside the participant tile and remains responsive on desktop, tablet, and phone.
- Uses LiveKit `ActiveSpeakersChanged` so the highlight follows actual meeting audio activity.

## Preserved
- SHEEESHHH and FAAAAH emotes
- 5-second emote cooldown
- Centered avatar-footprint emotes
- React
- Host-only screen share and synchronized pin
- Dark theme and responsive layout
