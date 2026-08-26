# WebInternDev v1.15.0 — Meet Layout Complete

Implemented on top of v1.14.3.

## Meeting layout
- Large shared-screen focal area when a screen share is active.
- Shared screen preserves source aspect ratio with `object-fit: contain`.
- Participant gallery is directly below the shared screen.
- Desktop/tablet landscape uses a Meet-style Participants/Chat sidebar.
- Mobile/tablet narrow layout hides the desktop sidebar and keeps the participant gallery touch-scrollable.

## Participant scrolling
- Gallery is the scrolling viewport, not the whole meeting page.
- Scroll is disabled/hidden while all rendered participant tiles fit.
- Scroll becomes active automatically when rendered tiles overflow.
- Mouse-wheel events are captured at the gallery boundary, including over video tiles.
- Touch scrolling uses `touch-action: pan-y`, native momentum scrolling and contained overscroll.
- Active scrollbar thumb has a subtle glow.

## Activity priority
- Speaking participants are sorted to the front and receive a blue animated glow.
- Emoting participants are sorted to the front and receive a purple animated glow.
- Speaking + emote receives a combined cyan/blue/purple glow.
- Existing LiveKit ActiveSpeakersChanged and interactive-emote data handling are preserved.

## Existing functionality preserved
- Host-only screen sharing and pin/unpin.
- Camera/microphone controls.
- Chat and chat notification behavior.
- Reactions and interactive emotes.
- Admin/Host/User roles.
- Existing LiveKit token API.
