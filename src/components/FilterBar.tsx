import React from 'react';
import { SlidersHorizontal, X, ArrowUpDown } from 'lucide-react';
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
}) => {
  const hasActiveFilters = Boolean(searchQuery || selectedActress || selectedStudio || selectedGenre);

  return (
    <div className="mb-8 space-y-4">
      {/* Top row: Results count and Sort control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111827] p-3 rounded-xl border border-[#1f293d]">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-white">Catalog</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400 font-mono">
            {totalCount} {totalCount === 1 ? 'video' : 'videos'} available
          </span>
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Sort:</span>
          <select
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="rounded-lg border border-[#1f293d] bg-[#0b0f19] px-2.5 py-1.5 text-xs text-white focus:border-rose-500 focus:outline-hidden"
          >
            <option value="newest">Latest Release</option>
            <option value="oldest">Oldest Release</option>
            <option value="code_asc">Code (A → Z)</option>
            <option value="code_desc">Code (Z → A)</option>
            <option value="duration">Longest Duration</option>
          </select>
        </div>
      </div>

      {/* Genre Pills Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          onClick={() => onSelectGenre(null)}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
            selectedGenre === null
              ? 'bg-rose-600 text-white'
              : 'bg-[#111827] text-slate-400 hover:text-white border border-[#1f293d]'
          }`}
        >
          All Genres
        </button>
        {allGenres.slice(0, 10).map((g) => (
          <button
            key={g}
            onClick={() => onSelectGenre(g)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedGenre === g
                ? 'bg-rose-600 text-white'
                : 'bg-[#111827] text-slate-400 hover:text-white border border-[#1f293d]'
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
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-slate-200 border border-white/10">
              <span>Search: "{searchQuery}"</span>
              <button onClick={onClearSearch} className="hover:text-rose-400">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedActress && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/20 text-rose-300 px-2.5 py-1 border border-rose-500/30">
              <span>Actress: {selectedActress}</span>
              <button onClick={onClearActress} className="hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedStudio && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/20 text-blue-300 px-2.5 py-1 border border-blue-500/30">
              <span>Studio: {selectedStudio}</span>
              <button onClick={onClearStudio} className="hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedGenre && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 text-emerald-300 px-2.5 py-1 border border-emerald-500/30">
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
