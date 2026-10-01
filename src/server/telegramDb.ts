import { Pool } from '@neondatabase/serverless';

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
  indexed_at: string;
  updated_at?: string;
}

export interface PendingMediaGroup {
  media_group_id: string;
  channel_id: string;
  photos: TelegramGalleryItem[];
  created_at: string;
  updated_at: string;
}

export class TelegramDb {
  private static pool: Pool | null = null;

  private static db() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not configured');
    if (!this.pool) this.pool = new Pool({ connectionString: url });
    return this.pool;
  }

  private static normalizeCode(code: string) {
    return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  }

  static async init() {
    await this.db().query('SELECT 1');
  }

  static async setMediaGroupCode(mediaGroupId: string, code: string) {
    await this.db().query(
      'INSERT INTO telegram_media_groups (media_group_id, code) VALUES ($1, $2) ON CONFLICT (media_group_id) DO UPDATE SET code = EXCLUDED.code, updated_at = NOW()',
      [String(mediaGroupId), this.normalizeCode(code)]
    );
  }

  static async getCodeByMediaGroup(mediaGroupId: string) {
    const r = await this.db().query(
      'SELECT code FROM telegram_media_groups WHERE media_group_id = $1 LIMIT 1',
      [String(mediaGroupId)]
    );
    return r.rows[0]?.code as string | undefined;
  }

  static async addPendingMediaGroup(mediaGroupId: string, item: TelegramGalleryItem & { channel_id: string }) {
    const current = await this.getPendingMediaGroup(mediaGroupId);
    const photos = current?.photos || [];
    if (!photos.some(p => p.message_id === item.message_id || p.file_id === item.file_id)) {
      photos.push({
        message_id: item.message_id,
        file_id: item.file_id,
        file_unique_id: item.file_unique_id,
        width: item.width,
        height: item.height,
      });
    }

    await this.db().query(
      `INSERT INTO telegram_pending_groups (media_group_id, channel_id, photos)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (media_group_id)
       DO UPDATE SET photos = EXCLUDED.photos, updated_at = NOW()`,
      [String(mediaGroupId), item.channel_id, JSON.stringify(photos)]
    );
  }

  static async getPendingMediaGroup(mediaGroupId: string) {
    const r = await this.db().query(
      'SELECT media_group_id, channel_id, photos, created_at, updated_at FROM telegram_pending_groups WHERE media_group_id = $1 LIMIT 1',
      [String(mediaGroupId)]
    );
    if (!r.rows[0]) return null;
    const row: any = r.rows[0];
    return {
      media_group_id: String(row.media_group_id),
      channel_id: String(row.channel_id),
      photos: Array.isArray(row.photos) ? row.photos : [],
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    } as PendingMediaGroup;
  }

  static async clearPendingMediaGroup(mediaGroupId: string) {
    await this.db().query(
      'DELETE FROM telegram_pending_groups WHERE media_group_id = $1',
      [String(mediaGroupId)]
    );
  }

  static async hasMessage(channelId: string, messageId: number) {
    const r = await this.db().query(
      'SELECT 1 FROM telegram_messages WHERE channel_id = $1 AND message_id = $2 LIMIT 1',
      [channelId, messageId]
    );
    return (r.rowCount || 0) > 0;
  }

  private static async recordMessage(channelId: string, messageId: number) {
    await this.db().query(
      'INSERT INTO telegram_messages (channel_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [channelId, messageId]
    );
  }

  static async saveVideo(record: TelegramVideoIndexRecord) {
    const code = this.normalizeCode(record.code);
    const existing = await this.getVideo(code);
    const gallery = new Map<string, TelegramGalleryItem>();
    for (const item of existing?.telegram.gallery || []) gallery.set(item.file_id, item);
    for (const item of record.telegram.gallery || []) gallery.set(item.file_id, item);

    const indexedAt = existing?.indexed_at || record.indexed_at;

    await this.db().query(
      `INSERT INTO telegram_videos
       (code, channel_id, message_id, video_file_id, file_unique_id, duration, width, height, file_size, mime_type, media_group_id, indexed_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       ON CONFLICT (code) DO UPDATE SET
       channel_id=EXCLUDED.channel_id, message_id=EXCLUDED.message_id, video_file_id=EXCLUDED.video_file_id,
       file_unique_id=EXCLUDED.file_unique_id, duration=EXCLUDED.duration, width=EXCLUDED.width,
       height=EXCLUDED.height, file_size=EXCLUDED.file_size, mime_type=EXCLUDED.mime_type,
       media_group_id=EXCLUDED.media_group_id, updated_at=NOW()`,
      [
        code, record.telegram.channel_id, record.telegram.message_id,
        record.telegram.video_file_id || null, record.telegram.file_unique_id || null,
        record.telegram.duration ?? null, record.telegram.width ?? null, record.telegram.height ?? null,
        record.telegram.file_size ?? null, record.telegram.mime_type || 'video/mp4',
        record.telegram.media_group_id || null, indexedAt
      ]
    );

    for (const item of gallery.values()) {
      await this.db().query(
        `INSERT INTO telegram_gallery (code, message_id, file_id, file_unique_id, width, height)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (code,message_id) DO UPDATE SET file_id=EXCLUDED.file_id,
         file_unique_id=EXCLUDED.file_unique_id, width=EXCLUDED.width, height=EXCLUDED.height`,
        [code, item.message_id, item.file_id, item.file_unique_id || null, item.width ?? null, item.height ?? null]
      );
      await this.recordMessage(record.telegram.channel_id, item.message_id);
    }

    await this.recordMessage(record.telegram.channel_id, record.telegram.message_id);

    await this.db().query(
      'INSERT INTO telegram_recent (code, indexed_at) VALUES ($1,$2) ON CONFLICT (code) DO UPDATE SET indexed_at=EXCLUDED.indexed_at',
      [code, indexedAt]
    );
  }

  static async addGalleryPhoto(code: string, photo: TelegramGalleryItem, channelId: string): Promise<TelegramVideoIndexRecord> {
    const normalized = this.normalizeCode(code);
    const existing = await this.getVideo(normalized);
    if (!existing) {
      return {
        code: normalized,
        telegram: { channel_id: channelId, message_id: 0, gallery: [photo] },
        indexed_at: new Date().toISOString(),
      };
    }

    await this.db().query(
      `INSERT INTO telegram_gallery (code, message_id, file_id, file_unique_id, width, height)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (code,message_id) DO UPDATE SET file_id=EXCLUDED.file_id,
       file_unique_id=EXCLUDED.file_unique_id, width=EXCLUDED.width, height=EXCLUDED.height`,
      [normalized, photo.message_id, photo.file_id, photo.file_unique_id || null, photo.width ?? null, photo.height ?? null]
    );
    await this.recordMessage(channelId, photo.message_id);
    return (await this.getVideo(normalized)) || existing;
  }

  static async getVideo(code: string) {
    const normalized = this.normalizeCode(code);
    const r = await this.db().query(
      'SELECT code,channel_id,message_id,video_file_id,file_unique_id,duration,width,height,file_size,mime_type,media_group_id,indexed_at,updated_at FROM telegram_videos WHERE code=$1 LIMIT 1',
      [normalized]
    );
    if (!r.rows[0]) return null;

    const g = await this.db().query(
      'SELECT message_id,file_id,file_unique_id,width,height FROM telegram_gallery WHERE code=$1 ORDER BY id ASC',
      [normalized]
    );
    const row: any = r.rows[0];

    return {
      code: String(row.code),
      telegram: {
        channel_id: String(row.channel_id),
        message_id: Number(row.message_id),
        video_file_id: row.video_file_id || undefined,
        file_unique_id: row.file_unique_id || undefined,
        duration: row.duration == null ? undefined : Number(row.duration),
        width: row.width == null ? undefined : Number(row.width),
        height: row.height == null ? undefined : Number(row.height),
        file_size: row.file_size == null ? undefined : Number(row.file_size),
        mime_type: row.mime_type || undefined,
        media_group_id: row.media_group_id || undefined,
        gallery: g.rows.map((x: any) => ({
          message_id: Number(x.message_id),
          file_id: String(x.file_id),
          file_unique_id: x.file_unique_id || undefined,
          width: x.width == null ? undefined : Number(x.width),
          height: x.height == null ? undefined : Number(x.height),
        })),
      },
      indexed_at: new Date(row.indexed_at).toISOString(),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    } as TelegramVideoIndexRecord;
  }

  static async getRecentCodes(limit = 24) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const r = await this.db().query(
      'SELECT code FROM telegram_recent ORDER BY indexed_at DESC LIMIT $1',
      [safeLimit]
    );
    return r.rows.map((x: any) => String(x.code));
  }

  static async getCount(): Promise<number | null> {
    const r = await this.db().query('SELECT COUNT(*)::bigint AS total FROM telegram_videos');
    return r.rows[0]?.total == null ? null : Number(r.rows[0].total);
  }

  static clearCache() {}
  static async shutdown() { await this.pool?.end(); this.pool = null; }
}
