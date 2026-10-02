import React from 'react';
import { SlidersHorizontal, X, ArrowUpDown, Flame, Film, Layers, Image as ImageIcon } from 'lucide-react';
import type { SortOption } from '../types/video.ts';

interface FilterBarProps {
  searchQuery: string;
  onClearSearch: () => void;
  selectedActress: string | null;
  onClearActress: () => void;
  selectedStudio: string | null;
  onClearStudio: () => void;
  selectedGenre: string | null;
  onClearGenre: () => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  totalCount: number;
  allGenres: string[];
  onSelectGenre: (genre: string | null) => void;
  activeQuickFilter?: string;
  onSelectQuickFilter?: (filter: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onClearSearch,
  selectedActress,
  onClearActress,
  selectedStudio,
  onClearStudio,
  selectedGenre,
  onClearGenre,
  sortOption,
  onSortChange,
  totalCount,
  allGenres,
  onSelectGenre,
  activeQuickFilter = 'all',
  onSelectQuickFilter,
}) => {
  const hasActiveFilters = Boolean(searchQuery || selectedActress || selectedStudio || selectedGenre);

  return (
    <div className="mb-8 space-y-4">
      {/* Top bar: Section Title with Vertical Hot Pink Bar + Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#161b26] p-3.5 rounded-xl border border-[#1e2433]">
        <div className="flex items-center gap-3">
          {/* Vertical Hot Pink Accent Bar matching reference */}
          <div className="h-5 w-1 rounded-full bg-[#ff2a7a]" />
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-wide">
              {searchQuery ? `Search Results for "${searchQuery}"` : 'Latest Videos'}
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              ({totalCount} {totalCount === 1 ? 'item' : 'items'})
            </span>
          </div>
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Sort:</span>
          <select
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="rounded-lg border border-[#1e2433] bg-[#0d111a] px-3 py-1.5 text-xs text-white focus:border-[#ff2a7a] focus:outline-hidden"
          >
            <option value="newest">Latest Releases</option>
            <option value="oldest">Oldest Releases</option>
            <option value="code_asc">Code (A → Z)</option>
            <option value="code_desc">Code (Z → A)</option>
            <option value="duration">Longest Duration</option>
          </select>
        </div>
      </div>

      {/* Genre Pills Row matching reference taxonomy */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          onClick={() => onSelectGenre(null)}
          className={`px-3.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
            selectedGenre === null
              ? 'bg-[#ff2a7a] text-white shadow-md shadow-[#ff2a7a]/30'
              : 'bg-[#161b26] text-slate-300 hover:text-white border border-[#1e2433] hover:border-slate-700'
          }`}
        >
          All Genres
        </button>
        {allGenres.map((g) => (
          <button
            key={g}
            onClick={() => onSelectGenre(g)}
            className={`px-3.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
              selectedGenre === g
                ? 'bg-[#ff2a7a] text-white shadow-md shadow-[#ff2a7a]/30'
                : 'bg-[#161b26] text-slate-300 hover:text-white border border-[#1e2433] hover:border-slate-700'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-slate-500">Active filters:</span>

          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-slate-200 border border-white/10">
              <span>Search: "{searchQuery}"</span>
              <button onClick={onClearSearch} className="hover:text-[#ff2a7a]">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedActress && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff2a7a]/20 text-pink-300 px-2.5 py-1 border border-[#ff2a7a]/30">
              <span>Actress: {selectedActress}</span>
              <button onClick={onClearActress} className="hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedStudio && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/20 text-blue-300 px-2.5 py-1 border border-blue-500/30">
              <span>Studio: {selectedStudio}</span>
              <button onClick={onClearStudio} className="hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedGenre && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff2a7a]/20 text-pink-300 px-2.5 py-1 border border-[#ff2a7a]/30">
              <span>Genre: {selectedGenre}</span>
              <button onClick={onClearGenre} className="hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
