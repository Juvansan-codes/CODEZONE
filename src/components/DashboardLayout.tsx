import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import { Menu } from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <>
      <TopBar />

      {/* Float buttons for mobile */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed bottom-6 left-6 z-30 md:hidden bg-primary text-primary-foreground px-4 py-3 rounded-full font-semibold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
      >
        <Menu size={18} />
        Menu
      </button>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <main className={`pt-[70px] min-h-screen p-4 md:p-8 transition-all duration-300 ${sidebarCollapsed ? 'md:pl-[70px]' : 'md:pl-[250px]'}`}>
        <Outlet />
      </main>
    </>
  );
};

export default DashboardLayout;
