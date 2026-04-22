import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';

type AudioTrack = 'lobby' | 'story' | 'battle' | 'victory' | 'defeat';
type SoundEffect = 'click' | 'hover' | 'success' | 'error' | 'notification' | 'sabotage' | 'countdown';

interface AudioConfig {
  lobby: string;
  story: string;
  battle: string;
  victory: string;
  defeat: string;
}

interface SFXConfig {
  click: string;
  hover: string;
  success: string;
  error: string;
  notification: string;
  sabotage: string;
  countdown: string;
}

// Default placeholder paths - replace with your actual audio files
const DEFAULT_MUSIC: AudioConfig = {
  lobby: '/audio/music/lobby.mp3',
  story: '/audio/music/story.mp3',
  battle: '/audio/music/battle.mp3',
  victory: '/audio/music/victory.mp3',
  defeat: '/audio/music/defeat.mp3',
};

const DEFAULT_SFX: SFXConfig = {
  click: '/audio/sfx/click.mp3',
  hover: '/audio/sfx/hover.mp3',
  success: '/audio/sfx/success.mp3',
  error: '/audio/sfx/error.mp3',
  notification: '/audio/sfx/notification.mp3',
  sabotage: '/audio/sfx/sabotage.mp3',
  countdown: '/audio/sfx/countdown.mp3',
};

export const useAudioManager = () => {
  const { settings } = useGame();
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const sfxRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  
  const musicConfig = useRef<AudioConfig>(DEFAULT_MUSIC);
  const sfxConfig = useRef<SFXConfig>(DEFAULT_SFX);

  // Initialize audio elements
  useEffect(() => {
    const sfxMap = sfxRefs.current;

    // Create music element
    musicRef.current = new Audio();
    musicRef.current.loop = true;
    
    // Preload common SFX
    Object.entries(DEFAULT_SFX).forEach(([key, path]) => {
      const audio = new Audio();
      audio.preload = 'auto';
      // Don't set src until we have actual files
      sfxMap.set(key, audio);
    });

    setAudioLoaded(true);

    return () => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current = null;
      }
      sfxMap.forEach(audio => {
        audio.pause();
      });
      sfxMap.clear();
    };
  }, []);

  // Update volume when settings change
  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.volume = settings.bgmEnabled ? settings.musicVolume / 100 : 0;
    }
  }, [settings.musicVolume, settings.bgmEnabled]);

  // Play background music
  const playMusic = useCallback((track: AudioTrack) => {
    if (!musicRef.current || !settings.bgmEnabled) return;

    const trackPath = musicConfig.current[track];
    
    // Only change if different track
    if (currentTrack !== track) {
      musicRef.current.pause();
      musicRef.current.src = trackPath;
      musicRef.current.volume = settings.musicVolume / 100;
      
      musicRef.current.play().catch(err => {
        // Audio autoplay might be blocked - this is normal
        console.log('Music playback pending user interaction');
      });
      
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  }, [currentTrack, settings.bgmEnabled, settings.musicVolume]);

  // Stop music
  const stopMusic = useCallback(() => {
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTrack(null);
  }, []);

  // Pause music
  const pauseMusic = useCallback(() => {
    if (musicRef.current) {
      musicRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  // Resume music
  const resumeMusic = useCallback(() => {
    if (musicRef.current && currentTrack) {
      musicRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentTrack]);

  // Play sound effect
  const playSFX = useCallback((effect: SoundEffect) => {
    if (!settings.sfxEnabled) return;

    const audio = sfxRefs.current.get(effect);
    if (audio) {
      audio.volume = settings.sfxVolume / 100;
      audio.currentTime = 0;
      audio.play().catch(() => {
        // SFX might fail silently
      });
    }
  }, [settings.sfxEnabled, settings.sfxVolume]);

  // Configure custom music paths
  const setMusicPaths = useCallback((paths: Partial<AudioConfig>) => {
    musicConfig.current = { ...musicConfig.current, ...paths };
  }, []);

  // Configure custom SFX paths
  const setSFXPaths = useCallback((paths: Partial<SFXConfig>) => {
    sfxConfig.current = { ...sfxConfig.current, ...paths };
    
    // Update audio element sources
    Object.entries(paths).forEach(([key, path]) => {
      const audio = sfxRefs.current.get(key);
      if (audio && path) {
        audio.src = path;
      }
    });
  }, []);

  // Fade out music
  const fadeOut = useCallback((duration: number = 1000) => {
    if (!musicRef.current) return;

    const startVolume = musicRef.current.volume;
    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = startVolume / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      if (musicRef.current) {
        musicRef.current.volume = Math.max(0, startVolume - (volumeStep * currentStep));
      }
      
      if (currentStep >= steps) {
        clearInterval(interval);
        stopMusic();
      }
    }, stepDuration);
  }, [stopMusic]);

  // Fade in music
  const fadeIn = useCallback((track: AudioTrack, duration: number = 1000) => {
    if (!musicRef.current || !settings.bgmEnabled) return;

    const targetVolume = settings.musicVolume / 100;
    musicRef.current.volume = 0;
    playMusic(track);

    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = targetVolume / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      if (musicRef.current) {
        musicRef.current.volume = Math.min(targetVolume, volumeStep * currentStep);
      }
      
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);
  }, [playMusic, settings.bgmEnabled, settings.musicVolume]);

  return {
    currentTrack,
    isPlaying,
    audioLoaded,
    playMusic,
    stopMusic,
    pauseMusic,
    resumeMusic,
    playSFX,
    fadeIn,
    fadeOut,
    setMusicPaths,
    setSFXPaths,
  };
};

// Export types for external use
export type { AudioTrack, SoundEffect, AudioConfig, SFXConfig };
