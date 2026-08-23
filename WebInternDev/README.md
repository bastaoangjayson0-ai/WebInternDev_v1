# WebInternDev

Responsive Google-Meet-style frontend prototype for the planned WebInternDev platform.

## Included now
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

## Demo credentials
Admin name: `Bastaoang Jayson A`
Admin password: `webinternDEV`
Host password: `BSIT`
User password: `CRT-NEUST-GSC`

## Important production note
This build is a frontend prototype. The real 50-participant multi-user system should connect the UI to:
- Supabase Auth + Postgres for authentication, meetings, attendance and history.
- LiveKit Cloud for realtime WebRTC media, screen sharing and reconnection.
- Vercel for the web application.

Do not put production passwords or LiveKit server secrets in browser code. Use Supabase Auth and server-side token generation for production.

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
Then deploy the generated `dist` directory using Vercel or another static host.
