import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, User, BarChart2, Trophy, Zap, Settings, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { path: '/lobby', label: 'Lobby', icon: Home },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/challenges', label: 'Challenges', icon: Zap },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-[70px] w-[250px] h-[calc(100vh-70px)] bg-surface border-r border-border py-6 z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 md:hidden text-muted-foreground hover:text-foreground"
        >
          <X size={20} />
        </button>

        <div className="px-6 pb-5 border-b border-border">
          <h2 className="font-orbitron text-xl font-bold text-primary">CODEZONE</h2>
        </div>

        <nav className="mt-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-6 py-4 border-l-[3px] transition-all ${
                  isActive
                    ? 'bg-primary/15 border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:bg-primary/10 hover:border-primary/50'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
