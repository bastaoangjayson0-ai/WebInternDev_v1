# WebInternDev v1.8.4 — Mobile/Tablet Viewport Fit

## Changes
- Fixed meeting layout for phone and tablet views so the page does not require horizontal scrolling.
- Screen-share stage scales to the available viewport using a responsive aspect ratio.
- Participant tiles become responsive grids instead of overflowing horizontally.
- Meeting controls wrap into touch-friendly rows and stay inside the device viewport.
- Host controls (Share/Pin) remain available only to Host.
- Removed the Interactive Emote control and Slap feature from the active meeting UI/code path.
- Regular Reactions remain available through the React button.

## Important
The source package does not include installed `node_modules`. Run `npm install` and then `npm run build` before deployment.
