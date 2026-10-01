import crypto from 'crypto';

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

interface CacheEntry { expiresAt: number; value: unknown; }

const CACHE_TTL = 60_000;
const MAX_CACHE = 200;

export class TelegramDb {
  private static cache = new Map<string, CacheEntry>();
  static async init(): Promise<void> {}

  private static owner() { return process.env.TELEGRAM_INDEX_GITHUB_OWNER || 'Telebotfaroff'; }
  private static repo() { return process.env.TELEGRAM_INDEX_GITHUB_REPO || 'javtiful-telegram-index'; }
  private static branch() { return process.env.TELEGRAM_INDEX_GITHUB_BRANCH || 'main'; }
  private static token() { return process.env.TELEGRAM_INDEX_GITHUB_TOKEN || process.env.GITHUB_TOKEN || ''; }
  private static apiBase() { return `https://api.github.com/repos/${this.owner()}/${this.repo()}/contents`; }
  private static rawBase() { return `https://raw.githubusercontent.com/${this.owner()}/${this.repo()}/${encodeURIComponent(this.branch())}`; }

  private static normalizeCode(code: string) {
    return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  }

  private static videoPath(code: string) {
    const safe = this.normalizeCode(code);
    const match = safe.match(/^(.+)-([0-9]+)$/);
    if (!match) throw new Error(`Invalid JAV code: ${code}`);
    return `videos/${match[1]}/${match[2]}.json`;
  }

  private static messageShard(key: string) {
    return `messages/${crypto.createHash('sha256').update(key).digest('hex').slice(0, 2)}.json`;
  }

  private static mediaGroupPath(id: string) {
    return `media-groups/${encodeURIComponent(String(id))}.json`;
  }

  private static cacheGet<T>(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (item.expiresAt < Date.now()) { this.cache.delete(key); return undefined; }
    return item.value as T;
  }

