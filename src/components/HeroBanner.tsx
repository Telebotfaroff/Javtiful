import React from 'react';
import { Send, Eye, Clock, Calendar, Building, Sparkles, Flame, Maximize2 } from 'lucide-react';
import type { VideoRecord } from '../types/video.ts';

interface HeroBannerProps {
  video: VideoRecord;
  onOpenDetails: (video: VideoRecord) => void;
  botUsername?: string;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  video,
  onOpenDetails,
  botUsername = 'JavtifulBot',
}) => {
  const telegramDeepLink = `https://t.me/${botUsername}?start=${encodeURIComponent(video.code)}`;
  const videoPartsCount = video.telegram?.videos?.length || 0;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#1e2433] bg-[#161b26] mb-10 shadow-2xl shadow-black/60 group">
      {/* Background Banner with Cinematic Blur Scrim */}
      <div className="absolute inset-0 z-0">
        {video.thumb ? (
          <img
            src={video.thumb}
            alt={video.title}
            className="h-full w-full object-cover opacity-20 filter blur-md scale-110"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-[#ff2a7a]/20 via-[#161b26] to-[#0d111a]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#161b26] via-[#161b26]/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#161b26] via-[#161b26]/90 to-transparent" />
      </div>

      {/* Content Grid */}
      <div className="relative z-10 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6 sm:gap-8">
        {/* Cover Preview Card */}
        <div
          onClick={() => onOpenDetails(video)}
          className="group/thumb relative aspect-[16/10] sm:aspect-[3/4] w-full md:w-56 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl transition-all duration-300 hover:scale-102 hover:border-[#ff2a7a]/50"
        >
          {video.thumb ? (
            <img
              src={video.thumb}
              alt={video.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-[#ff2a7a]/20 text-center p-4">
              <span className="font-mono text-base font-bold text-slate-300">{video.code}</span>
            </div>
          )}

          {/* Hover Inspect Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
            <span className="flex items-center gap-1.5 rounded-xl bg-black/80 px-3 py-1.5 text-xs font-semibold text-white border border-white/10 backdrop-blur-xs">
              <Eye className="h-3.5 w-3.5 text-[#ff2a7a]" />
              <span>View Details</span>
            </span>
          </div>

          {/* Duration overlay badge */}
          {video.duration && video.duration !== 'N/A' && (
            <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/85 px-2 py-0.5 text-[11px] font-mono text-white backdrop-blur-xs border border-white/10">
              {video.duration}
            </div>
          )}
        </div>

        {/* Text and Actions */}
        <div className="flex-1 space-y-4">
          {/* Spotlight Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-white bg-[#ff2a7a] px-2.5 py-1 rounded-md shadow-sm shadow-[#ff2a7a]/30">
              <Flame className="h-3 w-3 fill-white" />
              Featured Release
            </span>
            <span className="text-xs font-mono font-bold text-[#ff2a7a] bg-[#ff2a7a]/15 border border-[#ff2a7a]/30 px-2.5 py-1 rounded-md">
              {video.code}
            </span>
            {videoPartsCount > 1 && (
              <span className="text-[11px] font-bold text-white bg-indigo-600/90 border border-indigo-400/30 px-2 py-0.5 rounded-md">
                {videoPartsCount} Parts
              </span>
            )}
          </div>

          {/* Title */}
          <h2
            onClick={() => onOpenDetails(video)}
            className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight cursor-pointer hover:text-[#ff2a7a] transition-colors line-clamp-2"
          >
            {video.title}
          </h2>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-300">
            {video.actresses.length > 0 && (
              <span className="font-semibold text-[#ff2a7a]">
                {video.actresses.join(', ')}
              </span>
            )}
            {video.studio && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Building className="h-3.5 w-3.5" />
                  {video.studio}
                </span>
              </>
            )}
            {video.duration && video.duration !== 'N/A' && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="flex items-center gap-1 text-slate-400 font-mono">
                  <Clock className="h-3.5 w-3.5" />
                  {video.duration}
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="flex items-center gap-1 text-slate-400 font-mono">
              <Calendar className="h-3.5 w-3.5" />
              {video.date}
            </span>
          </div>

          {/* Genres */}
          {video.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {video.genres.slice(0, 6).map((g) => (
                <span
                  key={g}
                  className="text-[11px] text-slate-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* Primary Hot Pink Button */}
            <a
              href={telegramDeepLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#ff2a7a] hover:bg-[#ff1a70] text-white px-5 py-3 text-xs font-bold shadow-lg shadow-[#ff2a7a]/35 transition-all active:scale-98"
            >
              <Send className="h-4 w-4" />
              <span>GET VIDEO ON TELEGRAM</span>
            </a>

            <button
              onClick={() => onOpenDetails(video)}
              className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 px-4 py-3 text-xs font-semibold transition-colors"
            >
              <Eye className="h-4 w-4 text-slate-300" />
              <span>View Details & Gallery</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
