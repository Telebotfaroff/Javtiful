import React from 'react';
import { Send, Eye, Clock, Calendar } from 'lucide-react';
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
  const telegramDeepLink = `https://t.me/${botUsername}?start=${encodeURIComponent(video.code)}`;

  return (
    <article
      onClick={() => onOpenDetails(video)}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[#1f293d] bg-[#111827] transition-all duration-200 hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-950/20 cursor-pointer"
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
        {video.thumb ? (
          <img
            src={video.thumb}
            alt={video.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-104"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950/40 text-slate-500">
            <div className="text-center p-4">
              <span className="font-mono text-sm font-bold text-slate-400 block">{video.code}</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Video Indexed</span>
            </div>
          </div>
        )}

        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-transparent opacity-80" />

        {/* JAV Code Badge */}
        <div className="absolute top-2.5 left-2.5 rounded-md bg-black/80 px-2 py-0.5 text-xs font-mono font-bold text-white border border-white/10 backdrop-blur-xs">
          {video.code}
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded bg-black/80 px-2 py-0.5 text-[11px] font-mono text-slate-200 backdrop-blur-xs">
          <Clock className="h-3 w-3 text-slate-400" />
          <span>{video.duration}</span>
        </div>

        {/* Hover Quick Actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(video);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 text-xs font-semibold backdrop-blur-xs transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Details</span>
          </button>

          <a
            href={telegramDeepLink}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Get original video in Telegram bot"
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 text-xs font-bold shadow-md transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            <span>GET VIDEO</span>
          </a>
        </div>
      </div>

      {/* Metadata & Title Container */}
      <div className="flex flex-1 flex-col p-4">
        {/* Title */}
        <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-rose-400 transition-colors mb-2">
          {video.title}
        </h3>

        {/* Actress and Studio (Unboxed Metadata) */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2 truncate">
          <span className="font-medium text-rose-300 truncate max-w-[130px]">
            {video.actresses.length > 0 ? video.actresses.join(', ') : 'Exclusive Cast'}
          </span>
          {video.studio && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400 truncate max-w-[120px]">{video.studio}</span>
            </>
          )}
        </div>

        {/* Footer info: Date & Genres */}
        <div className="mt-auto pt-2.5 border-t border-[#1f293d] flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1 font-mono">
            <Calendar className="h-3 w-3 text-slate-600" />
            {video.date}
          </span>

          {video.genres.length > 0 && (
            <span className="text-slate-400 truncate max-w-[120px]">
              {video.genres[0]}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
