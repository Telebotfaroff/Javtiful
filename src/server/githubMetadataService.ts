import https from 'https';

export interface GithubVideoRecord {
  title: string;
  url: string;
  thumb: string;
  duration: string;
  date: string;
  actresses: string[];
  studio: string | null;
  genres: string[];
}

export interface GithubShard {
  total: number;
  videos: Record<string, GithubVideoRecord>;
}

export interface LookupResult {
  code: string;
  prefix: string;
  metadataFound: boolean;
  video?: {
    code: string;
    title: string;
    url: string;
    thumb: string;
    duration: string;
    date: string;
    actresses: string[];
    studio: string | null;
    genres: string[];
  };
  cached?: boolean;
  error?: string;
}

// In-memory cache for prefix shards
interface CacheEntry {
  timestamp: number;
  shard: GithubShard | null; // null represents 404 cached
}

const SHARD_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL for found shards
const NEGATIVE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes TTL for 404s

export class GithubMetadataService {
  private static readonly REPO_BASE =
    'https://raw.githubusercontent.com/Telebotfaroff/javtiful-scraper/main/database/code';

  /**
   * Derive prefix from any JAV code format:
   * 016DHT-0881 -> 016DHT
   * 016dht0881  -> 016DHT
   * 200GANA-2385 -> 200GANA
   * SSIS-892     -> SSIS
   */
  static derivePrefix(rawCode: string): { prefix: string; canonicalCode: string } {
    const trimmed = rawCode.trim().toUpperCase();

    // Case 1: Standard hyphenated format: PREFIX-NUMBER (e.g. 016DHT-0881, 200GANA-2385)
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      const prefix = parts.slice(0, -1).join('-');
      return { prefix, canonicalCode: trimmed };
    }

    // Case 2: Space separated format: PREFIX NUMBER (e.g. "016DHT 0881")
    if (trimmed.includes(' ')) {
      const parts = trimmed.split(/\s+/);
      const prefix = parts.slice(0, -1).join('-');
      const canonicalCode = `${prefix}-${parts[parts.length - 1]}`;
      return { prefix, canonicalCode };
    }

    // Case 3: Joined format without separator (e.g. "016DHT0881" or "SSIS892")
    const match = trimmed.match(/^([A-Z0-9]+?)([0-9]{3,5})$/);
    if (match) {
      const prefix = match[1];
      const canonicalCode = `${prefix}-${match[2]}`;
      return { prefix, canonicalCode };
    }

