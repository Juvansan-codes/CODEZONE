import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, User, BarChart2, Trophy, Zap, Settings, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const menuItems = [
  { path: '/lobby', label: 'Lobby', icon: Home },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/challenges', label: 'Challenges', icon: Zap },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isCollapsed, onToggleCollapse }) => {
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
        className={`fixed left-0 top-[70px] h-[calc(100vh-70px)] bg-surface border-r border-border py-4 z-50 transition-all duration-300 flex flex-col justify-between ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 ${isCollapsed ? 'w-[70px]' : 'w-[250px]'}`}
      >
        {/* Top/Main links */}
        <div className="flex flex-col flex-1">
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 md:hidden text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>

          {/* Minimize toggle at the top (near Lobby) */}
          <div className="hidden md:flex justify-end px-4 pb-3 border-b border-border/40 mb-3">
            <button
              onClick={onToggleCollapse}
              className={`p-1.5 rounded-lg border border-border bg-background/50 hover:bg-primary/10 hover:border-primary/50 text-muted-foreground hover:text-primary transition-all ${
                isCollapsed ? 'mx-auto' : ''
              }`}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          {/* Nav links */}
          <nav className="space-y-1">
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
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {!isCollapsed && <span className="font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Settings button at the bottom */}
        <div className="border-t border-border/40 pt-3">
          <Link
            to="/settings"
            onClick={onClose}
            className={`flex items-center gap-3 px-6 py-4 border-l-[3px] transition-all ${
              location.pathname === '/settings'
                ? 'bg-primary/15 border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:bg-primary/10 hover:border-primary/50'
            } ${isCollapsed ? 'justify-center px-0' : ''}`}
            title={isCollapsed ? "Settings" : undefined}
          >
            <Settings size={20} className="flex-shrink-0" />
            {!isCollapsed && <span className="font-medium">Settings</span>}
          </Link>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
