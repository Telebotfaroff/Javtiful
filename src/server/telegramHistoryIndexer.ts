import { TelegramClient } from 'teleproto';
import { StringSession } from 'teleproto/sessions';
import { TelegramDb } from './telegramDb.ts';
import { detectJavCode } from './codeDetector.ts';

interface HistoryStatus {
  active: boolean;
  configured: boolean;
  processed: number;
  indexed: number;
  skipped: number;
  batches: number;
  lastMessageId: number | null;
  lastBatchSize: number;
  lastError: string | null;
}

export class TelegramHistoryIndexer {
  private static running = false;
  private static client: TelegramClient | null = null;
  private static processed = 0;
  private static indexed = 0;
  private static skipped = 0;
  private static batches = 0;
  private static lastMessageId: number | null = null;
  private static lastBatchSize = 0;
  private static lastError: string | null = null;

  static getStatus(): HistoryStatus {
    const configured = Boolean(
      process.env.TELEGRAM_API_ID &&
      process.env.TELEGRAM_API_HASH &&
      process.env.TELEGRAM_STRING_SESSION &&
      process.env.TELEGRAM_CHANNEL_ID
    );

    return {
      active: this.running,
      configured,
      processed: this.processed,
      indexed: this.indexed,
      skipped: this.skipped,
      batches: this.batches,
      lastMessageId: this.lastMessageId,
      lastBatchSize: this.lastBatchSize,
      lastError: this.lastError,
    };
  }

