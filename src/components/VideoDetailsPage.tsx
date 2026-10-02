import React, { useState } from 'react';
import {
  ArrowLeft,
  Send,
  Copy,
  Check,
  Clock,
  Calendar,
  Building,
  Users,
  Tag,
  Maximize2,
  ExternalLink,
  ShieldCheck,
  Layers,
  Film,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import type { VideoRecord } from '../types/video.ts';
import { VideoCard } from './VideoCard.tsx';

interface VideoDetailsPageProps {
  video: VideoRecord;
  onBack: () => void;
  onSelectVideo: (video: VideoRecord) => void;
  onSelectActress: (actress: string) => void;
  onSelectStudio: (studio: string) => void;
  onSelectGenre: (genre: string) => void;
  relatedVideos: VideoRecord[];
  onOpenLightbox: (imageUrl: string, index: number) => void;
  botUsername?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function formatDurationSec(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const VideoDetailsPage: React.FC<VideoDetailsPageProps> = ({
  video,
  onBack,
  onSelectVideo,
  onSelectActress,
  onSelectStudio,
  onSelectGenre,
  relatedVideos,
  onOpenLightbox,
  botUsername = 'JavtifulBot',
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const telegramDeepLink = `https://t.me/${botUsername}?start=${encodeURIComponent(video.code)}`;
  const videoParts = video.telegram?.videos || [];
  const galleryItems = (video.gallery || []).filter(Boolean);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(video.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyDeepLink = () => {
    navigator.clipboard.writeText(telegramDeepLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200 max-w-6xl mx-auto">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between border-b border-[#1e2433] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl bg-[#161b26] border border-[#1e2433] px-4 py-2 text-xs font-semibold text-[#38bdf8] hover:text-white hover:border-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Catalog</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 rounded-xl border border-[#1e2433] bg-[#161b26] px-3.5 py-2 text-xs text-slate-300 hover:text-white transition-colors font-mono"
          >
            {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedCode ? 'Copied' : video.code}</span>
          </button>
        </div>
      </div>

      {/* Main High-Resolution Preview Banner (Image based, no fake video player) */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[#1e2433] bg-black shadow-2xl group">
        {video.thumb ? (
          <img
            src={video.thumb}
            alt={video.title}
            className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-500"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-950 via-[#161b26] to-[#ff2a7a]/20">
            <span className="font-mono text-3xl font-bold text-white">{video.code}</span>
          </div>
        )}

        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

        {/* Top-Right Expand Fullscreen Preview */}
        {video.thumb && (
          <button
            onClick={() => onOpenLightbox(video.thumb, 0)}
            className="absolute top-4 right-4 flex items-center gap-1.5 rounded-xl bg-black/70 hover:bg-black/90 px-3 py-2 text-xs font-medium text-white backdrop-blur-xs transition-colors border border-white/10 z-10"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>View Full Image</span>
          </button>
        )}

        {/* Bottom Overlay Info */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white z-10">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs bg-black/80 backdrop-blur-xs px-2.5 py-1 rounded-md border border-white/10">
              {video.code}
            </span>
            <span className="bg-[#ff2a7a] text-white font-bold px-2 py-0.5 rounded text-[11px]">
              HD Quality
            </span>
            {galleryItems.length > 0 && (
              <span className="bg-black/80 backdrop-blur-xs px-2 py-0.5 rounded text-[11px] text-slate-300 border border-white/10 flex items-center gap-1">
                <ImageIcon className="h-3 w-3 text-[#38bdf8]" />
                <span>{galleryItems.length} Gallery Photos</span>
              </span>
            )}
          </div>
          {video.duration && video.duration !== 'N/A' && (
            <div className="font-mono text-xs bg-black/80 backdrop-blur-xs px-3 py-1 rounded-md border border-white/10">
              {video.duration}
            </div>
          )}
        </div>
      </div>

      {/* Video Title & Tag Badges */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-black text-sm text-[#ff2a7a] bg-[#ff2a7a]/15 border border-[#ff2a7a]/30 px-3 py-1 rounded-lg">
            {video.code}
          </span>
          <span className="text-xs font-bold text-white bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md">
            HD 1080p
          </span>
          {videoParts.length > 1 && (
            <span className="text-xs font-bold text-white bg-indigo-600/90 border border-indigo-400/30 px-2.5 py-1 rounded-md flex items-center gap-1">
              <Layers className="h-3 w-3" />
              <span>{videoParts.length} Parts</span>
            </span>
          )}
          {video.studio && (
            <button
              onClick={() => onSelectStudio(video.studio!)}
              className="text-xs font-medium text-slate-300 hover:text-white bg-[#161b26] border border-[#1e2433] px-2.5 py-1 rounded-md transition-colors"
            >
              {video.studio}
            </button>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white leading-snug">
          {video.title}
        </h1>
      </div>

      {/* Full-Width Hot Pink Primary CTA Button (Telegram Bot Media Delivery) */}
      <a
        href={telegramDeepLink}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-3 w-full rounded-2xl bg-[#ff2a7a] hover:bg-[#ff1a70] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#ff2a7a]/30 transition-all duration-200 active:scale-98"
      >
        <Send className="h-5 w-5" />
        <span>{videoParts.length > 1 ? 'GET ALL VIDEO PARTS ON TELEGRAM' : 'GET VIDEO ON TELEGRAM'}</span>
        <ExternalLink className="h-4 w-4 opacity-80" />
      </a>

      {/* Multi-Part Video Releases Module (If multiple video files detected) */}
      {videoParts.length > 1 && (
        <div className="rounded-2xl border border-[#1e2433] bg-[#161b26] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-[#ff2a7a]" />
              <span>Detected Video Parts ({videoParts.length} Files)</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total {video.duration}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {videoParts.map((part, pIdx) => {
              const partNum = pIdx + 1;
              const partLink = `https://t.me/${botUsername}?start=${encodeURIComponent(video.code)}_part${partNum}`;
              const resolution = part.width && part.height ? `${part.width}x${part.height}` : 'HD';
              const size = formatBytes(part.file_size);
              const dur = formatDurationSec(part.duration);

              return (
                <div
                  key={part.file_id || pIdx}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#0d111a] border border-[#1e2433] hover:border-[#ff2a7a]/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Film className="h-3.5 w-3.5 text-[#ff2a7a]" />
                      <span className="text-xs font-bold text-white">
                        {part.label || `Part ${partNum}`}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                        {resolution}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono space-x-2">
                      {dur && <span>{dur}</span>}
                      {size && <span>• {size}</span>}
                    </div>
                  </div>

                  <a
                    href={partLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#ff2a7a] hover:bg-[#ff1a70] text-xs font-bold text-white transition-colors shadow-sm"
                  >
                    <Send className="h-3 w-3" />
                    <span>Get Part {partNum}</span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2-Column Split: Metadata Table on Left, Cover Poster on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
        {/* Left Column: Key-Value Metadata Table */}
        <div className="lg:col-span-8 rounded-2xl border border-[#1e2433] bg-[#161b26] p-6 divide-y divide-[#1e2433] text-xs space-y-0">
          <div className="pb-3 text-sm font-bold text-white flex items-center gap-2">
            <div className="h-4 w-1 rounded-full bg-[#ff2a7a]" />
            <span>Information & Metadata</span>
          </div>

          {/* Code */}
          <div className="py-3 flex items-center justify-between gap-4">
            <span className="text-slate-400 font-medium">Code:</span>
            <span className="font-mono font-bold text-pink-400">{video.code}</span>
          </div>

          {/* Actresses */}
          <div className="py-3 flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-400 font-medium">
              <Users className="h-4 w-4 text-[#ff2a7a]" />
              <span>Actress / Cast:</span>
            </span>
            <div className="flex flex-wrap gap-2 justify-end">
              {video.actresses.length > 0 ? (
                video.actresses.map((actress) => (
                  <button
                    key={actress}
                    onClick={() => onSelectActress(actress)}
                    className="font-bold text-[#ff2a7a] hover:underline transition-colors bg-[#ff2a7a]/10 px-2.5 py-0.5 rounded-md border border-[#ff2a7a]/25"
                  >
                    {actress}
                  </button>
                ))
              ) : (
                <span className="text-slate-500">Exclusive Cast</span>
              )}
            </div>
          </div>

          {/* Studio */}
          {video.studio && (
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-slate-400 font-medium">
                <Building className="h-4 w-4 text-[#38bdf8]" />
                <span>Studio:</span>
              </span>
              <button
                onClick={() => onSelectStudio(video.studio!)}
                className="font-semibold text-slate-200 hover:text-white transition-colors"
              >
                {video.studio}
              </button>
            </div>
          )}

          {/* Duration */}
          <div className="py-3 flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-400 font-medium">
              <Clock className="h-4 w-4 text-amber-400" />
              <span>Duration:</span>
            </span>
            <span className="font-mono text-slate-200">{video.duration}</span>
          </div>

          {/* Release Date */}
          <div className="py-3 flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-400 font-medium">
              <Calendar className="h-4 w-4 text-emerald-400" />
              <span>Release Date:</span>
            </span>
            <span className="font-mono text-slate-200">{video.date}</span>
          </div>

          {/* Genres */}
          {video.genres.length > 0 && (
            <div className="py-3 flex items-start justify-between gap-4">
              <span className="flex items-center gap-2 text-slate-400 font-medium pt-1">
                <Tag className="h-4 w-4 text-purple-400" />
                <span>Genres:</span>
              </span>
              <div className="flex flex-wrap gap-1.5 justify-end max-w-md">
                {video.genres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => onSelectGenre(genre)}
                    className="rounded-lg bg-[#0d111a] border border-[#1e2433] px-2.5 py-1 text-[11px] text-slate-300 hover:text-white hover:border-[#ff2a7a]/50 transition-colors"
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Vertical Cover Poster Preview */}
        <div className="lg:col-span-4 space-y-3">
          <div className="group relative overflow-hidden rounded-2xl border border-[#1e2433] bg-[#161b26] shadow-2xl">
            {video.thumb ? (
              <img
                src={video.thumb}
                alt={video.title}
                className="w-full object-cover transition-transform duration-300 group-hover:scale-102"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-[#ff2a7a]/20 text-center p-6">
                <span className="font-mono text-xl font-bold text-slate-300">{video.code}</span>
              </div>
            )}

            {video.thumb && (
              <button
                onClick={() => onOpenLightbox(video.thumb, 0)}
                title="Expand cover"
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-xs hover:bg-black transition-colors border border-white/10"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Zoom Poster</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section: Screenshots & Post Gallery */}
      {galleryItems.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-[#1e2433]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-[#ff2a7a]" />
              <div>
                <h2 className="text-base font-bold text-white">Screenshots & Gallery</h2>
                <p className="text-xs text-slate-400">
                  {galleryItems.length} previews available
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono bg-[#161b26] px-3 py-1 rounded-full border border-[#1e2433]">
              {galleryItems.length} photos
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {galleryItems.map((img, idx) => (
              <div
                key={idx}
                onClick={() => onOpenLightbox(img, idx)}
                className="group relative aspect-[16/10] overflow-hidden rounded-xl border border-[#1e2433] bg-[#161b26] cursor-pointer shadow-md hover:border-[#ff2a7a]/50 transition-all hover:scale-102"
              >
                <img
                  src={img}
                  alt={`Screenshot ${idx + 1}`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="h-5 w-5 text-white" />
                </div>
                <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-slate-300 border border-white/10">
                  #{idx + 1}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section: Related Videos */}
      {relatedVideos.length > 0 && (
        <section className="space-y-5 pt-8 border-t border-[#1e2433]">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-[#ff2a7a]" />
            <div>
              <h2 className="text-base font-bold text-white">Related Releases</h2>
              <p className="text-xs text-slate-400">
                More releases with {video.actresses[0] || video.studio || 'similar genres'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {relatedVideos.slice(0, 4).map((rel) => (
              <VideoCard
                key={rel.code}
                video={rel}
                onOpenDetails={onSelectVideo}
                botUsername={botUsername}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
