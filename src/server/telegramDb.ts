import { Pool } from '@neondatabase/serverless';

export interface TelegramGalleryItem {
  message_id: number;
  file_id: string;
  file_unique_id?: string;
  width?: number;
  height?: number;
}

export interface TelegramVideoFile {
  message_id: number;
  file_id: string;
  file_unique_id?: string;
  duration?: number;
  width?: number;
  height?: number;
  file_size?: number;
  mime_type?: string;
  label?: string;
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
  videos?: TelegramVideoFile[];
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
  videos: TelegramVideoFile[];
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
    await this.db().query(`
      CREATE TABLE IF NOT EXISTS telegram_media_groups (
        media_group_id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS telegram_pending_groups (
        media_group_id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        photos JSONB NOT NULL DEFAULT '[]'::jsonb,
        videos JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS telegram_messages (
        channel_id TEXT NOT NULL,
        message_id BIGINT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (channel_id, message_id)
      );

      CREATE TABLE IF NOT EXISTS telegram_videos (
        code TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        message_id BIGINT NOT NULL,
        video_file_id TEXT,
        file_unique_id TEXT,
        duration INT,
        width INT,
        height INT,
        file_size BIGINT,
        mime_type TEXT,
        media_group_id TEXT,
        indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS telegram_gallery (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL,
        message_id BIGINT NOT NULL,
        file_id TEXT NOT NULL,
        file_unique_id TEXT,
        width INT,
        height INT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_code_gallery_file UNIQUE (code, file_id)
      );

      CREATE TABLE IF NOT EXISTS telegram_video_files (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL,
        message_id BIGINT NOT NULL,
        file_id TEXT NOT NULL,
        file_unique_id TEXT,
        duration INT,
        width INT,
        height INT,
        file_size BIGINT,
        mime_type TEXT,
        label TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_code_video_file UNIQUE (code, file_id)
      );

      CREATE TABLE IF NOT EXISTS telegram_recent (
        code TEXT PRIMARY KEY,
        indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      ALTER TABLE telegram_gallery DROP CONSTRAINT IF EXISTS telegram_gallery_code_fkey;
      ALTER TABLE telegram_video_files DROP CONSTRAINT IF EXISTS telegram_video_files_code_fkey;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tg_gallery_code_file ON telegram_gallery (code, file_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tg_video_files_code_file ON telegram_video_files (code, file_id);

      -- Safe column additions if table existed before
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='telegram_pending_groups' AND column_name='videos'
        ) THEN
          ALTER TABLE telegram_pending_groups ADD COLUMN videos JSONB NOT NULL DEFAULT '[]'::jsonb;
        END IF;
      END $$;
    `);
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

  static async addPendingMediaGroupPhoto(mediaGroupId: string, item: TelegramGalleryItem & { channel_id: string }) {
    const current = await this.getPendingMediaGroup(mediaGroupId);
    const photos = current?.photos || [];
    if (!photos.some(p => p.file_id === item.file_id || p.message_id === item.message_id)) {
      photos.push({
        message_id: item.message_id,
        file_id: item.file_id,
        file_unique_id: item.file_unique_id,
        width: item.width,
        height: item.height,
      });
    }

    const videos = current?.videos || [];

    await this.db().query(
      `INSERT INTO telegram_pending_groups (media_group_id, channel_id, photos, videos)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)
       ON CONFLICT (media_group_id)
       DO UPDATE SET photos = EXCLUDED.photos, videos = EXCLUDED.videos, updated_at = NOW()`,
      [String(mediaGroupId), item.channel_id, JSON.stringify(photos), JSON.stringify(videos)]
    );
  }

