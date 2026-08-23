# WebInternDev v1.5.4

- Mobile/tablet shared-screen layout now preserves the actual received screen aspect ratio instead of forcing 16:9.
- The entire shared screen remains visible with contain rendering.
- Only the Host can pin/unpin the shared screen.
- Admin can join any active room from the Admin dashboard.
- LiveKit token endpoint now accepts the admin role.
- Participants receive a meeting notification when an Admin joins: “Admin <name> is joining the meeting.”
- Admin also receives a local joining notification.
- Supabase schema does not need to be changed for these features.
