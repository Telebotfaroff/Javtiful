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

export interface PendingMediaGroup {
  media_group_id: string;
  channel_id: string;
  photos: TelegramGalleryItem[];
  created_at: string;
  updated_at: string;
}

interface CacheEntry { expiresAt: number; value: unknown; }

const CACHE_TTL = 60_000;
const MAX_CACHE = 300;
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1500;

export class TelegramDb {
  private static cache = new Map<string, CacheEntry>();
  private static pendingWrites = new Map<string, string | null>();
  private static flushTimer: ReturnType<typeof setTimeout> | null = null;
  private static flushPromise: Promise<void> | null = null;

  static async init(): Promise<void> {}

  private static owner() { return process.env.TELEGRAM_INDEX_GITHUB_OWNER || 'Telebotfaroff'; }
  private static repo() { return process.env.TELEGRAM_INDEX_GITHUB_REPO || 'javtiful-telegram-index'; }
  private static branch() { return process.env.TELEGRAM_INDEX_GITHUB_BRANCH || 'main'; }
  private static token() { return process.env.TELEGRAM_INDEX_GITHUB_TOKEN || process.env.GITHUB_TOKEN || ''; }

  private static apiRoot() { return `https://api.github.com/repos/${this.owner()}/${this.repo()}`; }
  private static apiBase() { return `${this.apiRoot()}/contents`; }
  private static rawBase() { return `https://raw.githubusercontent.com/${this.owner()}/${this.repo()}/${encodeURIComponent(this.branch())}`; }

  private static headers(json = false): Record<string, string> {
    const token = this.token();
    if (!token) throw new Error('TELEGRAM_INDEX_GITHUB_TOKEN or GITHUB_TOKEN is required for index writes');
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'JAVTIFUL-Catalog/1.0',
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
  }

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

  private static pendingGroupPath(id: string) {
    return `pending-groups/${encodeURIComponent(String(id))}.json`;
  }

