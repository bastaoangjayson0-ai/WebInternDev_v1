# WebInternDev v1.4.2 — Microphone + Chat Fix

This version keeps the existing Supabase room-sharing setup and does not add SVG meeting icons.

## What changed
- Microphone initialization is explicit and independent from camera initialization.
- Checks for an audio-input device before enabling LiveKit microphone publishing.
- Verifies that a LiveKit local audio publication actually exists.
- Microphone errors are shown inside the meeting with a retry action.
- Microphone mute/unmute reports success/failure clearly.
- LiveKit chat uses the `chat` topic with reliable delivery.
- Chat now reports connection/send errors and disables sending until the LiveKit data channel is ready.
- Incoming chat accepts the current LiveKit DataReceived callback shape and topic.

## Required Vercel environment variables
The existing LiveKit variables must be configured:
- LIVEKIT_URL
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET

Supabase room sharing remains unchanged.


## v1.4.3 audio level fix
- Remote participant microphone playback is capped at 55% to prevent excessively loud/yelling playback.
- Microphone capture uses WebRTC echo cancellation, noise suppression, automatic gain control, and mono capture.
- Remote participant volume is applied both through LiveKit and the attached audio element.
