import type { IncomingMessage, ServerResponse } from 'http';
import https from 'https';
import { URL } from 'url';
import type { VideoRecord, SortOption } from '../types/video.ts';
import { GithubMetadataService } from './githubMetadataService.ts';
import { TelegramDb } from './telegramDb.ts';
import { TelegramIndexer } from './telegramIndexer.ts';
import { TelegramBotService } from './telegramBotService.ts';

// Helper to send JSON responses
function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));
}

// Normalizes JAV codes: converts "016dht0881" or "016dht 0881" or "016DHT-0881" to uppercase canonical
export function normalizeCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.includes('-')) {
    return trimmed;
  }
  if (trimmed.includes(' ')) {
    return trimmed.replace(/\s+/, '-');
  }
  const match = trimmed.match(/^([A-Z0-9]+?)([0-9]{3,5})$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return trimmed;
}

// Helper to sort video array
function sortVideos(videos: VideoRecord[], sort: SortOption): VideoRecord[] {
  const copy = [...videos];
  if (sort === 'newest') return copy.sort((a, b) => b.date.localeCompare(a.date));
  if (sort === 'oldest') return copy.sort((a, b) => a.date.localeCompare(b.date));
  if (sort === 'code_asc') return copy.sort((a, b) => a.code.localeCompare(b.code));
  if (sort === 'code_desc') return copy.sort((a, b) => b.code.localeCompare(a.code));
  if (sort === 'duration') return copy.sort((a, b) => b.duration.localeCompare(a.duration));
  return copy;
}

/**
 * Loads all indexed videos from Telegram DB and enriches them with authoritative
 * metadata from the GitHub javtiful-scraper repository (Requirements 1, 3, 4, 10).
 * No MOCK_VIDEOS and no fake Unsplash images!
 */
async function loadIndexedVideosWithMetadata(): Promise<VideoRecord[]> {
  try {
    const tgVideos = await TelegramDb.getAllVideos();
    const records: VideoRecord[] = [];

    for (const tg of tgVideos) {
      let ghVideo: any = null;
      try {
        const gh = await GithubMetadataService.lookup(tg.code);
        if (gh.metadataFound && gh.video) {
          ghVideo = gh.video;
        }
      } catch (e: any) {
        console.warn(`Error resolving metadata for ${tg.code}:`, e.message);
      }

      const title = ghVideo?.title || `Release ${tg.code}`;
      const thumb = ghVideo?.thumb || '';
      const duration = ghVideo?.duration || '00:00:00';
      const date = ghVideo?.date || tg.indexed_at.split('T')[0];
      const actresses = ghVideo?.actresses || [];
      const studio = ghVideo?.studio || null;
      const genres = ghVideo?.genres || [];

      // Real Telegram gallery items only (Requirement 10: NEVER fake Unsplash photos!)
      const gallery = (tg.telegram.gallery && tg.telegram.gallery.length > 0)
        ? tg.telegram.gallery.map((g) => `/api/telegram/file/${encodeURIComponent(g.file_id)}`)
        : [];

      records.push({
        code: tg.code,
        title,
        url: ghVideo?.url || `https://javtiful.com/video/${encodeURIComponent(tg.code.toLowerCase())}`,
        thumb,
        duration,
        date,
        actresses,
        studio,
        genres,
        gallery,
        telegram: tg.telegram,
      });
    }

    return records;
  } catch (e: any) {
    console.error('Error loading indexed videos with metadata:', e.message);
    return [];
  }
}

