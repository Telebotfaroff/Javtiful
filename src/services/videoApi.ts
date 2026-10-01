import type { VideoRecord, SortOption } from '../types/video.ts';

export interface VideosApiResponse {
  ok: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  videos: VideoRecord[];
  error?: string;
}

export interface SingleVideoApiResponse {
  ok: boolean;
  video?: VideoRecord;
  related?: VideoRecord[];
  error?: string;
}

export interface MetadataListResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export class VideoApiService {
  /**
   * Fetch paginated videos with optional filters (genre, actress, studio, search, sort)
   */
  static async fetchVideos(params: {
    page?: number;
    limit?: number;
    search?: string;
    genre?: string | null;
    actress?: string | null;
    studio?: string | null;
    sort?: SortOption;
  }): Promise<VideosApiResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search) searchParams.set('search', params.search);
    if (params.genre) searchParams.set('genre', params.genre);
    if (params.actress) searchParams.set('actress', params.actress);
    if (params.studio) searchParams.set('studio', params.studio);
    if (params.sort) searchParams.set('sort', params.sort);

    try {
      const res = await fetch(`/api/videos?${searchParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e: any) {
      console.error('VideoApiService.fetchVideos error:', e);
      return {
        ok: false,
        total: 0,
        page: 1,
        limit: params.limit || 8,
        totalPages: 1,
        videos: [],
        error: e.message || 'Failed to fetch videos',
      };
    }
  }

  /**
   * Fetch a single video by code: GET /api/videos/:code
   */
  static async fetchVideoByCode(code: string): Promise<SingleVideoApiResponse> {
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(code)}`);
      const data = await res.json();
      return data;
    } catch (e: any) {
      console.error('VideoApiService.fetchVideoByCode error:', e);
      return {
        ok: false,
        error: e.message || 'Failed to fetch video details',
      };
    }
  }

  /**
   * Server-side search across JAV code, title, actress, and studio: GET /api/search?q=...
   */
  static async search(
    query: string,
    page = 1,
    limit = 8,
    sort: SortOption = 'newest'
  ): Promise<VideosApiResponse> {
    const searchParams = new URLSearchParams({
      q: query,
      page: String(page),
      limit: String(limit),
      sort,
    });

    try {
      const res = await fetch(`/api/search?${searchParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e: any) {
      console.error('VideoApiService.search error:', e);
      return {
        ok: false,
        total: 0,
        page: 1,
        limit,
        totalPages: 1,
        videos: [],
        error: e.message || 'Search request failed',
      };
    }
  }

  /**
   * Fetch latest releases: GET /api/latest?limit=6
   */
  static async fetchLatest(limit = 6): Promise<{ ok: boolean; videos: VideoRecord[] }> {
    try {
      const res = await fetch(`/api/latest?limit=${limit}`);
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('VideoApiService.fetchLatest error:', e);
      return { ok: false, videos: [] };
    }
  }

  /**
   * Fetch actresses with video counts: GET /api/actresses
   */
  static async fetchActresses(): Promise<{ name: string; count: number }[]> {
    try {
      const res = await fetch('/api/actresses');
      const data = await res.json();
      return data.ok && Array.isArray(data.actresses) ? data.actresses : [];
    } catch (e) {
      console.error('VideoApiService.fetchActresses error:', e);
      return [];
    }
  }

  /**
   * Fetch studios with video counts: GET /api/studios
   */
  static async fetchStudios(): Promise<{ name: string; count: number }[]> {
    try {
      const res = await fetch('/api/studios');
      const data = await res.json();
      return data.ok && Array.isArray(data.studios) ? data.studios : [];
    } catch (e) {
      console.error('VideoApiService.fetchStudios error:', e);
      return [];
    }
  }

  /**
   * Fetch unique genres list: GET /api/genres
   */
  static async fetchGenres(): Promise<string[]> {
    try {
      const res = await fetch('/api/genres');
      const data = await res.json();
      return data.ok && Array.isArray(data.genres) ? data.genres : [];
    } catch (e) {
      console.error('VideoApiService.fetchGenres error:', e);
      return [];
    }
  }
}
