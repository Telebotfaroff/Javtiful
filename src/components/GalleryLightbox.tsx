import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface GalleryLightboxProps {
  images: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export const GalleryLightbox: React.FC<GalleryLightboxProps> = ({
  images,
  initialIndex,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
  }, [initialIndex, isOpen]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setZoom(1);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setZoom(1);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, images.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  if (!isOpen || images.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Top Header Controls */}
      <div
        className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-black/40 text-white shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs font-mono text-slate-400">
          Preview {currentIndex + 1} of {images.length}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.3, 3))}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.3, 0.7))}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          {zoom !== 1 && (
            <button
              onClick={() => setZoom(1)}
              className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
              title="Reset Zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          <div className="h-4 w-px bg-white/10 mx-2" />

          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex flex-1 items-center justify-center p-4 overflow-hidden select-none">
        {currentIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/90 transition-transform active:scale-95"
            title="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {currentIndex < images.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/90 transition-transform active:scale-95"
            title="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <div
          className="relative max-h-full max-w-full transition-transform duration-150 ease-out"
          style={{ transform: `scale(${zoom})` }}
          onClick={(e) => e.stopPropagation()}
        >
          {images[currentIndex] ? (
            <img
              src={images[currentIndex]}
              alt={`Gallery item ${currentIndex + 1}`}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
