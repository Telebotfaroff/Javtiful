import React from 'react';
import { X, Users, Building2, Tag } from 'lucide-react';

interface ActressesModalProps {
  isOpen: boolean;
  onClose: () => void;
  actressCounts: { name: string; count: number }[];
  onSelectActress: (actress: string) => void;
}

export const ActressesModal: React.FC<ActressesModalProps> = ({
  isOpen,
  onClose,
  actressCounts,
  onSelectActress,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#1f293d] bg-[#111827] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1f293d] px-6 py-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Users className="h-4 w-4 text-rose-400" />
            <span>Browse by Actress</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto grid grid-cols-2 gap-2 text-xs">
          {actressCounts.map(({ name, count }) => (
            <button
              key={name}
              onClick={() => {
                onSelectActress(name);
                onClose();
              }}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#0b0f19] hover:bg-rose-500/20 text-slate-200 hover:text-white border border-[#1f293d] transition-colors text-left"
            >
              <span className="font-medium truncate mr-2">{name}</span>
              <span className="font-mono text-[11px] text-slate-500">{count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface StudiosModalProps {
  isOpen: boolean;
  onClose: () => void;
  studioCounts: { name: string; count: number }[];
  onSelectStudio: (studio: string) => void;
}

export const StudiosModal: React.FC<StudiosModalProps> = ({
  isOpen,
  onClose,
  studioCounts,
  onSelectStudio,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#1f293d] bg-[#111827] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1f293d] px-6 py-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Building2 className="h-4 w-4 text-blue-400" />
            <span>Browse by Studio / Label</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto grid grid-cols-2 gap-2 text-xs">
          {studioCounts.map(({ name, count }) => (
            <button
              key={name}
              onClick={() => {
                onSelectStudio(name);
                onClose();
              }}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#0b0f19] hover:bg-blue-500/20 text-slate-200 hover:text-white border border-[#1f293d] transition-colors text-left"
            >
              <span className="font-medium truncate mr-2">{name}</span>
              <span className="font-mono text-[11px] text-slate-500">{count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface GenresModalProps {
  isOpen: boolean;
  onClose: () => void;
  genres: string[];
  onSelectGenre: (genre: string) => void;
}

export const GenresModal: React.FC<GenresModalProps> = ({
  isOpen,
  onClose,
  genres,
  onSelectGenre,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#1f293d] bg-[#111827] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1f293d] px-6 py-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Tag className="h-4 w-4 text-purple-400" />
            <span>Browse by Genre</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto flex flex-wrap gap-2 text-xs">
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => {
                onSelectGenre(genre);
                onClose();
              }}
              className="rounded-lg bg-[#0b0f19] border border-[#1f293d] px-3 py-1.5 text-slate-300 hover:text-white hover:border-purple-500 transition-colors"
            >
              {genre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