  static async addPendingMediaGroupVideo(mediaGroupId: string, item: TelegramVideoFile & { channel_id: string }) {
    const current = await this.getPendingMediaGroup(mediaGroupId);
    const photos = current?.photos || [];
    const videos = current?.videos || [];
    if (!videos.some(v => v.file_id === item.file_id || v.message_id === item.message_id)) {
      videos.push({
        message_id: item.message_id,
        file_id: item.file_id,
        file_unique_id: item.file_unique_id,
        duration: item.duration,
        width: item.width,
        height: item.height,
        file_size: item.file_size,
        mime_type: item.mime_type,
        label: item.label,
      });
    }

    await this.db().query(
      `INSERT INTO telegram_pending_groups (media_group_id, channel_id, photos, videos)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)
       ON CONFLICT (media_group_id)
       DO UPDATE SET photos = EXCLUDED.photos, videos = EXCLUDED.videos, updated_at = NOW()`,
      [String(mediaGroupId), item.channel_id, JSON.stringify(photos), JSON.stringify(videos)]
    );
  }

  static async getPendingMediaGroup(mediaGroupId: string) {
    const r = await this.db().query(
      'SELECT media_group_id, channel_id, photos, videos, created_at, updated_at FROM telegram_pending_groups WHERE media_group_id = $1 LIMIT 1',
      [String(mediaGroupId)]
    );
    if (!r.rows[0]) return null;
    const row: any = r.rows[0];
    return {
      media_group_id: String(row.media_group_id),
      channel_id: String(row.channel_id),
      photos: Array.isArray(row.photos) ? row.photos : [],
      videos: Array.isArray(row.videos) ? row.videos : [],
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

  static async recordMessage(channelId: string, messageId: number) {
    if (!channelId || !messageId) return;
    await this.db().query(
      'INSERT INTO telegram_messages (channel_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [channelId, messageId]
    );
  }

  private static async ensureParentVideo(code: string, channelId: string, messageId: number) {
    await this.db().query(
      `INSERT INTO telegram_videos (code, channel_id, message_id, indexed_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (code) DO UPDATE SET updated_at = NOW()`,
      [code, channelId, messageId]
    );
    await this.db().query(
      'INSERT INTO telegram_recent (code, indexed_at) VALUES ($1, NOW()) ON CONFLICT (code) DO NOTHING',
      [code]
    );
  }

  static async addGalleryPhoto(code: string, photo: TelegramGalleryItem, channelId: string): Promise<TelegramVideoIndexRecord> {
    const normalized = this.normalizeCode(code);

    // 1. Ensure master video record exists first so foreign constraints never fail
    await this.ensureParentVideo(normalized, channelId, photo.message_id);

    // 2. Insert into telegram_gallery
    await this.db().query(
      `INSERT INTO telegram_gallery (code, message_id, file_id, file_unique_id, width, height)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code, file_id) DO UPDATE SET
       message_id = EXCLUDED.message_id,
       file_unique_id = EXCLUDED.file_unique_id,
       width = EXCLUDED.width,
       height = EXCLUDED.height`,
      [normalized, photo.message_id, photo.file_id, photo.file_unique_id || null, photo.width ?? null, photo.height ?? null]
    );
    await this.recordMessage(channelId, photo.message_id);

    return (await this.getVideo(normalized))!;
  }

  static async addVideoFile(code: string, video: TelegramVideoFile, channelId: string): Promise<TelegramVideoIndexRecord> {
    const normalized = this.normalizeCode(code);

    // 1. Ensure master video record exists first
    await this.ensureParentVideo(normalized, channelId, video.message_id);

    // 2. Insert or update in telegram_video_files
    await this.db().query(
      `INSERT INTO telegram_video_files (code, message_id, file_id, file_unique_id, duration, width, height, file_size, mime_type, label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (code, file_id) DO UPDATE SET
       message_id = EXCLUDED.message_id,
       file_unique_id = EXCLUDED.file_unique_id,
       duration = EXCLUDED.duration,
       width = EXCLUDED.width,
       height = EXCLUDED.height,
       file_size = EXCLUDED.file_size,
       mime_type = EXCLUDED.mime_type,
       label = EXCLUDED.label`,
      [
        normalized,
        video.message_id,
        video.file_id,
        video.file_unique_id || null,
        video.duration ?? null,
        video.width ?? null,
        video.height ?? null,
        video.file_size ?? null,
        video.mime_type || 'video/mp4',
        video.label || null
      ]
    );
    await this.recordMessage(channelId, video.message_id);

    // 3. Update master video record metadata with highest quality/first video
    const existing = await this.getVideo(normalized);
    const indexedAt = existing?.indexed_at || new Date().toISOString();
    const primaryVideoId = existing?.telegram.video_file_id || video.file_id;
    const primaryDuration = (existing?.telegram.duration && existing.telegram.duration > 0)
      ? existing.telegram.duration
      : (video.duration || 0);

    await this.db().query(
      `INSERT INTO telegram_videos
       (code, channel_id, message_id, video_file_id, file_unique_id, duration, width, height, file_size, mime_type, indexed_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (code) DO UPDATE SET
       channel_id = EXCLUDED.channel_id,
       message_id = EXCLUDED.message_id,
       video_file_id = COALESCE(telegram_videos.video_file_id, EXCLUDED.video_file_id),
       file_unique_id = COALESCE(telegram_videos.file_unique_id, EXCLUDED.file_unique_id),
       duration = GREATEST(COALESCE(telegram_videos.duration, 0), EXCLUDED.duration),
       width = GREATEST(COALESCE(telegram_videos.width, 0), EXCLUDED.width),
       height = GREATEST(COALESCE(telegram_videos.height, 0), EXCLUDED.height),
       updated_at = NOW()`,
      [
        normalized,
        channelId,
        video.message_id,
        primaryVideoId,
        video.file_unique_id || null,
        primaryDuration || null,
        video.width ?? null,
        video.height ?? null,
        video.file_size ?? null,
        video.mime_type || 'video/mp4',
        indexedAt
      ]
    );

    await this.db().query(
      'INSERT INTO telegram_recent (code, indexed_at) VALUES ($1,$2) ON CONFLICT (code) DO UPDATE SET indexed_at=EXCLUDED.indexed_at',
      [normalized, indexedAt]
    );

    return (await this.getVideo(normalized))!;
  }

  static async saveVideo(record: TelegramVideoIndexRecord) {
    const code = this.normalizeCode(record.code);
    const existing = await this.getVideo(code);

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

    if (record.telegram.video_file_id) {
      await this.db().query(
        `INSERT INTO telegram_video_files (code, message_id, file_id, file_unique_id, duration, width, height, file_size, mime_type, label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (code, file_id) DO UPDATE SET
         message_id = EXCLUDED.message_id,
         file_unique_id = EXCLUDED.file_unique_id,
         duration = EXCLUDED.duration,
         width = EXCLUDED.width,
         height = EXCLUDED.height,
         file_size = EXCLUDED.file_size`,
        [
          code,
          record.telegram.message_id,
          record.telegram.video_file_id,
          record.telegram.file_unique_id || null,
          record.telegram.duration ?? null,
          record.telegram.width ?? null,
          record.telegram.height ?? null,
          record.telegram.file_size ?? null,
          record.telegram.mime_type || 'video/mp4',
          'Part 1'
        ]
      );
    }

    if (Array.isArray(record.telegram.videos)) {
      for (const [idx, v] of record.telegram.videos.entries()) {
        await this.db().query(
          `INSERT INTO telegram_video_files (code, message_id, file_id, file_unique_id, duration, width, height, file_size, mime_type, label)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (code, file_id) DO UPDATE SET
           message_id = EXCLUDED.message_id,
           file_unique_id = EXCLUDED.file_unique_id,
           duration = EXCLUDED.duration,
           width = EXCLUDED.width,
           height = EXCLUDED.height,
           file_size = EXCLUDED.file_size,
           label = COALESCE(EXCLUDED.label, telegram_video_files.label)`,
          [
            code,
            v.message_id,
            v.file_id,
            v.file_unique_id || null,
            v.duration ?? null,
            v.width ?? null,
            v.height ?? null,
            v.file_size ?? null,
            v.mime_type || 'video/mp4',
            v.label || `Part ${idx + 1}`
          ]
        );
        await this.recordMessage(record.telegram.channel_id, v.message_id);
      }
    }

    if (Array.isArray(record.telegram.gallery)) {
      for (const item of record.telegram.gallery) {
        await this.db().query(
          `INSERT INTO telegram_gallery (code, message_id, file_id, file_unique_id, width, height)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (code, file_id) DO UPDATE SET
           message_id = EXCLUDED.message_id,
           file_unique_id = EXCLUDED.file_unique_id,
           width = EXCLUDED.width,
           height = EXCLUDED.height`,
          [code, item.message_id, item.file_id, item.file_unique_id || null, item.width ?? null, item.height ?? null]
        );
        await this.recordMessage(record.telegram.channel_id, item.message_id);
      }
    }

    await this.recordMessage(record.telegram.channel_id, record.telegram.message_id);

    await this.db().query(
      'INSERT INTO telegram_recent (code, indexed_at) VALUES ($1,$2) ON CONFLICT (code) DO UPDATE SET indexed_at=EXCLUDED.indexed_at',
      [code, indexedAt]
    );
  }

  static async getVideo(code: string): Promise<TelegramVideoIndexRecord | null> {
    const normalized = this.normalizeCode(code);
    const r = await this.db().query(
      'SELECT code,channel_id,message_id,video_file_id,file_unique_id,duration,width,height,file_size,mime_type,media_group_id,indexed_at,updated_at FROM telegram_videos WHERE code=$1 LIMIT 1',
      [normalized]
    );
    if (!r.rows[0]) return null;

    const [gRes, vRes] = await Promise.all([
      this.db().query(
        'SELECT message_id,file_id,file_unique_id,width,height FROM telegram_gallery WHERE code=$1 ORDER BY id ASC',
        [normalized]
      ),
      this.db().query(
        'SELECT message_id,file_id,file_unique_id,duration,width,height,file_size,mime_type,label FROM telegram_video_files WHERE code=$1 ORDER BY id ASC',
        [normalized]
      ),
    ]);

    const row: any = r.rows[0];

    const gallery: TelegramGalleryItem[] = gRes.rows.map((x: any) => ({
      message_id: Number(x.message_id),
      file_id: String(x.file_id),
      file_unique_id: x.file_unique_id || undefined,
      width: x.width == null ? undefined : Number(x.width),
      height: x.height == null ? undefined : Number(x.height),
    }));

    const videoFiles: TelegramVideoFile[] = vRes.rows.map((x: any, idx: number) => ({
      message_id: Number(x.message_id),
      file_id: String(x.file_id),
      file_unique_id: x.file_unique_id || undefined,
      duration: x.duration == null ? undefined : Number(x.duration),
      width: x.width == null ? undefined : Number(x.width),
      height: x.height == null ? undefined : Number(x.height),
      file_size: x.file_size == null ? undefined : Number(x.file_size),
      mime_type: x.mime_type || undefined,
      label: x.label || (vRes.rows.length > 1 ? `Part ${idx + 1}` : undefined),
    }));

    return {
      code: String(row.code),
      telegram: {
        channel_id: String(row.channel_id),
        message_id: Number(row.message_id),
        video_file_id: row.video_file_id || (videoFiles[0]?.file_id) || undefined,
        file_unique_id: row.file_unique_id || (videoFiles[0]?.file_unique_id) || undefined,
        duration: row.duration == null ? (videoFiles[0]?.duration) : Number(row.duration),
        width: row.width == null ? (videoFiles[0]?.width) : Number(row.width),
        height: row.height == null ? (videoFiles[0]?.height) : Number(row.height),
        file_size: row.file_size == null ? (videoFiles[0]?.file_size) : Number(row.file_size),
        mime_type: row.mime_type || (videoFiles[0]?.mime_type) || undefined,
        media_group_id: row.media_group_id || undefined,
        gallery,
        videos: videoFiles.length > 0 ? videoFiles : undefined,
      },
      indexed_at: new Date(row.indexed_at).toISOString(),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
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
