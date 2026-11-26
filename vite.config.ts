import { defineConfig } from 'vite'
import { createReadStream, existsSync } from 'node:fs'
import { handleApiRequest } from './server/api'

export default defineConfig({
  build: { target: 'es2022' },
  server: {
    port: 5173,
    host: true,
    cors: true,
  },
  plugins: [
    {
      name: 'telepulse-backend-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/demo.mp4' && existsSync('docs/telepulse-demo.mp4')) {
            res.setHeader('Content-Type', 'video/mp4')
            createReadStream('docs/telepulse-demo.mp4').pipe(res)
            return
          }
          if (req.url && req.url.startsWith('/api/')) {
            const handled = await handleApiRequest(req, res)
            if (handled) return
          }
          next()
        })
      },
    },
  ],
})
