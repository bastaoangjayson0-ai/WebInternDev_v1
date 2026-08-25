# WebInternDev v1.11.0 — Universal Participant Scroll + Highlight Fix

## Participant scrolling
- Desktop/laptop: the participant gallery is a real scroll viewport and automatically chooses columns from available width.
- Tablet: the gallery remains scrollable and adapts columns to the available space.
- Phone: the gallery is vertically scrollable with two columns on narrow screens.
- Screen sharing: the shared screen remains in the main panel while the participant gallery scrolls independently.
- No screen sharing: the participant gallery fills the stage and scrolls through all participants.

## Speaking/emote highlight fix
- Participant tiles no longer reorder when someone speaks or uses an interactive emote.
- Highlighting is visual-only, preserving tile position and scroll position.
- Speaker and emote states can still be shown together without moving neighboring tiles.

## Why this fixes the previous bug
The previous implementation sorted active participants to the front. With many participants, React/LiveKit updates could move tiles while the user was scrolling, causing jumps and incorrect-looking highlights. v1.11.0 keeps stable DOM order and only applies highlight classes.
