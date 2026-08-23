import { AccessToken } from 'livekit-server-sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomName, participantName, role } = req.body || {};
    const cleanRoom = String(roomName || '').trim();
    const cleanName = String(participantName || '').trim();
    const cleanRole = String(role || '').trim().toLowerCase();

    if (!cleanRoom || !cleanName || !['host', 'user'].includes(cleanRole)) {
      return res.status(400).json({ error: 'roomName, participantName and a valid role are required.' });
    }

    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.LIVEKIT_URL) {
      return res.status(500).json({ error: 'LiveKit environment variables are not configured.' });
    }

    const identity = `${cleanRole}-${cleanName.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48)}-${Math.random().toString(36).slice(2, 8)}`;
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity,
      name: cleanName,
      metadata: JSON.stringify({ role: cleanRole })
    });

    token.addGrant({
      roomJoin: true,
      room: cleanRoom,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: cleanRole === 'host' ? ['camera', 'microphone', 'screen_share'] : ['camera', 'microphone']
    });

    return res.status(200).json({ token: await token.toJwt(), url: process.env.LIVEKIT_URL });
  } catch (error) {
    console.error('LiveKit token error:', error);
    return res.status(500).json({ error: 'Unable to create LiveKit token.' });
  }
}
