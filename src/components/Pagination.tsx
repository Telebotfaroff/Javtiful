import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="mt-12 flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className="flex items-center gap-1 rounded-lg border border-[#1f293d] bg-[#111827] px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-[#1a2336] disabled:opacity-40 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Previous</span>
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
              currentPage === p
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-[#111827] text-slate-400 hover:text-white hover:bg-[#1a2336] border border-[#1f293d]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="flex items-center gap-1 rounded-lg border border-[#1f293d] bg-[#111827] px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-[#1a2336] disabled:opacity-40 transition-colors"
      >
        <span>Next</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};
