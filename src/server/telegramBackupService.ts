import { Pool } from '@neondatabase/serverless';

type BackupFile = { path: string; content: string };

export class TelegramBackupService {
  private static env(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(name + ' is not configured');
    return value;
  }

  private static async github(path: string, init: RequestInit = {}) {
    const token = this.env('TELEGRAM_INDEX_GITHUB_TOKEN');
    const owner = this.env('TELEGRAM_INDEX_GITHUB_OWNER');
    const repo = this.env('TELEGRAM_INDEX_GITHUB_REPO');
    const response = await fetch('https://api.github.com/repos/' + owner + '/' + repo + path, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.headers || {}),
      },
    });
    const body = await response.text();
    if (!response.ok) throw new Error('GitHub API ' + response.status + ': ' + body.slice(0, 500));
    return body ? JSON.parse(body) : null;
  }

  private static async rows(sql: string) {
    const url = this.env('DATABASE_URL');
    const pool = new Pool({ connectionString: url });
    try {
      const result = await pool.query(sql);
      return result.rows as any[];
    } finally {
      await pool.end();
    }
  }

  private static shard(value: unknown) {
    const name = String(value || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    return name.slice(0, 6) || 'UNKNOWN';
  }

  private static makeFiles(rows: any[], folder: string, key: string): BackupFile[] {
    const groups = new Map<string, any[]>();
    for (const row of rows) {
      const name = this.shard(row[key]);
      const group = groups.get(name) || [];
      group.push(row);
      groups.set(name, group);
    }
    return [...groups].map(([name, data]) => ({
      path: folder + '/' + name + '.json',
      content: JSON.stringify({ total: data.length, data }, null, 2) + '\n',
    }));
  }

  private static async commit(files: BackupFile[], message: string) {
    const branch = process.env.TELEGRAM_INDEX_GITHUB_BRANCH || 'main';
    const ref = await this.github('/git/ref/heads/' + branch);
    const head = await this.github('/git/commits/' + ref.object.sha);

    const treeItems: any[] = [];
    for (const file of files) {
      const blob = await this.github('/git/blobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
      });
      treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const tree = await this.github('/git/trees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: head.tree.sha, tree: treeItems }),
    });

    const commit = await this.github('/git/commits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }),
    });

    await this.github('/git/refs/heads/' + branch, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });

    return commit.sha as string;
  }

  static async backup() {
    const [videos, videoFiles, gallery, historyMedia, groups, pending, messages, recent] = await Promise.all([
      this.rows('SELECT * FROM telegram_videos ORDER BY code'),
      this.rows('SELECT * FROM telegram_video_files ORDER BY id'),
      this.rows('SELECT * FROM telegram_gallery ORDER BY id'),
      this.rows('SELECT * FROM telegram_history_media ORDER BY id'),
      this.rows('SELECT * FROM telegram_media_groups ORDER BY media_group_id'),
      this.rows('SELECT * FROM telegram_pending_groups ORDER BY media_group_id'),
      this.rows('SELECT * FROM telegram_messages ORDER BY channel_id, message_id'),
      this.rows('SELECT * FROM telegram_recent ORDER BY indexed_at DESC'),
    ]);

    const files: BackupFile[] = [
      ...this.makeFiles(videos, 'videos', 'code'),
      ...this.makeFiles(videoFiles, 'video-files', 'code'),
      ...this.makeFiles(gallery, 'gallery', 'code'),
      ...this.makeFiles(historyMedia, 'history-media', 'code'),
      ...this.makeFiles(groups, 'media-groups', 'media_group_id'),
      ...this.makeFiles(pending, 'pending-groups', 'media_group_id'),
      ...this.makeFiles(messages, 'messages', 'message_id'),
      ...this.makeFiles(recent, 'recent', 'code'),
      {
        path: 'manifest.json',
        content: JSON.stringify({
          version: 1,
          created_at: new Date().toISOString(),
          counts: {
            videos: videos.length,
            video_files: videoFiles.length,
            gallery: gallery.length,
            history_media: historyMedia.length,
            media_groups: groups.length,
            pending_groups: pending.length,
            messages: messages.length,
            recent: recent.length,
          },
        }, null, 2) + '\n',
      },
    ];

    const commit = await this.commit(files, 'backup: Neon Telegram index ' + new Date().toISOString());
    return { commit, files: files.length, videos: videos.length, gallery: gallery.length };
  }
}
