import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleBackendApiRequest } from './src/server/apiRouter.ts';

import { TelegramPollingService } from './src/server/telegramPollingService.ts';
import { TelegramDb } from './src/server/telegramDb.ts';
import { TelegramHistoryIndexer } from './src/server/telegramHistoryIndexer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Initialize Neon before any Telegram update can be processed.
  if (process.env.DATABASE_URL) {
    await TelegramDb.init();
    console.log('Neon Telegram index tables initialized.');
  } else {
    console.warn('DATABASE_URL is not configured; Telegram indexing will not work.');
  }

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProd = process.env.NODE_ENV === 'production';

  // Mount backend API router for /api routes
  app.use((req, res, next) => {
    if (req.url && req.url.startsWith('/api')) {
      const handled = handleBackendApiRequest(req, res);
      if (handled) return;
    }
    next();
  });

  if (!isProd) {
    // Development mode: attach Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve static files and index.html
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
    
    // Automatically start Telegram Long-Polling if bot token is present
    if (process.env.TELEGRAM_BOT_TOKEN) {
      TelegramPollingService.start().then(r => {
        console.log(`Telegram Bot Long Polling initialized: ${r.message}`);
      }).catch(err => {
        console.warn(`Failed to initialize Telegram Long Polling: ${err.message}`);
      });

      // Historical indexer runs automatically in batches of 100 when enabled.
      if (process.env.TELEGRAM_HISTORY_INDEXER === 'true') {
        setTimeout(() => {
          TelegramHistoryIndexer.start().then(r => {
            console.log(`Telegram historical indexer: ${r.message}`);
          }).catch(err => {
            console.warn(`Failed to start historical Telegram indexer: ${err.message}`);
          });
        }, 3000);
      }
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
