# WebInternDev v1.14.2 — LiveKit local + Vercel API fix

- Uses a standard Vercel Node.js API handler for `/api/livekit-token`.
- Adds a Vite development middleware for `/api/livekit-token`, so `npm run dev` no longer returns the Vite HTML page to `response.json()`.
- Local development still requires `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in `.env.local`.
- Production requires the same three variables in Vercel Environment Variables.
- No LiveKit secret is exposed to the browser.
