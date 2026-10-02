import React, { useState } from 'react';
import { Search, Film, Users, Building2, Tag, Menu, X, Send, Sparkles, Activity, Flame } from 'lucide-react';

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
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
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
  activeTab = 'home',
  onSelectTab,
  botUsername = 'JavtifulBot',
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inputVal, setInputVal] = useState(searchQuery);

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(inputVal);
  };

  const handleTabClick = (tab: string) => {
    if (onSelectTab) onSelectTab(tab);
    if (tab === 'home') onResetFilters();
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1e2433] bg-[#0d111a]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        {/* Brand Logo matching reference */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => handleTabClick('home')}
            className="flex items-center gap-2 text-left group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#ff2a7a] to-[#ff5b99] text-white shadow-md shadow-[#ff2a7a]/25">
              <Film className="h-5 w-5" />
            </div>
            <div className="flex items-center">
              <span className="text-xl font-black tracking-tight text-white">JAV</span>
              <span className="text-xl font-black tracking-tight text-[#ff2a7a]">TIFUL</span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => handleTabClick('home')}
              className={`relative px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'home'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Home</span>
              {activeTab === 'home' && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#ff2a7a]" />
              )}
            </button>

            <button
              onClick={() => handleTabClick('latest')}
              className={`relative px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'latest'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Latest</span>
              {activeTab === 'latest' && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#ff2a7a]" />
              )}
            </button>

            <button
              onClick={() => handleTabClick('popular')}
              className={`relative px-3 py-2 rounded-lg transition-colors flex items-center gap-1 ${
                activeTab === 'popular'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-[#ff2a7a]" />
              <span>Popular</span>
              {activeTab === 'popular' && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#ff2a7a]" />
              )}
            </button>

            <button
              onClick={onOpenActressesList}
              className="flex items-center gap-1 px-3 py-2 text-slate-400 hover:text-white transition-colors"
            >
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>Actresses</span>
            </button>

            <button
              onClick={onOpenStudiosList}
              className="flex items-center gap-1 px-3 py-2 text-slate-400 hover:text-white transition-colors"
            >
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Studios</span>
            </button>

            <button
              onClick={onOpenGenresList}
              className="flex items-center gap-1 px-3 py-2 text-slate-400 hover:text-white transition-colors"
            >
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              <span>Genres</span>
            </button>
          </nav>
        </div>

        {/* Global Search Bar - Dark Pill matching reference */}
        <form
          onSubmit={handleSubmitSearch}
          className="flex-1 max-w-md hidden md:block"
        >
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by code or title..."
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                onSearchChange(e.target.value);
              }}
              className="w-full rounded-full border border-[#1e2433] bg-[#161b26] pl-10 pr-9 py-2 text-xs text-white placeholder-slate-400 focus:border-[#ff2a7a] focus:outline-hidden focus:ring-1 focus:ring-[#ff2a7a] transition-all"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => {
                  setInputVal('');
                  onSearchChange('');
                }}
                className="absolute right-3.5 top-2.5 text-xs text-slate-400 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
        </form>

        {/* Actions & Telegram Delivery Bot Button */}
        <div className="flex items-center gap-2.5">
          {onOpenDiagnostics && (
            <button
              onClick={onOpenDiagnostics}
              title="System Status"
              className="flex items-center gap-1.5 rounded-xl bg-[#161b26] border border-[#1e2433] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
            >
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Status</span>
            </button>
          )}

          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noreferrer"
            title="Telegram Video Delivery Bot"
            className="flex items-center gap-2 rounded-xl bg-[#0088CC]/15 border border-[#0088CC]/35 px-3 py-1.5 text-xs font-semibold text-[#38bdf8] hover:bg-[#0088CC]/25 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Telegram Bot</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </a>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl bg-[#161b26] border border-[#1e2433] transition-colors"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#1e2433] bg-[#0d111a] px-4 py-4 space-y-3">
          {/* Mobile Search */}
          <form onSubmit={handleSubmitSearch} className="mb-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search code or title..."
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  onSearchChange(e.target.value);
                }}
                className="w-full rounded-full border border-[#1e2433] bg-[#161b26] pl-10 pr-9 py-2 text-xs text-white placeholder-slate-400"
              />
            </div>
          </form>

          <div className="grid grid-cols-2 gap-2 text-xs font-medium">
            <button
              onClick={() => handleTabClick('home')}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-[#161b26] text-white hover:bg-[#ff2a7a]/20 text-left border border-[#1e2433]"
            >
              <Sparkles className="h-4 w-4 text-[#ff2a7a]" />
              <span>Home</span>
            </button>
            <button
              onClick={() => handleTabClick('popular')}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-[#161b26] text-white hover:bg-[#ff2a7a]/20 text-left border border-[#1e2433]"
            >
              <Flame className="h-4 w-4 text-[#ff2a7a]" />
              <span>Popular</span>
            </button>
            <button
              onClick={() => {
                onOpenActressesList();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-[#161b26] text-white hover:bg-[#ff2a7a]/20 text-left border border-[#1e2433]"
            >
              <Users className="h-4 w-4 text-[#ff2a7a]" />
              <span>Actresses</span>
            </button>
            <button
              onClick={() => {
                onOpenStudiosList();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-[#161b26] text-white hover:bg-[#ff2a7a]/20 text-left border border-[#1e2433]"
            >
              <Building2 className="h-4 w-4 text-[#ff2a7a]" />
              <span>Studios</span>
            </button>
            <button
              onClick={() => {
                onOpenGenresList();
                setMobileMenuOpen(false);
              }}
              className="col-span-2 flex items-center gap-2 p-2.5 rounded-xl bg-[#161b26] text-white hover:bg-[#ff2a7a]/20 text-left border border-[#1e2433]"
            >
              <Tag className="h-4 w-4 text-[#ff2a7a]" />
              <span>Browse All Genres</span>
            </button>
          </div>

          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#ff2a7a] hover:bg-[#ff1a70] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-[#ff2a7a]/30 mt-2"
          >
            <Send className="h-4 w-4" />
            <span>Open Telegram Delivery Bot</span>
          </a>
        </div>
      )}
    </header>
  );
};
