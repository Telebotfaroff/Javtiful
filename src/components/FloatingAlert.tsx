import React from 'react';
import { ArrowUp, Sparkles, X } from 'lucide-react';

interface FloatingAlertProps {
  newCount: number;
  channelName?: string;
  onRefreshView: () => void;
  onDismiss: () => void;
}

export const FloatingAlert: React.FC<FloatingAlertProps> = ({
  newCount,
  channelName,
  onRefreshView,
  onDismiss,
}) => {
  if (newCount <= 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="flex items-center gap-2.5 rounded-full border border-[#0088CC]/40 bg-[#0F172A]/95 px-4 py-2 text-xs text-white shadow-xl shadow-[#0088CC]/10 backdrop-blur-md">
        <Sparkles className="h-3.5 w-3.5 text-[#38bdf8] animate-pulse" />
        <button
          onClick={onRefreshView}
          className="flex items-center gap-1.5 font-medium hover:text-[#38bdf8] transition-colors"
        >
          <span>
            {newCount} new {newCount === 1 ? 'post' : 'posts'} {channelName ? `in ${channelName}` : 'received'}
          </span>
          <ArrowUp className="h-3 w-3" />
        </button>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-0.5 rounded-full transition-colors"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
