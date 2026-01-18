import React from 'react';
import { Check } from 'lucide-react';

interface MapCardProps {
  title: string;
  description: string;
  mode: string;
  isActive: boolean;
  onClick: () => void;
}

const MapCard: React.FC<MapCardProps> = ({ title, description, isActive, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer rounded-lg p-5 border-2 transition-all duration-300 ${
        isActive
          ? 'border-primary bg-primary/10 glow-primary'
          : 'border-border bg-black/30 hover:border-primary/50 hover:-translate-y-1'
      }`}
    >
      {isActive && (
        <div className="absolute top-3 right-3 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
          <Check size={16} strokeWidth={3} />
        </div>
      )}
      
      <h3 className="font-orbitron font-bold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
};

export default MapCard;
