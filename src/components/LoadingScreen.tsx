import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center gap-5 z-[9999]">
      <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin" />
      <span className="font-orbitron text-primary text-lg">{message}</span>
    </div>
  );
};

export default LoadingScreen;
