# WebInternDev v1.4.9 — Participant Audio Volume Fix

- Restored remote microphone playback to 90% instead of the previous 18%, which was making normal voices too quiet.
- Remote LiveKit microphone tracks and attached audio elements both use 0.9 playback volume.
- Microphone capture uses browser echo cancellation, noise suppression, and automatic gain control so quieter participant microphones are normalized before transmission.
- Preserved v1.4.8 participant subscription/join/chat/screen-share fixes.
- No Supabase changes required.

LiveKit documents remote participant `setVolume()` and remote audio track `setVolume()` for controlling playback volume.
