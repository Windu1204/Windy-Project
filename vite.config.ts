import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), {
    name: 'private-local-preview',
    // Private source records are accessible only through the local development server.
    // This middleware is never included in a production build.
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/__local-data\/(ijr|regional|corporate|piloting)$/);
        if (!match) return next();
        try {
          const contents = await readFile(resolve(`private/seed/${match[1]}.json`), 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(contents);
        } catch { res.statusCode = 404; res.end('Private source data not available.'); }
      });
    },
  }],
  build: { sourcemap: false },
});
