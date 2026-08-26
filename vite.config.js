import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { AccessToken } from 'livekit-server-sdk'

function livekitDevApi() {
  return {
    name: 'webinterndev-livekit-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/livekit-token', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        const send = (status, body) => {
          res.statusCode = status
          res.end(JSON.stringify(body))
        }
        if (req.method === 'OPTIONS') return send(204, {})
        if (req.method === 'GET') {
          return send(200, {
            ok: true,
            configured: Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
            urlConfigured: Boolean(process.env.LIVEKIT_URL),
            apiKeyConfigured: Boolean(process.env.LIVEKIT_API_KEY),
            apiSecretConfigured: Boolean(process.env.LIVEKIT_API_SECRET),
          })
        }
        if (req.method !== 'POST') return send(405, { error: 'Method not allowed' })

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const roomName = String(body.roomName ?? '').trim()
          const participantName = String(body.participantName ?? '').trim()
          const role = String(body.role ?? '').trim().toLowerCase()
          if (!roomName || !participantName || !['admin', 'host', 'user'].includes(role)) {
            return send(400, { error: 'roomName, participantName and role (admin, host or user) are required.' })
          }
          const apiKey = process.env.LIVEKIT_API_KEY?.trim()
          const apiSecret = process.env.LIVEKIT_API_SECRET?.trim()
          const livekitUrl = process.env.LIVEKIT_URL?.trim()
          if (!apiKey || !apiSecret || !livekitUrl) {
            return send(500, {
              error: 'LiveKit environment variables are missing locally. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to .env.local.',
              configured: { url: Boolean(livekitUrl), apiKey: Boolean(apiKey), apiSecret: Boolean(apiSecret) }
            })
          }
          const identityBase = participantName.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 48) || 'participant'
          const identity = `${role}-${identityBase}-${crypto.randomUUID().slice(0, 8)}`
          const token = new AccessToken(apiKey, apiSecret, {
            identity, name: participantName, metadata: JSON.stringify({ role }), ttl: '2h'
          })
          token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true })
          return send(200, { token: await token.toJwt(), url: livekitUrl })
        } catch (error) {
          console.error('Local LiveKit token generation failed:', error)
          return send(500, { error: 'LiveKit token generation failed locally.', detail: error instanceof Error ? error.message : String(error) })
        }
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)
  return {
    plugins: [react(), livekitDevApi()],
    build: { sourcemap: false, target: 'es2020' }
  }
})
