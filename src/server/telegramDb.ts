import fs from 'fs';
import path from 'path';

export interface TelegramGalleryItem {
  message_id: number;
  file_id: string;
  file_unique_id?: string;
  width?: number;
  height?: number;
}

export interface TelegramMediaRecord {
  channel_id: string;
  message_id: number;
  video_file_id?: string;
  file_unique_id?: string;
  duration?: number;
  width?: number;
  height?: number;
  file_size?: number;
  mime_type?: string;
  media_group_id?: string;
  gallery?: TelegramGalleryItem[];
}

export interface TelegramVideoIndexRecord {
  code: string;
  telegram: TelegramMediaRecord;
  metadataFound: boolean;
  indexed_at: string;
  updated_at?: string;
}

export class TelegramDb {
  private static readonly DB_DIR = path.resolve(process.cwd(), 'telegram-db');
  private static readonly VIDEOS_DIR = path.resolve(process.cwd(), 'telegram-db', 'videos');
  private static readonly MEDIA_GROUPS_FILE = path.resolve(process.cwd(), 'telegram-db', 'media_groups.json');
  private static readonly MESSAGES_FILE = path.resolve(process.cwd(), 'telegram-db', 'messages.json');

  private static initialized = false;

  // Persistent in-memory cache for media_group_id -> code
  private static mediaGroupMap = new Map<string, string>();

  // Persistent in-memory index for processed messages (channel_id:message_id)
  private static messageSet = new Set<string>();

  /**
   * Initialize directories and persistent mappings on boot
   */
  static async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.promises.mkdir(this.VIDEOS_DIR, { recursive: true });

