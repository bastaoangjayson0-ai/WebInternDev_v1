# WebInternDev V1.0.1

Responsive Google-Meet-style frontend prototype for WebInternDev.

## Included
- WebInternDev branding and provided logo
- First screen: Admin / Host / User
- Demo authentication flow
- Fixed provided avatar for Host/User (no avatar chooser)
- Host-created meetings
- Maximum 2 active rooms in demo state
- 50 participant display limit
- Admin dashboard prototype
- Host-only screen share and pin/unpin controls
- Responsive meeting layout
- Rejoin/leave UI foundation
- Local demo room persistence via localStorage
- Vercel-ready Vite configuration
- SPA fallback to prevent Vercel 404s on application routes

## Demo credentials
Admin name: `Bastaoang Jayson A`
Admin password: `webinternDEV`
Host password: `BSIT`
User password: `CRT-NEUST-GSC`

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Vercel deployment
Import this project as a Vite project. Keep the **Root Directory** set to the folder containing `package.json` (the WebInternDev folder if the ZIP is extracted first).

The included `vercel.json` explicitly builds with `npm run build`, serves `dist`, and provides an SPA fallback so direct routes do not return Vercel `404: NOT_FOUND`.

If the Vercel project already exists, redeploy this version after replacing the old project files. If the project was configured with a different Root Directory, change it to the directory containing `package.json`.

## Production architecture
The current build is a frontend prototype. For real multi-user meetings, connect:
- Supabase Auth + Postgres for authentication, meetings, attendance and history.
- LiveKit Cloud for realtime WebRTC media, screen sharing and reconnection.
- Vercel for the web application.

Do not put production passwords or LiveKit server secrets in browser code. Use secure backend/token generation for production.


## Supabase connection (V1.1)
1. Open Supabase SQL Editor.
2. Run `supabase_schema.sql`.
3. In Vercel Project Settings → Environment Variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Redeploy.

The publishable key is intended for frontend use. Never put a Supabase secret/service-role key in this project. The included RLS policies are prototype policies for initial testing and must be tightened before public production.
