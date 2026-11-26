import { createServer } from 'node:http'
import { handleApiRequest } from './api'

const port = Number(process.env.PORT || 8787)

const server = createServer(async (req, res) => {
  const handled = await handleApiRequest(req, res)
  if (!handled) {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        service: 'TelePulse HUD Backend Proxy',
        status: 'online',
        endpoints: [
          'GET /api/state',
          'POST /api/telegram/reply',
          'POST /api/telegram/inject',
          'POST /api/trade/paper',
          'POST /api/voice/intent',
          'POST /api/pairing/configure',
        ],
      }),
    )
  }
})

server.listen(port, () => {
  console.log(`TelePulse HUD Backend Proxy listening on http://localhost:${port}`)
})
