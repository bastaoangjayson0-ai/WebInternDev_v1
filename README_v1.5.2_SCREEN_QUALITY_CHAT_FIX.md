# WebInternDev v1.5.2 — Screen Quality + Chat Fix

## Fixed
- Improved screen-share clarity by disabling adaptive/dynacast downscaling for the meeting and publishing screen share at up to 1920x1080, 15fps, maintain-resolution, and up to 8 Mbps.
- Remote screen-share publications request HIGH quality and 1920x1080 dimensions when supported.
- Screen-share capture uses `contentHint: detail` for text/UI clarity.
- Fixed the chat crash: `appendChatMessage is not defined` by removing the out-of-scope helper call when sending a local chat message.
- Local chat messages display the sender's name and are appended directly to chat state.
- Existing Supabase room sharing, microphone, mobile layout, screen pinning, and participant fixes are preserved.

## Important
Actual screen-share quality is limited by the host device's capture resolution, browser support, network bandwidth, and the recipient device. The app requests high quality but cannot create detail that is not present in the source screen.

No Supabase SQL changes are required.
