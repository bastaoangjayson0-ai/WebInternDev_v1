import { AccessToken } from 'livekit-server-sdk';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  },
});

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method === 'GET') {
      return json({
        ok: true,
        configured: Boolean(
          process.env.LIVEKIT_URL &&
          process.env.LIVEKIT_API_KEY &&
          process.env.LIVEKIT_API_SECRET
        ),
        urlConfigured: Boolean(process.env.LIVEKIT_URL),
        apiKeyConfigured: Boolean(process.env.LIVEKIT_API_KEY),
        apiSecretConfigured: Boolean(process.env.LIVEKIT_API_SECRET),
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Request body must be valid JSON.' }, 400);
      }

      const roomName = String(body?.roomName ?? '').trim();
      const participantName = String(body?.participantName ?? '').trim();
      const role = String(body?.role ?? '').trim().toLowerCase();

      if (!roomName || !participantName || !['admin', 'host', 'user'].includes(role)) {
        return json({
          error: 'roomName, participantName and role (admin, host or user) are required.'
        }, 400);
      }

      const apiKey = process.env.LIVEKIT_API_KEY?.trim();
      const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
      const livekitUrl = process.env.LIVEKIT_URL?.trim();

      if (!apiKey || !apiSecret || !livekitUrl) {
        return json({
          error: 'LiveKit environment variables are missing in this Vercel deployment.',
          configured: {
            url: Boolean(livekitUrl),
            apiKey: Boolean(apiKey),
            apiSecret: Boolean(apiSecret),
          }
        }, 500);
      }

      const identityBase = participantName
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 48) || 'participant';
      const identity = `${role}-${identityBase}-${crypto.randomUUID().slice(0, 8)}`;

      const token = new AccessToken(apiKey, apiSecret, {
        identity,
        name: participantName,
        metadata: JSON.stringify({ role }),
        ttl: '2h',
      });

      token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      return json({
        token: await token.toJwt(),
        url: livekitUrl,
      }, 200);
    } catch (error) {
      console.error('LiveKit token generation failed:', error);
      return json({
        error: 'LiveKit token generation failed.',
        detail: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  },
};
