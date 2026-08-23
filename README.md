# WebInternDev V1.2.1 — LiveKit endpoint fix

This version fixes the Vercel SPA rewrite that was intercepting `/api/livekit-token` and returning `index.html` instead of executing the serverless function.

## Vercel environment variables

Set these in Vercel:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Keep `LIVEKIT_API_SECRET` server-side and never expose it as a `VITE_` variable.

## Deploy

Upload the contents of this folder to the existing Vercel project and redeploy. The `/api/livekit-token` function is now allowed to reach Vercel's serverless runtime.
