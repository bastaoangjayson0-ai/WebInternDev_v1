# v1.6.6 Camera Fallback Fix

Fixes participant tiles becoming black after Camera ON → OFF.

- Local camera state now immediately controls the local tile.
- Remote muted/ended camera tracks fall back to the avatar.
- Track mute/unmute events refresh participant tiles.
- Avatar and participant name are restored on every camera-off transition.
