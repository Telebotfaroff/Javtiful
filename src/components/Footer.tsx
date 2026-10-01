import React from 'react';
import { Film, Send, ShieldAlert, Github } from 'lucide-react';

interface FooterProps {
  botUsername?: string;
  onOpenDiagnostics?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ botUsername = 'JavtifulBot', onOpenDiagnostics }) => {
  return (
    <footer className="mt-20 border-t border-[#1f293d] bg-[#0b0f19] py-12 text-xs text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-rose-600 to-rose-400 text-white font-bold text-xs">
                <Film className="h-4 w-4" />
              </div>
              <span className="font-bold text-white text-base">JAVTIFUL</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold border border-slate-700 px-1 rounded">
                Index
              </span>
            </div>
            <p className="text-slate-400 max-w-lg leading-relaxed">
              Automated video catalog and metadata indexer. All video delivery and file transfers are handled exclusively through our Telegram Bot.
            </p>
          </div>

          {/* Telegram bot button & Diagnostics */}
          <div className="flex items-center gap-3">
            {onOpenDiagnostics && (
              <button
                onClick={onOpenDiagnostics}
                className="flex items-center gap-2 rounded-xl bg-gray-800/80 border border-gray-700/80 px-3.5 py-2.5 text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <span>System Status</span>
              </button>
            )}
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#0088CC]/20 border border-[#0088CC]/40 px-4 py-2.5 text-xs font-semibold text-[#38bdf8] hover:bg-[#0088CC]/30 transition-colors"
            >
              <Send className="h-4 w-4" />
              <span>Telegram Bot: @{botUsername}</span>
            </a>
          </div>
        </div>

        {/* Disclaimer box */}
        <div className="rounded-xl border border-white/5 bg-[#111827] p-4 text-[11px] text-slate-400 leading-relaxed flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">Legal Disclaimer: </span>
            This website operates strictly as an information catalog. It does not host, upload, convert, or stream video files. Video records and media identifiers are stored in a private Telegram index, and metadata is indexed from the open-source <code className="font-mono text-slate-300">javtiful-scraper</code> repository.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#1f293d] pt-6 text-[11px] text-slate-500">
          <span>&copy; {new Date().getFullYear()} JAVTIFUL Video Catalog & Telegram Indexer. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <span>English Interface</span>
            <span aria-hidden="true">·</span>
            <span>Metadata: javtiful-scraper</span>
            <span aria-hidden="true">·</span>
            {onOpenDiagnostics && (
              <button
                onClick={onOpenDiagnostics}
                className="hover:text-gray-300 transition-colors underline underline-offset-2"
              >
                System Status & Webhook
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