  private static cacheGet<T>(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (item.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return item.value as T;
  }

  private static cacheSet(key: string, value: unknown) {
    if (this.cache.size >= MAX_CACHE) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL, value });
  }

  private static pathFromUrl(path: string) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  private static async fetchRaw<T>(path: string): Promise<T | null> {
    const pending = this.pendingWrites.get(path);
    if (pending !== undefined) {
      if (pending === null) return null;
      return JSON.parse(pending) as T;
    }

    const cacheKey = `raw:${path}`;
    const cached = this.cacheGet<T>(cacheKey);
    if (cached !== undefined) return cached;

    const response = await fetch(`${this.rawBase()}/${this.pathFromUrl(path)}`, {
      headers: { 'User-Agent': 'JAVTIFUL-Catalog/1.0', Accept: 'application/json' },
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Telegram GitHub index read failed: HTTP ${response.status}`);

    const value = await response.json() as T;
    this.cacheSet(cacheKey, value);
    return value;
  }

  private static async getContent(path: string): Promise<{ content: any; sha?: string } | null> {
    const pending = this.pendingWrites.get(path);
    if (pending !== undefined) {
      return pending === null ? null : { content: JSON.parse(pending) };
    }

    const response = await fetch(`${this.apiBase()}/${this.pathFromUrl(path)}`, { headers: this.headers() });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Telegram GitHub index content read failed: HTTP ${response.status}`);

    const json: any = await response.json();
    const decoded = Buffer.from(String(json.content || '').replace(/\\n/g, ''), 'base64').toString('utf8');
    return { content: JSON.parse(decoded), sha: json.sha };
  }

  /**
   * Queue a JSON write. Writes are committed in batches using Git's tree/commit API.
   * This turns dozens of Contents-API commits into one atomic commit.
   */
  private static queueJson(path: string, value: any) {
    this.pendingWrites.set(path, JSON.stringify(value, null, 2));
    this.cache.delete(`raw:${path}`);

    if (this.pendingWrites.size >= BATCH_SIZE) {
      void this.flush();
      return;
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.flush();
      }, BATCH_DELAY_MS);
    }
  }

  private static queueDelete(path: string) {
    this.pendingWrites.set(path, null);
    this.cache.delete(`raw:${path}`);
    if (this.pendingWrites.size >= BATCH_SIZE) {
      void this.flush();
      return;
    }
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.flush();
      }, BATCH_DELAY_MS);
    }
  }

  static async flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    if (this.pendingWrites.size === 0) return;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const batch = new Map(this.pendingWrites);
    this.pendingWrites.clear();

    this.flushPromise = this.commitBatch(batch).catch(error => {
      // Put failed writes back so they can be retried instead of being lost.
      for (const [path, content] of batch) {
        if (!this.pendingWrites.has(path)) this.pendingWrites.set(path, content);
      }
      throw error;
    }).finally(() => {
      this.flushPromise = null;
      if (this.pendingWrites.size > 0 && !this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.flushTimer = null;
          void this.flush();
        }, 100);
      }
    });

    return this.flushPromise;
  }

  private static async githubJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: { ...this.headers(Boolean(init?.body)), ...(init?.headers || {}) },
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) {
      throw new Error(`GitHub API HTTP ${response.status}: ${data?.message || text.slice(0, 300)}`);
    }
    return data as T;
  }

  private static async commitBatch(batch: Map<string, string | null>) {
    if (batch.size === 0) return;
    const paths = Array.from(batch.keys());

    // Retry once if another writer advances main between reading and updating it.
    for (let attempt = 0; attempt < 2; attempt++) {
      const ref = await this.githubJson<any>(`${this.apiRoot()}/git/ref/heads/${encodeURIComponent(this.branch())}`);
      const parentSha = ref.object.sha as string;
      const commit = await this.githubJson<any>(`${this.apiRoot()}/git/commits/${parentSha}`);
      const baseTree = commit.tree.sha as string;

      const blobs = await Promise.all(paths.map(async path => {
        const content = batch.get(path);
        if (content === null) return { path, sha: null };
        const blob = await this.githubJson<any>(`${this.apiRoot()}/git/blobs`, {
          method: 'POST',
          body: JSON.stringify({
            content: Buffer.from(content, 'utf8').toString('base64'),
            encoding: 'base64',
          }),
        });
        return { path, sha: blob.sha };
      }));

      const tree = await this.githubJson<any>(`${this.apiRoot()}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseTree,
          tree: blobs.map(item => ({
            path: item.path,
            mode: '100644',
            type: 'blob',
            sha: item.sha,
          })),
        }),
      });

      const newCommit = await this.githubJson<any>(`${this.apiRoot()}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({
          message: `index: batch update (${batch.size} files)`,
          tree: tree.sha,
          parents: [parentSha],
        }),
      });

      try {
        await this.githubJson<any>(`${this.apiRoot()}/git/refs/heads/${encodeURIComponent(this.branch())}`, {
          method: 'PATCH',
          body: JSON.stringify({ sha: newCommit.sha, force: false }),
        });
        console.log(`[telegram-db] committed ${batch.size} files in one GitHub commit`);
        return;
      } catch (error: any) {
        if (attempt === 0 && /409/.test(String(error.message))) continue;
        throw error;
      }
    }
  }

  static async setMediaGroupCode(mediaGroupId: string, code: string) {
    if (!mediaGroupId || !code) return;
    this.queueJson(
      this.mediaGroupPath(mediaGroupId),
      { media_group_id: String(mediaGroupId), code: this.normalizeCode(code), updated_at: new Date().toISOString() },
    );
  }

  static async getCodeByMediaGroup(mediaGroupId: string) {
    if (!mediaGroupId) return undefined;
    return (await this.fetchRaw<{ code?: string }>(this.mediaGroupPath(mediaGroupId)))?.code;
  }

  static async addPendingMediaGroup(mediaGroupId: string, item: TelegramGalleryItem & { channel_id: string }) {
    const path = this.pendingGroupPath(mediaGroupId);
    const current = await this.getContent(path);
    const existing: PendingMediaGroup = current?.content || {
      media_group_id: String(mediaGroupId),
      channel_id: item.channel_id,
      photos: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!existing.photos.some(p => p.message_id === item.message_id || p.file_id === item.file_id)) {
      existing.photos.push({
        message_id: item.message_id,
        file_id: item.file_id,
        file_unique_id: item.file_unique_id,
        width: item.width,
        height: item.height,
      });
    }

    existing.updated_at = new Date().toISOString();
    this.queueJson(path, existing);
  }

  static async getPendingMediaGroup(mediaGroupId: string) {
    if (!mediaGroupId) return null;
    return this.fetchRaw<PendingMediaGroup>(this.pendingGroupPath(mediaGroupId));
  }

  static async clearPendingMediaGroup(mediaGroupId: string) {
    this.queueDelete(this.pendingGroupPath(mediaGroupId));
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
      this.queueJson(path, entries);
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
      code,
      telegram: record.telegram,
      indexed_at: record.indexed_at,
      ...(record.updated_at ? { updated_at: record.updated_at } : {}),
    };

    this.queueJson(this.videoPath(code), clean);

    await this.recordMessage(clean.telegram.channel_id, clean.telegram.message_id);
    for (const item of clean.telegram.gallery || []) {
      await this.recordMessage(clean.telegram.channel_id, item.message_id);
    }

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

    // Do not create an incomplete video record for a photo arriving before its video.
    // The indexer should keep such photos in pending-groups until the video/code arrives.
    const pending: TelegramVideoIndexRecord = {
      code: this.normalizeCode(code),
      telegram: { channel_id: channelId, message_id: 0, gallery: [photo] },
      indexed_at: new Date().toISOString(),
    };
    return pending;
  }

  static async getVideo(code: string) {
    return this.fetchRaw<TelegramVideoIndexRecord>(this.videoPath(code));
  }

  static async getRecentCodes(limit = 24) {
    const recent = await this.fetchRaw<Array<{ code: string; indexed_at: string }>>('catalog/recent.json');
    return Array.isArray(recent)
      ? recent.slice(0, Math.min(Math.max(limit, 1), 100)).map(x => x.code)
      : [];
  }

  private static async updateRecent(record: TelegramVideoIndexRecord) {
    const path = 'catalog/recent.json';
    const current = await this.getContent(path);
    const entries = Array.isArray(current?.content) ? current.content : [];
    const filtered = entries.filter((x: any) => x?.code !== record.code);
    filtered.unshift({ code: record.code, indexed_at: record.indexed_at });
    this.queueJson(path, filtered.slice(0, 500));
  }

  static async getCount(): Promise<number | null> {
    const stats = await this.fetchRaw<{ total?: number }>('catalog/stats.json');
    return typeof stats?.total === 'number' ? stats.total : null;
  }

  static clearCache() { this.cache.clear(); }

  static async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}
