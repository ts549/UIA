import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/api/lookup' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => (body += chunk));
            req.on('end', () => {
              const { fingerprint } = JSON.parse(body);
              const fakeResponse = {
                fingerprint,
                file: 'src/components/Button.tsx',
                lines: [10, 30],
                component: 'Button',
              };
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(fakeResponse));
            });
          } else {
            next();
          }
        });
      }
    } as Plugin
  ]
})
