import React, { useState, useRef, useEffect } from 'react';

interface CharacterViewerProps {
  className?: string;
}

export const CharacterViewer: React.FC<CharacterViewerProps> = ({ className }) => {
  const [loading, setLoading] = useState(true);
  const modelRef = useRef<HTMLElement>(null);
  const basePath = import.meta.env.BASE_URL || '/';
  // Use URL encoded spaces to prevent potential asset loading failures
  const glbUrl = `${basePath}characters/man%20with%20black%20jacket%203d%20model_Clone1.glb`;

  useEffect(() => {
    const el = modelRef.current;
    if (!el) return;

    const handleLoad = () => {
      setLoading(false);
    };

    el.addEventListener('load', handleLoad);
    return () => {
      el.removeEventListener('load', handleLoad);
    };
  }, []);

  return (
    <div className={`relative w-full h-full min-h-[200px] flex items-center justify-center overflow-hidden bg-black/20 rounded-lg ${className}`}>
      {/* Loading Skeleton / Overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10 transition-opacity duration-300">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-2 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin shadow-glow"></div>
          </div>
          <p className="mt-3 font-orbitron text-xs text-primary font-bold tracking-widest animate-pulse">
            LOADING OPERATIVE...
          </p>
        </div>
      )}

      {/* 3D Model Viewer */}
      <model-viewer
        ref={modelRef}
        src={glbUrl}
        alt="3D Character Operator"
        camera-controls
        auto-rotate
        shadow-intensity="1.5"
        exposure="1.0"
        autoplay
        style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
      />
    </div>
  );
};

export default CharacterViewer;
