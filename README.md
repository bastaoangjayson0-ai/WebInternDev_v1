# WebInternDev v1.2.2

LiveKit token endpoint hardened for Vercel Node.js Functions.

## Vercel environment variables

- LIVEKIT_URL
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET

Keep LIVEKIT_API_SECRET server-side only.

## Token endpoint health check

After deployment, open:

`https://YOUR-DOMAIN.vercel.app/api/livekit-token`

It should return JSON with `ok: true` and `configured: true`.

If `configured` is false, check the three Vercel environment variables and redeploy.