    return { prefix: trimmed, canonicalCode: trimmed };
  }

  /**
   * Fetch shard JSON from GitHub with in-memory caching and TTL
   */
  static async fetchShard(prefix: string): Promise<{ shard: GithubShard | null; cached: boolean }> {
    const cleanPrefix = prefix.toUpperCase();
    const now = Date.now();

    // Check memory cache
    const existing = SHARD_CACHE.get(cleanPrefix);
    if (existing) {
      const ttl = existing.shard ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
      if (now - existing.timestamp < ttl) {
        return { shard: existing.shard, cached: true };
      }
    }

    // Prefix safety sanitization: alphanumeric and hyphens only
    const sanitizedPrefix = cleanPrefix.replace(/[^A-Z0-9_-]/g, '');
    if (!sanitizedPrefix) {
      return { shard: null, cached: false };
    }

    const shardUrl = `${this.REPO_BASE}/${encodeURIComponent(sanitizedPrefix)}/videos.json`;

    try {
      const jsonText = await new Promise<string>((resolve, reject) => {
        const req = https
          .get(
            shardUrl,
            {
              headers: {
                'User-Agent': 'JAVTIFUL-Catalog-Backend/1.0',
                Accept: 'application/json',
              },
            },
            (res) => {
              if (res.statusCode === 404) {
                // Not found
                resolve('');
                return;
              }
              if (res.statusCode === 429 || res.statusCode === 403) {
                console.warn(`GitHub rate limit hit (HTTP ${res.statusCode}) for prefix ${sanitizedPrefix}`);
                resolve('');
                return;
              }
              if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Follow redirect
                const redirReq = https.get(res.headers.location, (redirRes) => {
                  let d = '';
                  redirRes.on('data', (c) => (d += c));
                  redirRes.on('end', () => resolve(d));
                });
                redirReq.setTimeout(6000, () => {
                  redirReq.destroy(new Error('Redirect request timed out'));
                });
                redirReq.on('error', reject);
                return;
              }
              if (res.statusCode !== 200) {
                console.warn(`GitHub returned HTTP ${res.statusCode} for prefix ${sanitizedPrefix}`);
                resolve('');
                return;
              }
              let data = '';
              res.on('data', (chunk) => (data += chunk));
              res.on('end', () => resolve(data));
            }
          );

        req.setTimeout(6000, () => {
          req.destroy(new Error('GitHub connection timed out (6000ms)'));
        });
        req.on('error', (err) => {
          console.warn(`GitHub network warning for prefix ${sanitizedPrefix}: ${err.message}`);
          resolve('');
        });
      });

      if (!jsonText.trim()) {
        // Shard not found or rate-limited; negative cache
        SHARD_CACHE.set(sanitizedPrefix, { timestamp: now, shard: null });
        return { shard: null, cached: false };
      }

      let parsed: GithubShard;
      try {
        parsed = JSON.parse(jsonText);
      } catch (parseErr: any) {
        console.warn(`Malformed JSON in shard for prefix ${sanitizedPrefix}: ${parseErr.message}`);
        SHARD_CACHE.set(sanitizedPrefix, { timestamp: now, shard: null });
        return { shard: null, cached: false };
      }

      SHARD_CACHE.set(sanitizedPrefix, { timestamp: now, shard: parsed });
      return { shard: parsed, cached: false };
    } catch (e: any) {
      console.warn(`Resilient recovery for prefix ${sanitizedPrefix}:`, e.message);
      return { shard: null, cached: false };
    }
  }

  /**
   * Main lookup entry point:
   * code -> prefix -> GitHub shard -> videos[code]
   */
  static async lookup(rawCode: string): Promise<LookupResult> {
    const { prefix, canonicalCode } = this.derivePrefix(rawCode);

    if (!prefix) {
      return {
        code: rawCode,
        prefix: '',
        metadataFound: false,
        error: 'Unable to derive prefix from code',
      };
    }

    const { shard, cached } = await this.fetchShard(prefix);

    if (!shard || !shard.videos) {
      return {
        code: canonicalCode,
        prefix,
        metadataFound: false,
        cached,
      };
    }

    // Exact canonical match
    let entry = shard.videos[canonicalCode];

    // Fallback: Case-insensitive match if not found
    if (!entry) {
      const upperTarget = canonicalCode.toUpperCase();
      const matchedKey = Object.keys(shard.videos).find((k) => k.toUpperCase() === upperTarget);
      if (matchedKey) {
        entry = shard.videos[matchedKey];
      }
    }

    if (!entry) {
      return {
        code: canonicalCode,
        prefix,
        metadataFound: false,
        cached,
      };
    }

    return {
      code: canonicalCode,
      prefix,
      metadataFound: true,
      cached,
      video: {
        code: canonicalCode,
        title: entry.title || canonicalCode,
        url: entry.url || '',
        thumb: entry.thumb || '',
        duration: entry.duration || '00:00:00',
        date: entry.date || '',
        actresses: Array.isArray(entry.actresses) ? entry.actresses : [],
        studio: entry.studio || null,
        genres: Array.isArray(entry.genres) ? entry.genres : [],
      },
    };
  }

  /**
   * Diagnostic helper to inspect cache statistics
   */
  static getCacheStats(): { size: number; prefixes: string[] } {
    return {
      size: SHARD_CACHE.size,
      prefixes: Array.from(SHARD_CACHE.keys()),
    };
  }

  /**
   * Clear cache for testing
   */
  static clearCache(): void {
    SHARD_CACHE.clear();
  }
}
