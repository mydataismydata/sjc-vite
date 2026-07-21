import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// The admin app is served by the Node server at /app/. `npm run build` drops
// the bundle into server/public/app. During development, `npm run dev:web`
// serves it with hot reload and proxies API + public routes to the server.
export default defineConfig({
  root,
  base: '/app/',
  plugins: [react()],
  build: {
    outDir: path.resolve(root, '../server/public/app'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/o': 'http://localhost:3000',
    },
  },
});
