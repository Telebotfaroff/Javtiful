import type { IncomingMessage, ServerResponse } from 'http';
import https from 'https';
import { URL } from 'url';
import type { VideoRecord, SortOption } from '../types/video.ts';
import { GithubMetadataService } from './githubMetadataService.ts';
import { TelegramDb } from './telegramDb.ts';
import { TelegramIndexer } from './telegramIndexer.ts';
import { TelegramBotService } from './telegramBotService.ts';

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Bot-Api-Secret-Token, X-Telegram-Admin-Secret');
  res.end(JSON.stringify(data));
}

export function normalizeCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.includes('-')) return trimmed;
  if (trimmed.includes(' ')) return trimmed.replace(/\s+/, '-');
  const match = trimmed.match(/^([A-Z0-9]+?)([0-9]{3,5})$/);
  return match ? `${match[1]}-${match[2]}` : trimmed;
}

function sortVideos(videos: VideoRecord[], sort: SortOption): VideoRecord[] {
  const copy = [...videos];
  if (sort === 'newest') return copy.sort((a, b) => b.date.localeCompare(a.date));
  if (sort === 'oldest') return copy.sort((a, b) => a.date.localeCompare(b.date));
  if (sort === 'code_asc') return copy.sort((a, b) => a.code.localeCompare(b.code));
  if (sort === 'code_desc') return copy.sort((a, b) => b.code.localeCompare(a.code));
  if (sort === 'duration') return copy.sort((a, b) => b.duration.localeCompare(a.duration));
  return copy;
}

function galleryUrls(code: string, gallery: any[] | undefined): string[] {
  return (gallery || []).map((_, index) => `/api/media/${encodeURIComponent(code)}/${index}`);
}

async function toVideoRecord(tg: any): Promise<VideoRecord | null> {
  const gh = await GithubMetadataService.lookup(tg.code);
  if (!gh.metadataFound || !gh.video) return null;
  const v = gh.video;
  return {
    code: tg.code,
    title: v.title,
    url: v.url,
    thumb: v.thumb,
    duration: v.duration,
    date: v.date || tg.indexed_at?.split('T')[0] || '',
    actresses: v.actresses || [],
    studio: v.studio || null,
    genres: v.genres || [],
    gallery: galleryUrls(tg.code, tg.telegram?.gallery),
    telegram: tg.telegram,
  };
}

async function getRecentVideos(limit: number): Promise<VideoRecord[]> {
  const codes = await TelegramDb.getRecentCodes(Math.min(Math.max(limit, 1), 100));
  const result: VideoRecord[] = [];
  for (const code of codes) {
    const tg = await TelegramDb.getVideo(code);
    if (!tg) continue;
    try {
      const video = await toVideoRecord(tg);
      if (video) result.push(video);
    } catch (e: any) {
      console.warn(`Metadata lookup failed for ${code}: ${e.message}`);
    }
  }
  return result;
}

function header(req: IncomingMessage, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function requireAdmin(req: IncomingMessage): boolean {
  const secret = process.env.TELEGRAM_ADMIN_SECRET || '';
  return Boolean(secret && header(req, 'x-telegram-admin-secret') === secret);
}

function requireTelegramWebhookSecret(req: IncomingMessage): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  return Boolean(secret && header(req, 'x-telegram-bot-api-secret-token') === secret);
}

