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
    
    // Automatically start Telegram Bot Long-Polling by default
    if (process.env.TELEGRAM_BOT_TOKEN) {
      TelegramPollingService.start().then(r => {
        console.log(`[AutoPull] Telegram Bot Long Polling active: ${r.message}`);
      }).catch(err => {
        console.warn(`[AutoPull] Polling init notice: ${err.message}`);
      });
    }

    // Automatically start Historical Channel Indexer only when all required
    // MTProto credentials and the target channel are configured.
    const historyIndexerDisabled = process.env.TELEGRAM_HISTORY_INDEXER === 'false';
    const hasHistoryCredentials = Boolean(
      process.env.TELEGRAM_API_ID &&
      process.env.TELEGRAM_API_HASH &&
      process.env.TELEGRAM_STRING_SESSION &&
      process.env.TELEGRAM_CHANNEL_ID
    );

    if (!historyIndexerDisabled && hasHistoryCredentials) {
      setTimeout(() => {
        TelegramHistoryIndexer.start().then(r => {
          console.log(`[AutoPull] Historical Telegram indexer auto-started: ${r.message}`);
        }).catch(err => {
          console.warn(`[AutoPull] Historical indexer startup notice: ${err.message}`);
        });
      }, 2000);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
