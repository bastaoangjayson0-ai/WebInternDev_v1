# v1.12.9 — definitive Google Meet stage and overflow scroll fix

- Restores the desktop shared-screen + 3-column participant layout as the final CSS override.
- Removes the accidental small-width collapse caused by older media-query rules taking precedence.
- Participant scrolling is based on actual rendered overflow, not participant count.
- Mouse-wheel scrolling works over the participant gallery/tile when overflow exists.
- Touch scrolling remains enabled on phone/tablet when overflow exists.
- Small calls remain non-scrollable when every participant tile fits.
- Active-speaker/emote ordering is preserved in `src/main.jsx`.
