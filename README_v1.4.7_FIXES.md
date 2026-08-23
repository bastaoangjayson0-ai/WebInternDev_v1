# WebInternDev v1.4.7

## Meeting fixes
- Reduced remote participant playback volume and disabled microphone AGC to reduce loud/booming audio.
- Kept WebRTC echo cancellation and noise suppression enabled.
- Chat uses reliable LiveKit data packets and accepts chat data even when permission metadata is not populated locally; token already grants canPublishData.
- Added a ChatMessage fallback listener.
- Remote screen share is tracked directly from TrackSubscribed/TrackPublished/TrackUnpublished so phone users render the host screen in the main meeting tile.
- Mobile layout gives remote screen share a large dedicated main tile with participant thumbnails below.

Supabase is unchanged. LiveKit token grants are unchanged and include canPublishData.
