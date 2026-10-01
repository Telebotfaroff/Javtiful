import { TelegramIndexer } from './telegramIndexer.ts';
import { TelegramBotService } from './telegramBotService.ts';

interface PollingStatus {
  active: boolean;
  lastPollTime: string | null;
  lastSuccessTime: string | null;
  processedCount: number;
  lastError: string | null;
  consecutiveErrors: number;
}

export class TelegramPollingService {
  private static isRunning = false;
  private static offset = 0;
  private static abortController: AbortController | null = null;
  private static processedCount = 0;
  private static lastPollTime: string | null = null;
  private static lastSuccessTime: string | null = null;
  private static lastError: string | null = null;
  private static consecutiveErrors = 0;

  static getStatus(): PollingStatus {
    return {
      active: this.isRunning,
      lastPollTime: this.lastPollTime,
      lastSuccessTime: this.lastSuccessTime,
      processedCount: this.processedCount,
      lastError: this.lastError,
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  /**
   * Starts Telegram long polling loop
   */
  static async start(): Promise<{ ok: boolean; message: string }> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return { ok: false, message: 'TELEGRAM_BOT_TOKEN is not configured in .env' };
    }

    if (this.isRunning) {
      return { ok: true, message: 'Long polling is already active' };
    }

    // Long polling and webhooks are mutually exclusive. Always clear any old webhook first.
    this.isRunning = true;
    this.abortController = new AbortController();

    // 1. Clear any active webhook so Telegram routes updates to getUpdates
    try {
      await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
      console.log('Telegram webhook removed. Initiating long-polling listener...');
    } catch (e: any) {
      console.warn('Failed to delete webhook prior to polling:', e.message);
    }

    // 2. Start asynchronous polling loop in background
    this.pollLoop(token).catch(err => {
      console.error('Fatal long-polling loop error:', err);
      this.isRunning = false;
    });

    return { ok: true, message: 'Long-polling started successfully' };
  }

  /**
   * Stops the long polling loop
   */
  static stop(): { ok: boolean; message: string } {
    if (!this.isRunning) {
      return { ok: true, message: 'Long polling is already stopped' };
    }
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    return { ok: true, message: 'Long-polling stopped' };
  }

  /**
   * Continuous background getUpdates loop
   */
  private static async pollLoop(token: string): Promise<void> {
    while (this.isRunning) {
      this.lastPollTime = new Date().toISOString();
      try {
        const allowedUpdates = encodeURIComponent(JSON.stringify(['message', 'channel_post']));
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.offset}&timeout=20&allowed_updates=${allowedUpdates}`;
        const res = await fetch(url, {
          signal: this.abortController?.signal,
        });

        if (!res.ok) {
          throw new Error(`Telegram API responded with HTTP ${res.status}`);
        }

        const data: any = await res.json();
        if (!data.ok) {
          throw new Error(data.description || 'Telegram getUpdates returned ok: false');
        }

        this.consecutiveErrors = 0;
        this.lastSuccessTime = new Date().toISOString();
        this.lastError = null;

        const updates: any[] = data.result || [];
        for (const update of updates) {
          if (update.update_id >= this.offset) {
            this.offset = update.update_id + 1;
          }

          try {
            await this.processSingleUpdate(update);
            this.processedCount++;
          } catch (e: any) {
            console.error(`Error processing Telegram update #${update.update_id}:`, e);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || !this.isRunning) {
          break;
        }
        this.consecutiveErrors++;
        this.lastError = err.message || 'Unknown network error';
        console.warn(`Telegram polling error (${this.consecutiveErrors}):`, this.lastError);

        // Exponential backoff up to 10 seconds on error
        const delay = Math.min(1000 * Math.pow(2, this.consecutiveErrors - 1), 10000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  /**
   * Process individual update identical to webhook handler
   */
  private static async processSingleUpdate(update: any): Promise<void> {
    if (update.channel_post) {
      const configuredChannel = process.env.TELEGRAM_CHANNEL_ID?.trim();
      const postChannel = String(update.channel_post.chat?.id || '');
      if (configuredChannel && postChannel !== configuredChannel) {
        console.warn(`Ignoring channel post from ${postChannel}; expected ${configuredChannel}.`);
        return;
      }
      await TelegramIndexer.processPost(update.channel_post);
      return;
    }

    if (update.message?.chat?.type === 'private' || !update.message?.chat?.type) {
      await TelegramBotService.handlePrivateMessage(update.message);
      return;
    }

    if (update.message?.video || update.message?.photo) {
      await TelegramIndexer.processPost(update.message);
      return;
    }

    await TelegramIndexer.processUpdate(update);
  }
}
