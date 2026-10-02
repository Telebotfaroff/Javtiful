import React, { useState } from 'react';
import { Send, Eye, Clock, Calendar, Layers, Image as ImageIcon, Heart, Play } from 'lucide-react';
import type { VideoRecord } from '../types/video.ts';

interface VideoCardProps {
  video: VideoRecord;
  onOpenDetails: (video: VideoRecord) => void;
  botUsername?: string;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onOpenDetails,
  botUsername = 'JavtifulBot',
}) => {
  const [isFavorited, setIsFavorited] = useState(false);
  const telegramDeepLink = `https://t.me/${botUsername}?start=${encodeURIComponent(video.code)}`;
  const videoPartsCount = video.telegram?.videos?.length || 0;
  const galleryCount = video.gallery?.length || 0;
  const mediaType = video.media_type || (video.telegram?.videos?.length ? 'video' : galleryCount > 0 ? 'image' : 'video');
  const isImageOnly = mediaType === 'image';
  const isMixed = mediaType === 'mixed';

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorited(!isFavorited);
  };

  return (
    <article
      onClick={() => onOpenDetails(video)}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[#1e2433] bg-[#161b26] transition-all duration-200 hover:border-[#ff2a7a]/50 hover:shadow-xl hover:shadow-black/60 cursor-pointer"
    >
      {/* Thumbnail Container (16:9 / 16:10 ratio) */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
        {video.thumb ? (
          <img
            src={video.thumb}
            alt={video.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-[#ff2a7a]/15 text-slate-500">
            <div className="text-center p-4">
              <span className="font-mono text-sm font-bold text-slate-400 block">{video.code}</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Media Indexed</span>
            </div>
          </div>
        )}

        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#161b26] via-transparent to-transparent opacity-80" />

        {/* Top-Left Code & Parts Badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          <div className="rounded-md bg-black/85 px-2 py-0.5 text-xs font-mono font-bold text-white border border-white/10 backdrop-blur-xs shadow-xs">
            {video.code}
          </div>
          {!isImageOnly && videoPartsCount > 1 && (
            <div className="flex items-center gap-1 rounded-md bg-[#ff2a7a] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              <Layers className="h-2.5 w-2.5" />
              <span>{videoPartsCount} Parts</span>
            </div>
          )}
        </div>

        {/* Top-Right / Bottom-Right Overlays */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
          {galleryCount > 0 && (
            <div className="flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-200 backdrop-blur-xs border border-white/10">
              <ImageIcon className="h-3 w-3 text-[#38bdf8]" />
              <span>{galleryCount}</span>
            </div>
          )}
          {!isImageOnly && (
            <div className="flex items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-mono text-slate-200 backdrop-blur-xs border border-white/10">
              <Clock className="h-3 w-3 text-slate-400" />
              <span>{video.duration}</span>
            </div>
          )}
        </div>

        {/* Favorite Heart Button matching reference (bottom-right on image) */}
        <button
          onClick={toggleFavorite}
          title={isFavorited ? 'Favorited' : 'Add to Favorites'}
          className={`absolute bottom-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-xs transition-transform active:scale-90 border ${
            isFavorited
              ? 'bg-[#ff2a7a] border-[#ff2a7a] text-white'
              : 'bg-black/60 border-white/20 text-white hover:bg-black/80'
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${isFavorited ? 'fill-white' : ''}`} />
        </button>

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3 z-20">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff2a7a] text-white shadow-lg shadow-[#ff2a7a]/50">
            <Play className="h-5 w-5 fill-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Metadata & Title Container */}
      <div className="flex flex-1 flex-col p-3.5 space-y-2">
        {/* Hot Pink Code Label */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-[#ff2a7a] tracking-wide">
            {video.code}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">
            {isMixed ? 'Media' : isImageOnly ? 'Gallery' : 'Video'}
          </span>
        </div>

        {/* Video Title */}
        <h3 className="text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-[#ff2a7a] transition-colors">
          {video.title}
        </h3>

        {/* Tags / Quality Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] font-semibold text-pink-300 bg-[#ff2a7a]/15 border border-[#ff2a7a]/30 px-1.5 py-0.2 rounded">
            HD 1080p
          </span>
          {video.genres.length > 0 && (
            <span className="text-[10px] text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.2 rounded truncate max-w-[90px]">
              {video.genres[0]}
            </span>
          )}
        </div>

        {/* Actress and Studio */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-0.5 truncate">
          <span className="font-medium text-slate-300 truncate max-w-[130px]">
            {video.actresses.length > 0 ? video.actresses.join(', ') : 'Exclusive Cast'}
          </span>
          {video.studio && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400 truncate max-w-[110px]">{video.studio}</span>
            </>
          )}
        </div>

        {/* Footer: Date & Quick Telegram Link */}
        <div className="mt-auto pt-2 border-t border-[#1e2433] flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1 font-mono text-slate-400">
            <Calendar className="h-3 w-3 text-slate-500" />
            {video.date}
          </span>

          <a
            href={telegramDeepLink}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] font-bold text-[#ff2a7a] hover:text-white transition-colors"
          >
            <Send className="h-3 w-3" />
            <span>Get</span>
          </a>
        </div>
      </div>
    </article>
  );
};