  private static cacheSet(key: string, value: unknown) {
    if (this.cache.size >= MAX_CACHE) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL, value });
  }

  private static async fetchRaw<T>(path: string): Promise<T | null> {
    const cacheKey = `raw:${path}`;
    const cached = this.cacheGet<T>(cacheKey);
    if (cached !== undefined) return cached;

    const url = `${this.rawBase()}/${path.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'JAVTIFUL-Catalog/1.0', Accept: 'application/json' } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Telegram GitHub index read failed: HTTP ${response.status}`);
    const value = await response.json() as T;
    this.cacheSet(cacheKey, value);
    return value;
  }

  private static async getContent(path: string): Promise<{ content: any; sha?: string } | null> {
    const token = this.token();
    if (!token) throw new Error('TELEGRAM_INDEX_GITHUB_TOKEN or GITHUB_TOKEN is required for index writes');

    const response = await fetch(`${this.apiBase()}/${path.split('/').map(encodeURIComponent).join('/')}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'JAVTIFUL-Catalog/1.0',
      },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Telegram GitHub index content read failed: HTTP ${response.status}`);
    const json: any = await response.json();
    const decoded = Buffer.from(String(json.content || '').replace(/\\n/g, ''), 'base64').toString('utf8');
    return { content: JSON.parse(decoded), sha: json.sha };
  }

  private static async putJson(path: string, value: any, message: string): Promise<void> {
    const token = this.token();
    if (!token) throw new Error('TELEGRAM_INDEX_GITHUB_TOKEN or GITHUB_TOKEN is required for index writes');

    const bodyBase: any = {
      message,
      content: Buffer.from(JSON.stringify(value, null, 2), 'utf8').toString('base64'),
      branch: this.branch(),
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await this.getContent(path);
      const body = current?.sha ? { ...bodyBase, sha: current.sha } : bodyBase;
      const response = await fetch(`${this.apiBase()}/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'JAVTIFUL-Catalog/1.0',
        },
        body: JSON.stringify(body),
      });
      if (response.ok) { this.cache.delete(`raw:${path}`); return; }
      if (response.status === 409 && attempt === 0) continue;
      throw new Error(`Telegram GitHub index write failed: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
    }
  }

  static async setMediaGroupCode(mediaGroupId: string, code: string) {
    if (!mediaGroupId || !code) return;
    await this.putJson(this.mediaGroupPath(mediaGroupId), {
      media_group_id: String(mediaGroupId), code: this.normalizeCode(code), updated_at: new Date().toISOString()
    }, `index: map media group ${mediaGroupId}`);
  }

  static async getCodeByMediaGroup(mediaGroupId: string) {
    if (!mediaGroupId) return undefined;
    return (await this.fetchRaw<{ code?: string }>(this.mediaGroupPath(mediaGroupId)))?.code;
  }

  static async hasMessage(channelId: string, messageId: number) {
    const key = `${channelId}:${messageId}`;
    const entries = await this.fetchRaw<string[]>(this.messageShard(key));
    return Array.isArray(entries) && entries.includes(key);
  }

  private static async recordMessage(channelId: string, messageId: number) {
    if (!channelId || !messageId) return;
    const key = `${channelId}:${messageId}`;
    const path = this.messageShard(key);
    const current = await this.getContent(path);
    const entries = Array.isArray(current?.content) ? current.content.map(String) : [];
    if (!entries.includes(key)) {
      entries.push(key);
      await this.putJson(path, entries, `index: message ${key}`);
    }
  }

  static async saveVideo(record: TelegramVideoIndexRecord) {
    const code = this.normalizeCode(record.code);
    const existing = await this.getVideo(code);

    if (existing) {
      const gallery = new Map<string, TelegramGalleryItem>();
      for (const item of existing.telegram.gallery || []) gallery.set(item.file_id, item);
      for (const item of record.telegram.gallery || []) gallery.set(item.file_id, item);
      record.telegram.gallery = Array.from(gallery.values());
      record.indexed_at = existing.indexed_at;
      record.updated_at = new Date().toISOString();
    }

    const clean: TelegramVideoIndexRecord = {
      code, telegram: record.telegram, indexed_at: record.indexed_at,
      ...(record.updated_at ? { updated_at: record.updated_at } : {})
    };

    await this.putJson(this.videoPath(code), clean, `index: ${code}`);
    await this.recordMessage(clean.telegram.channel_id, clean.telegram.message_id);
    for (const item of clean.telegram.gallery || []) await this.recordMessage(clean.telegram.channel_id, item.message_id);
    await this.updateRecent(clean);
  }

  static async addGalleryPhoto(code: string, photo: TelegramGalleryItem, channelId: string): Promise<TelegramVideoIndexRecord> {
    const existing = await this.getVideo(code);
    if (existing) {
      existing.telegram.gallery = existing.telegram.gallery || [];
      if (!existing.telegram.gallery.some(p => p.message_id === photo.message_id || p.file_id === photo.file_id)) {
        existing.telegram.gallery.push(photo);
      }
      existing.updated_at = new Date().toISOString();
      await this.saveVideo(existing);
      return existing;
    }

    const draft: TelegramVideoIndexRecord = {
      code: this.normalizeCode(code),
      telegram: { channel_id: channelId, message_id: 0, gallery: [photo] },
      indexed_at: new Date().toISOString()
    };
    await this.saveVideo(draft);
    return draft;
  }

  static async getVideo(code: string) {
    return this.fetchRaw<TelegramVideoIndexRecord>(this.videoPath(code));
  }

  static async getRecentCodes(limit = 24) {
    const recent = await this.fetchRaw<Array<{ code: string; indexed_at: string }>>('catalog/recent.json');
    return Array.isArray(recent) ? recent.slice(0, Math.min(Math.max(limit, 1), 100)).map(x => x.code) : [];
  }

  private static async updateRecent(record: TelegramVideoIndexRecord) {
    const path = 'catalog/recent.json';
    const current = await this.getContent(path);
    const entries = Array.isArray(current?.content) ? current.content : [];
    const filtered = entries.filter((x: any) => x?.code !== record.code);
    filtered.unshift({ code: record.code, indexed_at: record.indexed_at });
    await this.putJson(path, filtered.slice(0, 500), `index: recent ${record.code}`);
  }

  static async getCount(): Promise<number | null> {
    const stats = await this.fetchRaw<{ total?: number }>('catalog/stats.json');
    return typeof stats?.total === 'number' ? stats.total : null;
  }

  static clearCache() { this.cache.clear(); }
}
