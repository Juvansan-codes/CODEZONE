import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Gate: React.FC = () => {
  const navigate = useNavigate();

  const handleEnter = () => {
    navigate('/lobby');
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center glass-panel p-10 max-w-md mx-4">
        <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-primary mb-4 drop-shadow-[0_0_20px_rgba(104,195,163,0.5)]">
          STUDYGROUND: BATTLEFIELD
        </h2>
        <p className="text-muted-foreground mb-8">Tap to enter CodeZone Lobby</p>
        <Button
          onClick={handleEnter}
          className="gradient-primary text-primary-foreground font-bold px-10 py-6 text-lg glow-primary hover:scale-105 transition-transform"
        >
          ENTER LOBBY
        </Button>
      </div>
    </div>
  );
};

export default Gate;
