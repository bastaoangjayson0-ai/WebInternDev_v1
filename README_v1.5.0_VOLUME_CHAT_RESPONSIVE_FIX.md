# WebInternDev v1.5.0 — 100% Audio + Clear Chat + Responsive Phone/Tablet Layout

- Remote participant audio playback is set to 100% in LiveKit and attached audio elements.
- Microphone capture keeps echo cancellation/noise suppression and disables automatic gain control to avoid aggressive gain changes.
- Chat uses LiveKit sendChatMessage when available, with a reliable data fallback.
- Chat bubbles always show the sender name.
- Chat panel uses an opaque, crisp white surface instead of blur/translucency.
- Meeting stage, thumbnails, controls, and chat/participant panels are responsive for desktop, tablet, and phone.
- Screen-share layout remains compatible with the existing v1.4.7+ behavior.
- No Supabase changes required.