export function handleBackendApiRequest(req: IncomingMessage, res: ServerResponse): boolean {
  if (!req.url || !req.url.startsWith('/api/')) return false;

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Bot-Api-Secret-Token, X-Telegram-Admin-Secret');
    res.end();
    return true;
  }

  const reqUrl = new URL(req.url, 'http://localhost:3000');
  const pathname = reqUrl.pathname;

  if (pathname === '/api/latest') {
    const limit = Math.min(Math.max(parseInt(reqUrl.searchParams.get('limit') || '6', 10), 1), 24);
    getRecentVideos(limit).then(videos => {
      sendJson(res, 200, { ok: true, videos: sortVideos(videos, 'newest').slice(0, limit) });
    }).catch(err => sendJson(res, 500, { ok: false, error: err.message }));
    return true;
  }

  if (pathname === '/api/videos' || pathname === '/api/search') {
    const query = (reqUrl.searchParams.get('q') || reqUrl.searchParams.get('search') || '').trim().toLowerCase();
    const page = Math.max(parseInt(reqUrl.searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(reqUrl.searchParams.get('limit') || '8', 10), 1), 24);
    const sort = (reqUrl.searchParams.get('sort') || 'newest') as SortOption;
    const genre = reqUrl.searchParams.get('genre');
    const actress = reqUrl.searchParams.get('actress');
    const studio = reqUrl.searchParams.get('studio');

    (async () => {
      let videos: VideoRecord[] = [];

      if (query) {
        const normalized = normalizeCode(query);
        const exact = await TelegramDb.getVideo(normalized);
        if (exact) {
          const one = await toVideoRecord(exact);
          if (one) videos.push(one);
        } else {
          videos = await getRecentVideos(100);
          videos = videos.filter(v =>
            v.code.toLowerCase().includes(query) ||
            v.title.toLowerCase().includes(query) ||
            v.actresses.some(a => a.toLowerCase().includes(query)) ||
            Boolean(v.studio?.toLowerCase().includes(query)) ||
            v.genres.some(g => g.toLowerCase().includes(query))
          );
        }
      } else {
        videos = await getRecentVideos(100);
      }

      if (genre) videos = videos.filter(v => v.genres.includes(genre));
      if (actress) videos = videos.filter(v => v.actresses.includes(actress));
      if (studio) videos = videos.filter(v => v.studio === studio);

      const sorted = sortVideos(videos, sort);
      const total = sorted.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const start = (page - 1) * limit;

      sendJson(res, 200, {
        ok: true, query, total, page, limit, totalPages,
        videos: sorted.slice(start, start + limit),
        note: 'Catalog listing is backed by a bounded recent index; individual JAV codes use direct lookup.',
      });
    })().catch(err => sendJson(res, 500, { ok: false, error: err.message }));
    return true;
  }

  const singleVideoMatch = pathname.match(/^\/api\/videos\/([^/]+)$/);
  if (singleVideoMatch) {
    const rawCode = decodeURIComponent(singleVideoMatch[1]);
    const normalized = normalizeCode(rawCode);
    TelegramDb.getVideo(normalized).then(async tgRecord => {
      const ghRes = await GithubMetadataService.lookup(normalized);
      if (!tgRecord || !ghRes.metadataFound || !ghRes.video) {
        sendJson(res, 404, { ok: false, error: `Video code '${rawCode}' is not indexed in Telegram and metadata` });
        return;
      }
      sendJson(res, 200, { ok: true, video: await toVideoRecord(tgRecord), related: [], source: 'telegram' });
    }).catch(err => sendJson(res, 500, { ok: false, error: err.message }));
    return true;
  }

  if (pathname === '/api/github/lookup') {
    const code = reqUrl.searchParams.get('code');
    if (!code) { sendJson(res, 400, { ok: false, error: 'Missing code parameter' }); return true; }
    GithubMetadataService.lookup(code).then(result => sendJson(res, 200, { ok: true, ...result }))
      .catch(err => sendJson(res, 500, { ok: false, error: err.message }));
    return true;
  }

  if (pathname === '/api/github/cache-stats') {
    sendJson(res, 200, { ok: true, stats: GithubMetadataService.getCacheStats() });
    return true;
  }

  if (pathname === '/api/actresses' || pathname === '/api/studios' || pathname === '/api/genres') {
    getRecentVideos(100).then(videos => {
      if (pathname === '/api/actresses') {
        const map = new Map<string, number>();
        videos.flatMap(v => v.actresses).forEach(a => map.set(a, (map.get(a) || 0) + 1));
        sendJson(res, 200, { ok: true, actresses: Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => b.count-a.count) });
      } else if (pathname === '/api/studios') {
        const map = new Map<string, number>();
        videos.forEach(v => { if (v.studio) map.set(v.studio, (map.get(v.studio) || 0) + 1); });
        sendJson(res, 200, { ok: true, studios: Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => b.count-a.count) });
      } else {
        sendJson(res, 200, { ok: true, genres: Array.from(new Set(videos.flatMap(v => v.genres))).sort() });
      }
    }).catch(err => sendJson(res, 500, { ok: false, error: err.message }));
    return true;
  }

  if (pathname === '/api/telegram/webhook' && req.method === 'POST') {
    if (!requireTelegramWebhookSecret(req)) {
      sendJson(res, 401, { ok: false, error: 'Unauthorized webhook request' });
      return true;
    }
    parseJsonBody(req).then(async body => {
      if (body.channel_post) return TelegramIndexer.processPost(body.channel_post);
      if (body.message?.chat?.type === 'private' || !body.message?.chat?.type) return TelegramBotService.handlePrivateMessage(body.message);
      if (body.message?.video || body.message?.photo) return TelegramIndexer.processPost(body.message);
      return TelegramIndexer.processUpdate(body);
    }).then(result => sendJson(res, 200, { ok: true, result }))
      .catch(err => sendJson(res, 400, { ok: false, error: err.message }));
    return true;
  }

  if (pathname === '/api/telegram/index-post' && req.method === 'POST') {
    if (!requireAdmin(req)) {
      sendJson(res, 403, { ok: false, error: 'Admin authorization required' });
      return true;
    }
    parseJsonBody(req).then(body => TelegramIndexer.processPost(body))
      .then(result => sendJson(res, 200, { ok: true, result }))
      .catch(err => sendJson(res, 400, { ok: false, error: err.message }));
    return true;
  }

  if (pathname === '/api/telegram/db/videos') {
    const limit = Math.min(Math.max(parseInt(reqUrl.searchParams.get('limit') || '24', 10), 1), 100);
    getRecentVideos(limit).then(videos => sendJson(res, 200, { ok: true, total: videos.length, videos }))
      .catch(err => sendJson(res, 500, { ok: false, error: err.message }));
    return true;
  }

  const tgDbSingleMatch = pathname.match(/^\/api\/telegram\/db\/videos\/([^/]+)$/);
  if (tgDbSingleMatch) {
    const rawCode = decodeURIComponent(tgDbSingleMatch[1]);
    TelegramDb.getVideo(normalizeCode(rawCode)).then(record => {
      if (record) sendJson(res, 200, { ok: true, record });
      else sendJson(res, 404, { ok: false, error: `Code ${rawCode} not found in Telegram index` });
    }).catch(err => sendJson(res, 500, { ok: false, error: err.message }));
    return true;
  }

  const mediaMatch = pathname.match(/^\/api\/media\/([^/]+)\/([^/]+)$/);
  if (mediaMatch) {
    const rawCode = decodeURIComponent(mediaMatch[1]);
    const indexStr = decodeURIComponent(mediaMatch[2]);
    TelegramDb.getVideo(normalizeCode(rawCode)).then(record => {
      if (!record) { sendJson(res, 404, { ok: false, error: 'No media found' }); return; }
      if (indexStr === 'video') {
        sendJson(res, 200, { ok: true, code: record.code, type: 'video' });
        return;
      }
      const idx = Number.parseInt(indexStr, 10);
      const gallery = record.telegram.gallery || [];
      if (!Number.isInteger(idx) || idx < 0 || idx >= gallery.length) {
        sendJson(res, 404, { ok: false, error: 'Gallery item not found' });
        return;
      }
      const fileId = gallery[idx].file_id;
      streamTelegramFile(res, fileId);
    }).catch(err => sendJson(res, 500, { ok: false, error: err.message }));
    return true;
  }

  if (pathname === '/api/telegram/bot/simulate-start' && req.method === 'POST') {
    if (!requireAdmin(req)) { sendJson(res, 403, { ok: false, error: 'Admin authorization required' }); return true; }
    parseJsonBody(req).then(async body => {
      const chatId = body.chat_id || 10001;
      const text = body.text || (body.code ? `/start ${body.code}` : '/start');
      return TelegramBotService.handlePrivateMessage({ chat: { id: chatId, type: 'private' }, text });
    }).then(action => sendJson(res, 200, { ok: true, action }))
      .catch(err => sendJson(res, 400, { ok: false, error: err.message }));
    return true;
  }

  if (pathname === '/api/telegram/file') {
    sendJson(res, 410, { ok: false, error: 'Raw Telegram file_id proxy is disabled. Use /api/media/:code/:index.' });
    return true;
  }

  return false;
}

function streamTelegramFile(res: ServerResponse, fileId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!botToken) { sendJson(res, 503, { ok: false, error: 'Telegram media service is not configured' }); return; }

  https.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`, infoRes => {
    let data = '';
    infoRes.on('data', chunk => data += chunk);
    infoRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (!parsed.ok || !parsed.result?.file_path) { sendJson(res, 404, { ok: false, error: parsed.description || 'Telegram file not found' }); return; }
        https.get(`https://api.telegram.org/file/bot${botToken}/${parsed.result.file_path}`, fileRes => {
          res.statusCode = fileRes.statusCode || 200;
          res.setHeader('Content-Type', fileRes.headers['content-type'] || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          fileRes.pipe(res);
        }).on('error', err => sendJson(res, 502, { ok: false, error: err.message }));
      } catch (e: any) { sendJson(res, 502, { ok: false, error: e.message }); }
    });
  }).on('error', err => sendJson(res, 502, { ok: false, error: err.message }));
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error('Request body exceeds 1MB'));
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try { resolve(JSON.parse(body)); } catch (e: any) { reject(new Error(`Invalid JSON body: ${e.message}`)); }
    });
    req.on('error', reject);
  });
}
