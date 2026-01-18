import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { Link } from 'react-router-dom';

interface CurrencyItemProps {
  icon: string;
  value: number;
  showAdd?: boolean;
  onAdd?: () => void;
}

const CurrencyItem: React.FC<CurrencyItemProps> = ({ icon, value, showAdd, onAdd }) => (
  <div className="flex items-center gap-2 bg-surface px-3 py-2 rounded-full border border-border">
    <span className="text-lg">{icon}</span>
    <span className="font-semibold text-sm min-w-[40px]">{value.toLocaleString()}</span>
    {showAdd && (
      <button
        onClick={onAdd}
        className="w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold hover:scale-110 transition-transform"
      >
        +
      </button>
    )}
  </div>
);

const TopBar: React.FC = () => {
  const { gameData, addCoins, addGems } = useGame();

  return (
    <header className="fixed top-0 left-0 right-0 h-[70px] bg-surface/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-6 z-50">
      {/* Currency */}
      <div className="flex gap-2 md:gap-4">
        <CurrencyItem icon="🪙" value={gameData.coins} showAdd onAdd={() => addCoins(100)} />
        <CurrencyItem icon="💎" value={gameData.gems} showAdd onAdd={() => addGems(50)} />
        <div className="hidden sm:flex">
          <CurrencyItem icon="⚡" value={gameData.energy} />
        </div>
      </div>

      {/* Profile */}
      <Link to="/profile" className="flex items-center gap-3">
        <div className="hidden md:block">
          <div className="bg-accent px-3 py-1 rounded-full text-sm font-semibold">
            ⭐ {gameData.level}
          </div>
        </div>
        <span className="font-semibold text-sm hidden sm:block">{gameData.username}</span>
        <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg">
          {gameData.username.substring(0, 2).toUpperCase()}
        </div>
      </Link>
    </header>
  );
};

export default TopBar;