      // 1. Load persistent media group associations
      try {
        const mgRaw = await fs.promises.readFile(this.MEDIA_GROUPS_FILE, 'utf-8');
        const parsed = JSON.parse(mgRaw);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            this.mediaGroupMap.set(k, String(v));
          }
        }
      } catch {
        // media_groups.json does not exist yet
      }

      // 2. Load persistent processed messages index
      try {
        const msgRaw = await fs.promises.readFile(this.MESSAGES_FILE, 'utf-8');
        const parsed = JSON.parse(msgRaw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            this.messageSet.add(String(item));
          }
        }
      } catch {
        // Build initial messages set from existing video files on disk (only once on fresh index)
        try {
          const files = await fs.promises.readdir(this.VIDEOS_DIR);
          for (const file of files.filter((f) => f.endsWith('.json') && !f.includes('.tmp.'))) {
            try {
              const content = await fs.promises.readFile(path.join(this.VIDEOS_DIR, file), 'utf-8');
              const rec = JSON.parse(content);
              if (rec?.telegram?.channel_id && rec?.telegram?.message_id) {
                this.messageSet.add(`${rec.telegram.channel_id}:${rec.telegram.message_id}`);
              }
              if (rec?.telegram?.gallery && Array.isArray(rec.telegram.gallery)) {
                for (const g of rec.telegram.gallery) {
                  if (g.message_id && rec.telegram.channel_id) {
                    this.messageSet.add(`${rec.telegram.channel_id}:${g.message_id}`);
                  }
                }
              }
            } catch {}
          }
          if (this.messageSet.size > 0) {
            await this.atomicWriteJson(this.MESSAGES_FILE, Array.from(this.messageSet));
          }
        } catch {}
      }

      this.initialized = true;
    } catch (e: any) {
      console.error('Failed to initialize telegram-db:', e.message);
    }
  }

  /**
   * Persistently record media_group_id -> JAV code association (Section 8 & Requirement 7)
   */
  static async setMediaGroupCode(mediaGroupId: string, code: string): Promise<void> {
    if (!mediaGroupId || !code) return;
    await this.init();

    const normalizedCode = code.toUpperCase();
    this.mediaGroupMap.set(String(mediaGroupId), normalizedCode);

    try {
      const obj: Record<string, string> = {};
      for (const [k, v] of this.mediaGroupMap.entries()) {
        obj[k] = v;
      }
      await this.atomicWriteJson(this.MEDIA_GROUPS_FILE, obj);
    } catch (e: any) {
      console.warn('Failed to persist media_groups.json:', e.message);
    }
  }

  /**
   * Retrieve JAV code registered for a media_group_id
   */
  static getCodeByMediaGroup(mediaGroupId: string): string | undefined {
    if (!mediaGroupId) return undefined;
    return this.mediaGroupMap.get(String(mediaGroupId));
  }

  /**
   * Record processed message in index and persist
   */
  private static async recordMessage(channelId: string, messageId: number): Promise<void> {
    if (!channelId || !messageId) return;
    const key = `${channelId}:${messageId}`;
    if (!this.messageSet.has(key)) {
      this.messageSet.add(key);
      try {
        await this.atomicWriteJson(this.MESSAGES_FILE, Array.from(this.messageSet));
      } catch (e: any) {
        console.warn('Failed to persist messages.json index:', e.message);
      }
    }
  }

  /**
   * O(1) message existence check without reading every file on disk (Requirement 8)
   */
  static async hasMessage(channelId: string, messageId: number): Promise<boolean> {
    await this.init();
    const key = `${channelId}:${messageId}`;
    return this.messageSet.has(key);
  }

  /**
   * Sanitized file path for video code
   */
  private static getFilePath(code: string): string {
    const safeCode = code.toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    return path.join(this.VIDEOS_DIR, `${safeCode}.json`);
  }

  /**
   * Atomic file writer using staging temporary file + atomic rename
   */
  private static async atomicWriteJson(filePath: string, data: any): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;
    const json = JSON.stringify(data, null, 2);
    try {
      await fs.promises.writeFile(tempPath, json, 'utf-8');
      await fs.promises.rename(tempPath, filePath);
    } catch {
      await fs.promises.writeFile(filePath, json, 'utf-8');
      try {
        await fs.promises.unlink(tempPath);
      } catch {}
    }
  }

  /**
   * Save or update video record in telegram-db/videos/<CODE>.json
   * Note: Stores only Telegram index/media information (Requirement 3 & 4)
   */
  static async saveVideo(record: TelegramVideoIndexRecord): Promise<void> {
    await this.init();
    const filePath = this.getFilePath(record.code);

    // If existing, preserve or merge gallery items
    try {
      const existing = await this.getVideo(record.code);
      if (existing) {
        const existingGallery = existing.telegram.gallery || [];
        const incomingGallery = record.telegram.gallery || [];
        const galleryMap = new Map<string, any>();

        for (const item of [...existingGallery, ...incomingGallery]) {
          galleryMap.set(item.file_id, item);
        }

        record.telegram.gallery = Array.from(galleryMap.values());
        record.indexed_at = existing.indexed_at; // preserve original indexed timestamp
        record.updated_at = new Date().toISOString();
      }
    } catch {}

    // Atomic write to disk
    await this.atomicWriteJson(filePath, record);

    // Index message ID for O(1) duplicate checks
    if (record.telegram.channel_id && record.telegram.message_id) {
      await this.recordMessage(record.telegram.channel_id, record.telegram.message_id);
    }
  }

  /**
   * Append a gallery photo to an existing or draft video record
   */
  static async addGalleryPhoto(
    code: string,
    photo: TelegramGalleryItem,
    channelId: string,
    metadataFound = true
  ): Promise<TelegramVideoIndexRecord> {
    await this.init();
    const existing = await this.getVideo(code);

    if (existing) {
      existing.telegram.gallery = existing.telegram.gallery || [];
      const alreadyPresent = existing.telegram.gallery.some(
        (p) => p.message_id === photo.message_id || p.file_id === photo.file_id
      );
      if (!alreadyPresent) {
        existing.telegram.gallery.push(photo);
        existing.updated_at = new Date().toISOString();
        await this.atomicWriteJson(this.getFilePath(code), existing);
      }

      if (channelId && photo.message_id) {
        await this.recordMessage(channelId, photo.message_id);
      }
      return existing;
    }

    // Create a draft record if photo arrives before video
    const draft: TelegramVideoIndexRecord = {
      code,
      telegram: {
        channel_id: channelId,
        message_id: 0,
        gallery: [photo],
      },
      metadataFound,
      indexed_at: new Date().toISOString(),
    };
    await this.atomicWriteJson(this.getFilePath(code), draft);

    if (channelId && photo.message_id) {
      await this.recordMessage(channelId, photo.message_id);
    }
    return draft;
  }

  /**
   * O(1) single video retrieval by code (Requirement 8)
   */
  static async getVideo(code: string): Promise<TelegramVideoIndexRecord | null> {
    await this.init();
    const filePath = this.getFilePath(code);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as TelegramVideoIndexRecord;
    } catch {
      return null;
    }
  }

  /**
   * List all indexed records in telegram-db/videos (skips corrupt files and temp files)
   */
  static async getAllVideos(): Promise<TelegramVideoIndexRecord[]> {
    await this.init();
    try {
      const files = await fs.promises.readdir(this.VIDEOS_DIR);
      const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.includes('.tmp.'));

      const records: TelegramVideoIndexRecord[] = [];
      for (const file of jsonFiles) {
        try {
          const content = await fs.promises.readFile(path.join(this.VIDEOS_DIR, file), 'utf-8');
          if (!content.trim()) continue;
          const parsed = JSON.parse(content);
          if (parsed && parsed.code) {
            records.push(parsed);
          }
        } catch (e: any) {
          console.warn(`Skipping unparseable or corrupt JSON record ${file}:`, e.message);
        }
      }

      // Sort by indexed_at descending
      return records.sort((a, b) => (b.indexed_at || '').localeCompare(a.indexed_at || ''));
    } catch {
      return [];
    }
  }

  /**
   * Total number of indexed videos
   */
  static async getCount(): Promise<number> {
    const all = await this.getAllVideos();
    return all.length;
  }
}