  static async start(): Promise<{ ok: boolean; message: string }> {
    if (this.running) {
      return { ok: true, message: 'Historical indexer is already running' };
    }

    const apiId = Number(process.env.TELEGRAM_API_ID || 0);
    const apiHash = process.env.TELEGRAM_API_HASH || '';
    const session = process.env.TELEGRAM_STRING_SESSION || '';
    const channelId = process.env.TELEGRAM_CHANNEL_ID || '';

    if (!apiId || !apiHash || !session || !channelId) {
      return {
        ok: false,
        message: 'Historical indexer requires TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_STRING_SESSION and TELEGRAM_CHANNEL_ID',
      };
    }

    this.running = true;
    this.lastError = null;

    try {
      this.client = new TelegramClient(
        new StringSession(session),
        apiId,
        apiHash,
        { connectionRetries: 5 }
      );

      await this.client.connect();

      const channel = await this.client.getEntity(channelId);
      const batchSize = Math.min(Math.max(Number(process.env.TELEGRAM_HISTORY_BATCH_SIZE || 100), 1), 100);
      const delayMs = Math.max(Number(process.env.TELEGRAM_HISTORY_DELAY_MS || 1000), 0);

      console.log(
        `Telegram historical indexer started: batches of ${batchSize}, delay ${delayMs}ms`
      );

      const savedState = await TelegramDb.getHistoryState(String(channelId));
      let offsetId = savedState.completed ? 0 : savedState.nextOffsetId;
      let exhausted = savedState.completed;

      while (this.running && !exhausted) {
        const batch: any[] = [];

        for await (const message of this.client.iterMessages(channel, {
          limit: batchSize,
          offsetId,
        })) {
          batch.push(message);
        }

        this.lastBatchSize = batch.length;
        this.batches++;

        if (batch.length === 0) {
          exhausted = true;
          break;
        }

        // Telegram returns newest -> oldest. Keep the oldest ID so the next
        // request continues strictly before this batch.
        const oldestId = Math.min(
          ...batch
            .map(m => Number(m.id || 0))
            .filter(Boolean)
        );

        if (!oldestId || oldestId === offsetId) {
          exhausted = true;
          break;
        }

        const groupCodes = new Map<string, string>();
        for (const message of batch) {
          const groupedId = message.groupedId ? String(message.groupedId) : '';
          const detected = detectJavCode(String(message.message || '').trim());
          if (groupedId && detected?.canonical) {
            groupCodes.set(groupedId, detected.canonical);
          }
        }

        for (const message of batch) {
          if (!this.running) break;

          this.processed++;
          this.lastMessageId = Number(message.id || 0);

          try {
            const groupedId = message.groupedId ? String(message.groupedId) : '';
            const result = await this.indexHistoricalMessage(
              message,
              String(channelId),
              groupedId ? groupCodes.get(groupedId) : undefined
            );
            if (result) this.indexed++;
            else this.skipped++;
          } catch (error: any) {
            this.skipped++;
            this.lastError = error?.message || 'Unknown indexing error';
            console.error(
              `Historical index error for message ${message.id}:`,
              error?.message || error
            );
          }
        }

        offsetId = oldestId;
        await TelegramDb.setHistoryState(String(channelId), offsetId, false);

        console.log(
          `Historical index batch #${this.batches}: ${batch.length} messages processed, next offset ${offsetId}`
        );

        if (batch.length < batchSize) {
          exhausted = true;
          await TelegramDb.setHistoryState(String(channelId), offsetId, true);
          break;
        }

        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      console.log(
        `Historical indexing finished. Processed=${this.processed}, indexed=${this.indexed}, skipped=${this.skipped}`
      );

      return {
        ok: true,
        message: exhausted
          ? 'Historical indexing completed'
          : 'Historical indexing stopped',
      };
    } catch (error: any) {
      this.lastError = error?.message || 'Historical indexer failed';
      console.error('Historical indexer failed:', error);
      return { ok: false, message: this.lastError };
    } finally {
      this.running = false;
      try {
        await this.client?.disconnect();
      } catch {}
      this.client = null;
    }
  }

  static stop() {
    this.running = false;
    return { ok: true, message: 'Historical indexer stop requested' };
  }

  private static async indexHistoricalMessage(message: any, channelId: string, groupedCode?: string): Promise<boolean> {
    const messageId = Number(message.id || 0);
    if (!messageId) return false;

    const caption = String(message.message || '').trim();
    const mediaGroupId = message.groupedId ? String(message.groupedId) : undefined;

    const detected = detectJavCode(caption);
    const code = detected?.canonical || groupedCode;

    const media = this.detectMedia(message);
    if (!media) return false;

    if (!code) {
      return false;
    }

    await TelegramDb.addHistoricalMessage({
      code,
      channel_id: channelId,
      message_id: messageId,
      media_type: media.type,
      media_group_id: mediaGroupId,
      caption,
      duration: media.duration,
      width: media.width,
      height: media.height,
      file_size: media.file_size,
      mime_type: media.mime_type,
    });

    return true;
  }

  private static detectMedia(message: any): {
    type: 'image' | 'video';
    duration?: number;
    width?: number;
    height?: number;
    file_size?: number;
    mime_type?: string;
  } | null {
    if (message.photo) {
      return { type: 'image' };
    }

    if (message.video) {
      const video = message.video;
      return {
        type: 'video',
        duration: Number(video.duration || 0) || undefined,
        width: Number(video.w || video.width || 0) || undefined,
        height: Number(video.h || video.height || 0) || undefined,
        file_size: Number(video.size || 0) || undefined,
        mime_type: video.mimeType || 'video/mp4',
      };
    }

    const document = message.document;
    if (document) {
      const mime = String(document.mimeType || '').toLowerCase();
      const isVideo =
        mime.startsWith('video/') ||
        Array.isArray(document.attributes) &&
          document.attributes.some((attr: any) =>
            String(attr.className || '').toLowerCase().includes('documentattributevideo')
          );

      if (isVideo) {
        const videoAttr = document.attributes?.find((attr: any) =>
          String(attr.className || '').toLowerCase().includes('documentattributevideo')
        );

        return {
          type: 'video',
          duration: Number(videoAttr?.duration || 0) || undefined,
          width: Number(videoAttr?.w || 0) || undefined,
          height: Number(videoAttr?.h || 0) || undefined,
          file_size: Number(document.size || 0) || undefined,
          mime_type: mime || 'video/mp4',
        };
      }
    }

    return null;
  }
}
