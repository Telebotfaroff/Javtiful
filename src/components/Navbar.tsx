import React, { useState } from 'react';
import { Search, Film, Users, Building2, Tag, Menu, X, Send, Sparkles, Activity } from 'lucide-react';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectActress: (actress: string | null) => void;
  onSelectStudio: (studio: string | null) => void;
  onSelectGenre: (genre: string | null) => void;
  onResetFilters: () => void;
  onOpenActressesList: () => void;
  onOpenStudiosList: () => void;
  onOpenGenresList: () => void;
  onOpenDiagnostics?: () => void;
  botUsername?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onResetFilters,
  onOpenActressesList,
  onOpenStudiosList,
  onOpenGenresList,
  onOpenDiagnostics,
  botUsername = 'JavtifulBot',
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inputVal, setInputVal] = useState(searchQuery);

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(inputVal);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1f293d] bg-[#0b0f19]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-3">
          <button
            onClick={onResetFilters}
            className="flex items-center gap-2 text-left group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-rose-600 to-rose-400 text-white shadow-md shadow-rose-900/30">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white group-hover:text-rose-400 transition-colors">
                JAVTIFUL
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-wider text-rose-400/90 border border-rose-500/30 px-1.5 py-0.5 rounded">
                Catalog
              </span>
            </div>
          </button>
        </div>

        {/* Global Search Bar */}
        <form
          onSubmit={handleSubmitSearch}
          className="flex-1 max-w-md hidden md:block"
        >
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by code (e.g. 016DHT-0881), actress, studio..."
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                onSearchChange(e.target.value);
              }}
              className="w-full rounded-lg border border-[#1f293d] bg-[#111827] pl-10 pr-9 py-2 text-xs text-white placeholder-slate-400 focus:border-rose-500 focus:outline-hidden focus:ring-1 focus:ring-rose-500 transition-colors"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => {
                  setInputVal('');
                  onSearchChange('');
                }}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
        </form>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-300">
          <button
            onClick={onResetFilters}
            className="hover:text-white transition-colors"
          >
            Latest Releases
          </button>
          <button
            onClick={onOpenActressesList}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span>Actresses</span>
          </button>
          <button
            onClick={onOpenStudiosList}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span>Studios</span>
          </button>
          <button
            onClick={onOpenGenresList}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Tag className="h-3.5 w-3.5 text-slate-400" />
            <span>Genres</span>
          </button>
        </nav>

        {/* Telegram Delivery Bot Pill, Status & Mobile Button */}
        <div className="flex items-center gap-2.5">
          {onOpenDiagnostics && (
            <button
              onClick={onOpenDiagnostics}
              title="View Neon DB & Telegram Webhook Status"
              className="flex items-center gap-1.5 rounded-lg bg-gray-800/80 border border-gray-700/80 px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">System Status</span>
            </button>
          )}

          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noreferrer"
            title="Telegram Video Delivery Bot"
            className="hidden sm:flex items-center gap-2 rounded-lg bg-[#0088CC]/15 border border-[#0088CC]/30 px-3 py-1.5 text-xs font-medium text-[#38bdf8] hover:bg-[#0088CC]/25 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Telegram Bot</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </a>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#111827] transition-colors"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#1f293d] bg-[#0e1422] px-4 py-4 space-y-3">
          {/* Mobile Search */}
          <form onSubmit={handleSubmitSearch} className="mb-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search code, actress, studio..."
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  onSearchChange(e.target.value);
                }}
                className="w-full rounded-lg border border-[#1f293d] bg-[#111827] pl-10 pr-9 py-2 text-xs text-white placeholder-slate-400"
              />
            </div>
          </form>

          <div className="grid grid-cols-2 gap-2 text-xs font-medium">
            <button
              onClick={() => {
                onResetFilters();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[#111827] text-white hover:bg-rose-500/20 text-left"
            >
              <Sparkles className="h-4 w-4 text-rose-400" />
              <span>Latest Releases</span>
            </button>
            <button
              onClick={() => {
                onOpenActressesList();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[#111827] text-white hover:bg-rose-500/20 text-left"
            >
              <Users className="h-4 w-4 text-rose-400" />
              <span>Actresses</span>
            </button>
            <button
              onClick={() => {
                onOpenStudiosList();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[#111827] text-white hover:bg-rose-500/20 text-left"
            >
              <Building2 className="h-4 w-4 text-rose-400" />
              <span>Studios</span>
            </button>
            <button
              onClick={() => {
                onOpenGenresList();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[#111827] text-white hover:bg-rose-500/20 text-left"
            >
              <Tag className="h-4 w-4 text-rose-400" />
              <span>Genres</span>
            </button>
          </div>

          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg bg-[#0088CC] px-4 py-2.5 text-xs font-semibold text-white mt-2"
          >
            <Send className="h-4 w-4" />
            <span>Open Telegram Delivery Bot</span>
          </a>
        </div>
      )}
    </header>
  );
};
