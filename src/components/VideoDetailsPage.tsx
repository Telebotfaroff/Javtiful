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
    <div className="space-y-10 animate-in fade-in duration-200">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between border-b border-[#1f293d] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg bg-[#111827] border border-[#1f293d] px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#1a2336] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Catalog</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 rounded-lg border border-[#1f293d] bg-[#111827] px-3 py-1.5 text-xs text-slate-300 hover:text-white transition-colors"
          >
            {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="font-mono">{copiedCode ? 'Copied Code' : video.code}</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout: Cover Column & Info Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Large Cover Image */}
        <div className="lg:col-span-5 space-y-4">
          <div className="group relative overflow-hidden rounded-2xl border border-[#1f293d] bg-slate-900 shadow-2xl">
            {video.thumb ? (
              <img
                src={video.thumb}
                alt={video.title}
                className="w-full object-cover transition-transform duration-300 group-hover:scale-102"
              />
            ) : (
              <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950/40 text-center p-6">
                <div>
                  <span className="font-mono text-2xl font-bold text-slate-300 block">{video.code}</span>
                  <span className="text-xs text-slate-500 mt-1 block">Media available via Telegram bot</span>
                </div>
              </div>
            )}

            {/* Click to inspect cover in lightbox */}
            {video.thumb && (
              <button
                onClick={() => onOpenLightbox(video.thumb, 0)}
                title="Expand cover"
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-xs hover:bg-black/90 transition-colors"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Full Cover</span>
              </button>
            )}

            {/* JAV Code Tag */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <div className="rounded-md bg-black/80 px-2.5 py-1 text-xs font-mono font-bold text-white border border-white/10 backdrop-blur-xs">
                {video.code}
              </div>
              {videoParts.length > 1 && (
                <div className="flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-xs font-bold text-white shadow-md">
                  <Layers className="h-3 w-3" />
                  <span>{videoParts.length} Video Files</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Title, Multi-Parts, CTA, Details */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded bg-rose-500/20 border border-rose-500/30 px-2.5 py-1 text-xs font-mono font-bold text-rose-400">
                {video.code}
              </span>
              {video.studio && (
                <button
                  onClick={() => onSelectStudio(video.studio!)}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {video.studio}
                </button>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug">
              {video.title}
            </h1>
          </div>

          {/* Primary CTA Section: GET VIDEO */}
          <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/40 via-[#111827] to-[#111827] p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="h-4 w-4 text-rose-400" />
                  <span>
                    {videoParts.length > 1
                      ? `Deliver ${videoParts.length} Video Parts in Telegram`
                      : 'Deliver Original Media in Telegram'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Clicking the button launches the automated Telegram bot with code <code className="font-mono text-rose-300">{video.code}</code>. The bot streams all {videoParts.length > 1 ? `${videoParts.length} video parts and` : ''} high-definition media directly to your chat.
                </p>
              </div>

              {/* Primary GET VIDEO Button */}
              <a
                href={telegramDeepLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-950/50 transition-all active:scale-98 shrink-0"
              >
                <Send className="h-4 w-4" />
                <span>{videoParts.length > 1 ? 'GET ALL PARTS' : 'GET VIDEO'}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </a>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Deep link: @{botUsername}?start={video.code}</span>
              </div>
              <button
                onClick={handleCopyDeepLink}
                className="hover:text-white transition-colors underline"
              >
                {copiedLink ? 'Link Copied!' : 'Copy Telegram Link'}
              </button>
            </div>
          </div>

          {/* Multi-Part Video Releases List (If multiple videos detected for this code) */}
          {videoParts.length > 1 && (
            <div className="rounded-xl border border-[#1f293d] bg-[#111827] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                  <Layers className="h-4 w-4" />
                  <span>Detected Video Parts ({videoParts.length} Files)</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Total {video.duration}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {videoParts.map((part, pIdx) => {
                  const partNum = pIdx + 1;
                  const partLink = `https://t.me/${botUsername}?start=${encodeURIComponent(video.code)}_part${partNum}`;
                  const resolution = part.width && part.height ? `${part.width}x${part.height}` : 'HD';
                  const size = formatBytes(part.file_size);
                  const dur = formatDurationSec(part.duration);

                  return (
                    <div
                      key={part.file_id || pIdx}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-900/80 border border-gray-800 hover:border-rose-500/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Film className="h-3.5 w-3.5 text-rose-400" />
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
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-rose-600/80 hover:bg-rose-500 text-[11px] font-semibold text-white transition-colors"
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

          {/* Metadata Grid */}
          <div className="rounded-xl border border-[#1f293d] bg-[#111827] p-5 divide-y divide-[#1f293d] text-xs">
            {/* Actresses */}
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-slate-400 font-medium">
                <Users className="h-4 w-4 text-rose-400" />
                <span>Actresses:</span>
              </span>
              <div className="flex flex-wrap gap-2 justify-end">
                {video.actresses.length > 0 ? (
                  video.actresses.map((actress) => (
                    <button
                      key={actress}
                      onClick={() => onSelectActress(actress)}
                      className="font-semibold text-rose-300 hover:underline hover:text-white transition-colors"
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
              <div className="py-2.5 flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-400 font-medium">
                  <Building className="h-4 w-4 text-blue-400" />
                  <span>Studio / Label:</span>
                </span>
                <button
                  onClick={() => onSelectStudio(video.studio!)}
                  className="font-semibold text-blue-300 hover:underline hover:text-white transition-colors"
                >
                  {video.studio}
                </button>
              </div>
            )}

            {/* Duration */}
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-slate-400 font-medium">
                <Clock className="h-4 w-4 text-amber-400" />
                <span>Duration:</span>
              </span>
              <span className="font-mono text-slate-200">{video.duration}</span>
            </div>

            {/* Release Date */}
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-slate-400 font-medium">
                <Calendar className="h-4 w-4 text-emerald-400" />
                <span>Release Date:</span>
              </span>
              <span className="font-mono text-slate-200">{video.date}</span>
            </div>

            {/* Genres */}
            {video.genres.length > 0 && (
              <div className="py-2.5 flex items-start justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-400 font-medium pt-1">
                  <Tag className="h-4 w-4 text-purple-400" />
                  <span>Genres:</span>
                </span>
                <div className="flex flex-wrap gap-1.5 justify-end max-w-md">
                  {video.genres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => onSelectGenre(genre)}
                      className="rounded bg-[#0b0f19] border border-[#1f293d] px-2.5 py-1 text-[11px] text-slate-300 hover:text-white hover:border-rose-500/50 transition-colors"
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Screenshots & Post Gallery (Supports 6+ images) */}
      {galleryItems.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-[#1f293d]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-rose-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Screenshots & Post Gallery</h2>
                <p className="text-xs text-slate-400">
                  {galleryItems.length} photos detected from Telegram channel stream
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
              {galleryItems.length} items
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {galleryItems.map((img, idx) => (
              <div
                key={idx}
                onClick={() => onOpenLightbox(img, idx)}
                className="group relative aspect-[16/10] overflow-hidden rounded-xl border border-[#1f293d] bg-slate-900 cursor-pointer shadow-md hover:border-rose-500/50 transition-all hover:scale-102"
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
                <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-slate-300">
                  #{idx + 1}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section: Related Videos */}
      {relatedVideos.length > 0 && (
        <section className="space-y-5 pt-8 border-t border-[#1f293d]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Related Releases</h2>
              <p className="text-xs text-slate-400">
                More videos featuring {video.actresses[0] || video.studio || 'similar themes'}
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
