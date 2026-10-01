import React from 'react';
import { Send, Eye, Clock, Calendar, Building, Sparkles } from 'lucide-react';
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

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#1f293d] bg-[#111827] mb-10 shadow-2xl">
      {/* Background Image with Cinematic Scrim */}
      <div className="absolute inset-0 z-0">
        <img
          src={video.thumb}
          alt={video.title}
          className="h-full w-full object-cover opacity-25 filter blur-xs scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f19] via-[#0b0f19]/90 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6 sm:gap-8">
        {/* Cover Preview Card */}
        <div
          onClick={() => onOpenDetails(video)}
          className="group relative aspect-[3/4] w-44 sm:w-52 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/10 shadow-xl transition-transform duration-300 hover:scale-102"
        >
          <img
            src={video.thumb}
            alt={video.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
              <Eye className="h-3.5 w-3.5" />
              <span>Details</span>
            </span>
          </div>
          {/* Duration overlay badge */}
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-[11px] font-mono text-white backdrop-blur-xs">
            {video.duration}
          </div>
        </div>

        {/* Text and Actions */}
        <div className="flex-1 space-y-3.5">
          {/* Spotlight Tag */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-md">
              <Sparkles className="h-3 w-3" />
              Featured Release
            </span>
            <span className="text-xs font-mono font-bold text-white bg-slate-800/90 border border-slate-700 px-2 py-0.5 rounded">
              {video.code}
            </span>
          </div>

          {/* Title */}
          <h2
            onClick={() => onOpenDetails(video)}
            className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight cursor-pointer hover:text-rose-400 transition-colors line-clamp-2"
          >
            {video.title}
          </h2>

          {/* Unboxed Metadata (Zero-pill discipline) */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-300">
            {video.actresses.length > 0 && (
              <span className="font-semibold text-rose-300">
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
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              {video.duration}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              {video.date}
            </span>
          </div>

          {/* Genres */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {video.genres.map((g) => (
              <span
                key={g}
                className="text-[11px] text-slate-400 bg-white/5 border border-white/5 px-2 py-0.5 rounded"
              >
                {g}
              </span>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* Primary GET VIDEO button */}
            <a
              href={telegramDeepLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white px-5 py-2.5 text-xs font-bold shadow-lg shadow-rose-900/30 transition-all active:scale-98"
            >
              <Send className="h-4 w-4" />
              <span>GET VIDEO ON TELEGRAM</span>
            </a>

            <button
              onClick={() => onOpenDetails(video)}
              className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 px-4 py-2.5 text-xs font-semibold transition-colors"
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
