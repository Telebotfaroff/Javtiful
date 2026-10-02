/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { HeroBanner } from './components/HeroBanner.tsx';
import { VideoCard } from './components/VideoCard.tsx';
import { FilterBar } from './components/FilterBar.tsx';
import { Pagination } from './components/Pagination.tsx';
import { VideoDetailsPage } from './components/VideoDetailsPage.tsx';
import { GalleryLightbox } from './components/GalleryLightbox.tsx';
import { ActressesModal, StudiosModal, GenresModal } from './components/BrowseModals.tsx';
import { Footer } from './components/Footer.tsx';
import { VideoApiService } from './services/videoApi.ts';
import type { VideoRecord, SortOption } from './types/video.ts';
import { Film, RefreshCw, Loader2 } from 'lucide-react';

export default function App() {
  // Catalog Data from Backend API
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [featuredVideo, setFeaturedVideo] = useState<VideoRecord | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<VideoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  // Metadata Lists from Backend API
  const [actressesList, setActressesList] = useState<{ name: string; count: number }[]>([]);
  const [studiosList, setStudiosList] = useState<{ name: string; count: number }[]>([]);
  const [genresList, setGenresList] = useState<string[]>([]);

  // Navigation Tabs & Filters
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActress, setSelectedActress] = useState<string | null>(null);
  const [selectedStudio, setSelectedStudio] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals & Lightbox
  const [isActressesOpen, setIsActressesOpen] = useState(false);
  const [isStudiosOpen, setIsStudiosOpen] = useState(false);
  const [isGenresOpen, setIsGenresOpen] = useState(false);
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    images: string[];
    index: number;
  }>({
    isOpen: false,
    images: [],
    index: 0,
  });

  const [botUsername, setBotUsername] = useState('Javhdpro6_bot');

  // Load Metadata Lists (Actresses, Studios, Genres) and Featured Video on Mount
  useEffect(() => {
    async function loadInitialMetadata() {
      try {
        const [actresses, studios, genres, latestRes, statusRes] = await Promise.all([
          VideoApiService.fetchActresses(),
          VideoApiService.fetchStudios(),
          VideoApiService.fetchGenres(),
          VideoApiService.fetchLatest(1),
          fetch('/api/system/status').then(r => r.json()).catch(() => null),
        ]);
        setActressesList(actresses);
        setStudiosList(studios);
        setGenresList(genres);
        if (statusRes?.telegram?.bot_info?.username) {
          setBotUsername(statusRes.telegram.bot_info.username);
        }
        if (latestRes.ok && latestRes.videos.length > 0) {
          setFeaturedVideo(latestRes.videos[0]);
        }
      } catch (e) {
        console.error('Failed to load initial metadata', e);
      }
    }
    loadInitialMetadata();
  }, []);

  // Fetch Videos from Backend API when filters, search, sort, or page change
  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      if (searchQuery.trim()) {
        const res = await VideoApiService.search(
          searchQuery.trim(),
          currentPage,
          itemsPerPage,
          sortOption
        );
        if (res.ok) {
          setVideos(res.videos);
          setTotalCount(res.total);
          setTotalPages(res.totalPages);
        }
      } else {
        const res = await VideoApiService.fetchVideos({
          page: currentPage,
          limit: itemsPerPage,
          genre: selectedGenre,
          actress: selectedActress,
          studio: selectedStudio,
          sort: sortOption,
        });
        if (res.ok) {
          setVideos(res.videos);
          setTotalCount(res.total);
          setTotalPages(res.totalPages);
        }
      }
    } catch (e) {
      console.error('Failed to load videos from API', e);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, currentPage, itemsPerPage, selectedGenre, selectedActress, selectedStudio, sortOption]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Load single video details from Backend API by Code
  const loadVideoDetails = useCallback(async (code: string) => {
    setIsDetailsLoading(true);
    try {
      const res = await VideoApiService.fetchVideoByCode(code);
      if (res.ok && res.video) {
        setSelectedVideo(res.video);
        setRelatedVideos(res.related || []);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) {
      console.error('Failed to load video details', e);
    } finally {
      setIsDetailsLoading(false);
    }
  }, []);

  // Synchronize hash routing (e.g. #video/016DHT-0881) for natural browser Back/Forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#video/')) {
        const code = decodeURIComponent(hash.replace('#video/', ''));
        loadVideoDetails(code);
      } else if (hash === '' || hash === '#catalog') {
        setSelectedVideo(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [loadVideoDetails]);

  const handleOpenDetails = useCallback((video: VideoRecord) => {
    setSelectedVideo(video);
    window.location.hash = `video/${video.code}`;
    loadVideoDetails(video.code);
  }, [loadVideoDetails]);

  const handleBackToCatalog = useCallback(() => {
    setSelectedVideo(null);
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleResetFilters = useCallback(() => {
    setActiveTab('home');
    setSearchQuery('');
    setSelectedActress(null);
    setSelectedStudio(null);
    setSelectedGenre(null);
    setSortOption('newest');
    setCurrentPage(1);
    setSelectedVideo(null);
    window.location.hash = '';
  }, []);

  const handleSelectTab = (tab: string) => {
    setActiveTab(tab);
    setSelectedVideo(null);
    window.location.hash = '';
    if (tab === 'popular') {
      setSortOption('duration');
    } else if (tab === 'latest') {
      setSortOption('newest');
    } else {
      setSortOption('newest');
    }
    setCurrentPage(1);
  };

  // Lightbox handlers
  const handleOpenLightbox = (imageUrl: string, index: number) => {
    if (selectedVideo?.gallery && selectedVideo.gallery.length > 0) {
      setLightboxState({
        isOpen: true,
        images: [selectedVideo.thumb, ...selectedVideo.gallery],
        index: index,
      });
    } else {
      setLightboxState({
        isOpen: true,
        images: [imageUrl],
        index: 0,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0d111a] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[#ff2a7a] selection:text-white">
      {/* Global Navigation Bar */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        onSelectActress={(actress) => {
          setSelectedActress(actress);
          setCurrentPage(1);
        }}
        onSelectStudio={(studio) => {
          setSelectedStudio(studio);
          setCurrentPage(1);
        }}
        onSelectGenre={(genre) => {
          setSelectedGenre(genre);
          setCurrentPage(1);
        }}
        onResetFilters={handleResetFilters}
        onOpenActressesList={() => setIsActressesOpen(true)}
        onOpenStudiosList={() => setIsStudiosOpen(true)}
        onOpenGenresList={() => setIsGenresOpen(true)}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        botUsername={botUsername}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {selectedVideo ? (
          /* View 1: Dedicated Video Details Page */
          isDetailsLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-[#ff2a7a] mb-3" />
              <span className="text-xs">Loading video details from API...</span>
            </div>
          ) : (
            <VideoDetailsPage
              video={selectedVideo}
              onBack={handleBackToCatalog}
              onSelectVideo={handleOpenDetails}
              onSelectActress={(actress) => {
                setSelectedActress(actress);
                handleBackToCatalog();
              }}
              onSelectStudio={(studio) => {
                setSelectedStudio(studio);
                handleBackToCatalog();
              }}
              onSelectGenre={(genre) => {
                setSelectedGenre(genre);
                handleBackToCatalog();
              }}
              relatedVideos={relatedVideos}
              onOpenLightbox={handleOpenLightbox}
              botUsername={botUsername}
            />
          )
        ) : (
          /* View 2: Video Catalog Grid & Featured Hero */
          <>
            {/* Show Featured Spotlight when on Home tab and no active search/filters */}
            {activeTab === 'home' && !searchQuery && !selectedActress && !selectedStudio && !selectedGenre && featuredVideo && (
              <HeroBanner
                video={featuredVideo}
                onOpenDetails={handleOpenDetails}
                botUsername={botUsername}
              />
            )}

            {/* Filter, Search, and Sort Bar */}
            <FilterBar
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
              selectedActress={selectedActress}
              onClearActress={() => setSelectedActress(null)}
              selectedStudio={selectedStudio}
              onClearStudio={() => setSelectedStudio(null)}
              selectedGenre={selectedGenre}
              onClearGenre={() => setSelectedGenre(null)}
              sortOption={sortOption}
              onSortChange={(sort) => {
                setSortOption(sort);
                setCurrentPage(1);
              }}
              totalCount={totalCount}
              allGenres={genresList}
              onSelectGenre={(genre) => {
                setSelectedGenre(genre);
                setCurrentPage(1);
              }}
            />

            {/* Video Cards Grid with Loading Indicator */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-[#ff2a7a] mb-3" />
                <span className="text-xs">Fetching catalog records from backend API...</span>
              </div>
            ) : videos.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {videos.map((video) => (
                  <VideoCard
                    key={video.code}
                    video={video}
                    onOpenDetails={handleOpenDetails}
                    botUsername={botUsername}
                  />
                ))}
              </div>
            ) : (
              /* Empty Search Results */
              <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1e2433] bg-[#161b26] py-16 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-slate-400 mb-4">
                  <Film className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-white">No Releases Found</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-md">
                  No video records found matching your criteria. Check the code formatting (e.g. <code className="font-mono text-pink-400">016DHT-0881</code>) or reset your active filters.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-5 flex items-center gap-1.5 rounded-xl bg-[#ff2a7a] hover:bg-[#ff1a70] px-4 py-2.5 text-xs font-semibold text-white transition-colors shadow-md shadow-[#ff2a7a]/25"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            )}

            {/* Server-Side Pagination Controls */}
            {!isLoading && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  window.scrollTo({ top: 380, behavior: 'smooth' });
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Footer matching reference theme */}
      <Footer botUsername={botUsername} />

      {/* Screenshot & Cover Fullscreen Lightbox */}
      <GalleryLightbox
        images={lightboxState.images}
        initialIndex={lightboxState.index}
        isOpen={lightboxState.isOpen}
        onClose={() => setLightboxState({ isOpen: false, images: [], index: 0 })}
      />

      {/* Actresses Browser Modal */}
      <ActressesModal
        isOpen={isActressesOpen}
        onClose={() => setIsActressesOpen(false)}
        actressCounts={actressesList}
        onSelectActress={(actress) => {
          setSelectedActress(actress);
          setSelectedVideo(null);
          setCurrentPage(1);
        }}
      />

      {/* Studios Browser Modal */}
      <StudiosModal
        isOpen={isStudiosOpen}
        onClose={() => setIsStudiosOpen(false)}
        studioCounts={studiosList}
        onSelectStudio={(studio) => {
          setSelectedStudio(studio);
          setSelectedVideo(null);
          setCurrentPage(1);
        }}
      />

      {/* Genres Browser Modal */}
      <GenresModal
        isOpen={isGenresOpen}
        onClose={() => setIsGenresOpen(false)}
        genres={genresList}
        onSelectGenre={(genre) => {
          setSelectedGenre(genre);
          setSelectedVideo(null);
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
