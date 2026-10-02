export interface TelegramVideoPart {
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

export interface VideoRecord {
  code: string;           // Canonical JAV code (e.g. ADN-557, 016DHT-0881, SSIS-892)
  title: string;          // Video title
  url?: string;           // javtiful.com video URL
  thumb: string;          // Main thumbnail / cover image URL
  duration: string;       // Duration string (e.g. "01:58:30" or "02:10:00")
  date: string;           // Release date (YYYY-MM-DD)
  actresses: string[];    // Array of actress names
  studio: string | null;  // Studio / Label name
  genres: string[];       // Genres list
  gallery?: string[];     // Screenshot URLs for post gallery
  telegram?: {
    channel_id?: string;
    message_id?: number;
    video_file_id?: string;
    duration?: number;
    width?: number;
    height?: number;
    file_size?: number;
    mime_type?: string;
    videos?: TelegramVideoPart[]; // Multi-part videos for this release
  };
}

export type SortOption = 'newest' | 'oldest' | 'code_asc' | 'code_desc' | 'duration';

export interface FilterState {
  search: string;
  actress: string | null;
  studio: string | null;
  genre: string | null;
  sort: SortOption;
  page: number;
  limit: number;
}
