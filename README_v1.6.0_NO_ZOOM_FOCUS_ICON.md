# WebInternDev v1.6.0 — No Zoom + Compact Shared-Screen Focus Icon

- Removed the participant-facing shared-screen zoom state and the `- / 100% / + / Fit` toolbar.
- Shared screens always use `object-fit: contain`, so users cannot manually zoom the shared screen.
- Replaced the zoom toolbar with a compact overlapping-rectangle icon matching the supplied reference image.
- Clicking the icon toggles the existing pinned/focused shared-screen view.
- Existing Host/User meeting controls and screen sharing remain unchanged.
