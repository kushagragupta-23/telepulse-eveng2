import { defineConfig } from 'vite'
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