export function handleBackendApiRequest(req: IncomingMessage, res: ServerResponse): boolean {
  if (!req.url || !req.url.startsWith('/api/')) {
    return false;
  }

  // Pre-flight OPTIONS
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return true;
  }

  const reqUrl = new URL(req.url, 'http://localhost:3000');
  const pathname = reqUrl.pathname;

  // 1. GET /api/latest?limit=6
  if (pathname === '/api/latest') {
    const limit = parseInt(reqUrl.searchParams.get('limit') || '6', 10);
    loadIndexedVideosWithMetadata()
      .then((all) => {
        const sorted = sortVideos(all, 'newest').slice(0, limit);
        sendJson(res, 200, {
          ok: true,
          videos: sorted,
        });
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 2. GET /api/search?q=...&page=1&limit=8
  if (pathname === '/api/search') {
    const query = (reqUrl.searchParams.get('q') || '').trim().toLowerCase();
    const page = Math.max(parseInt(reqUrl.searchParams.get('page') || '1', 10), 1);
    const limit = Math.max(parseInt(reqUrl.searchParams.get('limit') || '8', 10), 1);
    const sort = (reqUrl.searchParams.get('sort') || 'newest') as SortOption;

    loadIndexedVideosWithMetadata()
      .then((all) => {
        let filtered = all;
        if (query) {
          filtered = filtered.filter((v) => {
            const codeMatch = v.code.toLowerCase().includes(query);
            const titleMatch = v.title.toLowerCase().includes(query);
            const actressMatch = v.actresses.some((a) => a.toLowerCase().includes(query));
            const studioMatch = v.studio?.toLowerCase().includes(query) || false;
            const genreMatch = v.genres.some((g) => g.toLowerCase().includes(query));
            return codeMatch || titleMatch || actressMatch || studioMatch || genreMatch;
          });
        }

        const sorted = sortVideos(filtered, sort);
        const total = sorted.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const start = (page - 1) * limit;
        const paged = sorted.slice(start, start + limit);

        sendJson(res, 200, {
          ok: true,
          query,
          total,
          page,
          limit,
          totalPages,
          videos: paged,
        });
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 3. GET /api/videos/:code (O(1) single-file lookup, Requirement 8 & 4)
  const singleVideoMatch = pathname.match(/^\/api\/videos\/([^/]+)$/);
  if (singleVideoMatch) {
    const rawCode = decodeURIComponent(singleVideoMatch[1]);
    const normalized = normalizeCode(rawCode);

    // O(1) single-file lookup for Telegram media record
    TelegramDb.getVideo(normalized)
      .then(async (tgRecord) => {
        // Query authoritative GitHub metadata
        const ghRes = await GithubMetadataService.lookup(normalized);

        if (!tgRecord && (!ghRes.metadataFound || !ghRes.video)) {
          sendJson(res, 404, {
            ok: false,
            error: `Video code '${rawCode}' not found in Telegram database or GitHub repository`,
          });
          return;
        }

        const ghVideo = ghRes.video;
        const title = ghVideo?.title || `Release ${normalized}`;
        const thumb = ghVideo?.thumb || '';
        const duration = ghVideo?.duration || '00:00:00';
        const date = ghVideo?.date || tgRecord?.indexed_at.split('T')[0] || '';
        const actresses = ghVideo?.actresses || [];
        const studio = ghVideo?.studio || null;
        const genres = ghVideo?.genres || [];

        // Real gallery items only (Requirement 10)
        const gallery = (tgRecord?.telegram.gallery && tgRecord.telegram.gallery.length > 0)
          ? tgRecord.telegram.gallery.map((g) => `/api/telegram/file/${encodeURIComponent(g.file_id)}`)
          : [];

        const videoRecord: VideoRecord = {
          code: normalized,
          title,
          url: ghVideo?.url || `https://javtiful.com/video/${encodeURIComponent(normalized.toLowerCase())}`,
          thumb,
          duration,
          date,
          actresses,
          studio,
          genres,
          gallery,
          telegram: tgRecord?.telegram,
        };

        sendJson(res, 200, {
          ok: true,
          video: videoRecord,
          related: [],
          source: tgRecord ? 'telegram' : 'github',
        });
      })
      .catch((err) => {
        sendJson(res, 500, {
          ok: false,
          error: err.message,
        });
      });
    return true;
  }

  // 3b. GET /api/github/lookup?code=...
  if (pathname === '/api/github/lookup') {
    const code = reqUrl.searchParams.get('code');
    if (!code) {
      sendJson(res, 400, { ok: false, error: 'Missing code parameter' });
      return true;
    }

    GithubMetadataService.lookup(code)
      .then((result) => {
        sendJson(res, 200, {
          ok: true,
          ...result,
        });
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 3c. GET /api/github/cache-stats
  if (pathname === '/api/github/cache-stats') {
    sendJson(res, 200, {
      ok: true,
      stats: GithubMetadataService.getCacheStats(),
    });
    return true;
  }

  // 4. GET /api/videos?page=1&limit=8&genre=...&actress=...&studio=...&sort=newest
  if (pathname === '/api/videos') {
    const page = Math.max(parseInt(reqUrl.searchParams.get('page') || '1', 10), 1);
    const limit = Math.max(parseInt(reqUrl.searchParams.get('limit') || '8', 10), 1);
    const genre = reqUrl.searchParams.get('genre');
    const actress = reqUrl.searchParams.get('actress');
    const studio = reqUrl.searchParams.get('studio');
    const search = reqUrl.searchParams.get('search')?.trim().toLowerCase();
    const sort = (reqUrl.searchParams.get('sort') || 'newest') as SortOption;

    loadIndexedVideosWithMetadata()
      .then((all) => {
        let filtered = all;

        if (genre) {
          filtered = filtered.filter((v) => v.genres.includes(genre));
        }
        if (actress) {
          filtered = filtered.filter((v) => v.actresses.includes(actress));
        }
        if (studio) {
          filtered = filtered.filter((v) => v.studio === studio);
        }
        if (search) {
          filtered = filtered.filter((v) => {
            const codeMatch = v.code.toLowerCase().includes(search);
            const titleMatch = v.title.toLowerCase().includes(search);
            const actressMatch = v.actresses.some((a) => a.toLowerCase().includes(search));
            const studioMatch = v.studio?.toLowerCase().includes(search) || false;
            return codeMatch || titleMatch || actressMatch || studioMatch;
          });
        }

        const sorted = sortVideos(filtered, sort);
        const total = sorted.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const start = (page - 1) * limit;
        const paged = sorted.slice(start, start + limit);

        sendJson(res, 200, {
          ok: true,
          total,
          page,
          limit,
          totalPages,
          videos: paged,
        });
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 5. GET /api/actresses
  if (pathname === '/api/actresses') {
    loadIndexedVideosWithMetadata()
      .then((all) => {
        const map = new Map<string, number>();
        for (const v of all) {
          for (const a of v.actresses) {
            map.set(a, (map.get(a) || 0) + 1);
          }
        }
        const list = Array.from(map.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        sendJson(res, 200, {
          ok: true,
          actresses: list,
        });
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 6. GET /api/studios
  if (pathname === '/api/studios') {
    loadIndexedVideosWithMetadata()
      .then((all) => {
        const map = new Map<string, number>();
        for (const v of all) {
          if (v.studio) {
            map.set(v.studio, (map.get(v.studio) || 0) + 1);
          }
        }
        const list = Array.from(map.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        sendJson(res, 200, {
          ok: true,
          studios: list,
        });
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 7. GET /api/genres
  if (pathname === '/api/genres') {
    loadIndexedVideosWithMetadata()
      .then((all) => {
        const set = new Set<string>();
        for (const v of all) {
          for (const g of v.genres) {
            set.add(g);
          }
        }
        sendJson(res, 200, {
          ok: true,
          genres: Array.from(set).sort(),
        });
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 8. Telegram Webhook: POST /api/telegram/webhook
  if (pathname === '/api/telegram/webhook' && req.method === 'POST') {
    parseJsonBody(req)
      .then(async (body) => {
        if (body.channel_post) {
          return await TelegramIndexer.processPost(body.channel_post);
        }
        if (body.message) {
          if (body.message.chat?.type === 'private' || !body.message.chat?.type) {
            return await TelegramBotService.handlePrivateMessage(body.message);
          }
          if (body.message.video || body.message.photo) {
            return await TelegramIndexer.processPost(body.message);
          }
        }
        return await TelegramIndexer.processUpdate(body);
      })
      .then((result) => {
        sendJson(res, 200, { ok: true, result });
      })
      .catch((err) => {
        sendJson(res, 400, { ok: false, error: err.message });
      });
    return true;
  }

  // 9. Manual / Simulation Post Indexer: POST /api/telegram/index-post
  if (pathname === '/api/telegram/index-post' && req.method === 'POST') {
    parseJsonBody(req)
      .then((body) => TelegramIndexer.processPost(body))
      .then((result) => {
        sendJson(res, 200, { ok: true, result });
      })
      .catch((err) => {
        sendJson(res, 400, { ok: false, error: err.message });
      });
    return true;
  }

  // 10. List Telegram DB videos: GET /api/telegram/db/videos
  if (pathname === '/api/telegram/db/videos') {
    TelegramDb.getAllVideos()
      .then((videos) => {
        sendJson(res, 200, { ok: true, total: videos.length, videos });
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 11. Get single Telegram DB video: GET /api/telegram/db/videos/:code (O(1))
  const tgDbSingleMatch = pathname.match(/^\/api\/telegram\/db\/videos\/([^/]+)$/);
  if (tgDbSingleMatch) {
    const rawCode = decodeURIComponent(tgDbSingleMatch[1]);
    TelegramDb.getVideo(normalizeCode(rawCode))
      .then((record) => {
        if (record) {
          sendJson(res, 200, { ok: true, record });
        } else {
          sendJson(res, 404, { ok: false, error: `Code ${rawCode} not found in Telegram DB` });
        }
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 12. Media descriptor: GET /api/media/:code/:index (O(1))
  const mediaMatch = pathname.match(/^\/api\/media\/([^/]+)\/([^/]+)$/);
  if (mediaMatch) {
    const rawCode = decodeURIComponent(mediaMatch[1]);
    const indexStr = decodeURIComponent(mediaMatch[2]);

    TelegramDb.getVideo(normalizeCode(rawCode))
      .then((record) => {
        if (!record) {
          sendJson(res, 404, { ok: false, error: `No media found for code ${rawCode}` });
          return;
        }

        if (indexStr === 'video') {
          sendJson(res, 200, {
            ok: true,
            code: record.code,
            type: 'video',
            channel_id: record.telegram.channel_id,
            message_id: record.telegram.message_id,
            video_file_id: record.telegram.video_file_id,
          });
          return;
        }

        const idx = parseInt(indexStr, 10);
        const gallery = record.telegram.gallery || [];
        if (isNaN(idx) || idx < 0 || idx >= gallery.length) {
          sendJson(res, 404, {
            ok: false,
            error: `Gallery index ${indexStr} out of bounds (0-${gallery.length - 1})`,
          });
          return;
        }

        const photoItem = gallery[idx];
        sendJson(res, 200, {
          ok: true,
          code: record.code,
          type: 'photo',
          index: idx,
          item: photoItem,
        });
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 13. Deep Link Simulation: POST /api/telegram/bot/simulate-start
  if (pathname === '/api/telegram/bot/simulate-start' && req.method === 'POST') {
    parseJsonBody(req)
      .then(async (body) => {
        const chatId = body.chat_id || 10001;
        const text = body.text || (body.code ? `/start ${body.code}` : '/start');
        const resAction = await TelegramBotService.handlePrivateMessage({
          chat: { id: chatId, type: 'private' },
          text,
        });
        sendJson(res, 200, { ok: true, action: resAction });
      })
      .catch((err) => {
        sendJson(res, 400, { ok: false, error: err.message });
      });
    return true;
  }

  // 14. Real Telegram Photo File Streaming (Server-side bot token only, Requirement 5 & 10)
  const tgFileMatch = pathname.match(/^\/api\/telegram\/file\/([^/]+)$/);
  if (tgFileMatch) {
    const fileId = decodeURIComponent(tgFileMatch[1]);
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';

    if (!botToken) {
      // In development or if bot token unset, render clean SVG banner (no fake Unsplash)
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.end(
        `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="#0b0f19"><rect width="600" height="400" fill="#0f172a"/><text x="50%" y="45%" text-anchor="middle" fill="#f43f5e" font-family="monospace" font-size="20" font-weight="bold">TELEGRAM SCREENSHOT</text><text x="50%" y="58%" text-anchor="middle" fill="#64748b" font-family="monospace" font-size="14">file_id: ${fileId.slice(0, 20)}...</text></svg>`
      );
      return true;
    }

    // Stream real Telegram file using server-side bot token
    https
      .get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`, (infoRes) => {
        let data = '';
        infoRes.on('data', (chunk) => (data += chunk));
        infoRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok && parsed.result?.file_path) {
              const fileUrl = `https://api.telegram.org/file/bot${botToken}/${parsed.result.file_path}`;
              https
                .get(fileUrl, (streamRes) => {
                  res.statusCode = streamRes.statusCode || 200;
                  res.setHeader('Content-Type', streamRes.headers['content-type'] || 'image/jpeg');
                  res.setHeader('Cache-Control', 'public, max-age=86400');
                  streamRes.pipe(res);
                })
                .on('error', (err) => {
                  sendJson(res, 502, { ok: false, error: err.message });
                });
              return;
            }
            sendJson(res, 404, { ok: false, error: 'Telegram file_id not found on Telegram API' });
          } catch (e: any) {
            sendJson(res, 500, { ok: false, error: e.message });
          }
        });
      })
      .on('error', (err) => {
        sendJson(res, 502, { ok: false, error: err.message });
      });
    return true;
  }

  return false;
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Request body exceeds limit'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e: any) {
        reject(new Error(`Invalid JSON body: ${e.message}`));
      }
    });
    req.on('error', reject);
  });
}
