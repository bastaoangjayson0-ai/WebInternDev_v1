# WebInternDev v1.5.1 — Screen Share Pin + Full-Scale Fix

Built from v1.5.0.

## Fixed
- Host screen sharing can now be pinned by Host and by every User/participant who is receiving the shared screen.
- Pinning hides the participant thumbnail strip and expands the shared screen to the available viewport.
- Mobile and tablet pinned screen uses dynamic viewport sizing (`dvh`) so the shared presentation is substantially larger and easier to read.
- Shared screen remains `object-fit: contain` so the complete presentation is visible rather than cropped.
- Existing Supabase room sharing, audio, chat, and responsive layout are preserved.
- No SVG meeting-control icons added.

## Test
1. Host starts a meeting.
2. Host starts screen sharing.
3. Join from a phone/tablet as User.
4. User should see the shared screen in the main stage.
5. User can press **Pin screen** to expand it.
6. Press **Unpin** to restore the participant layout.
