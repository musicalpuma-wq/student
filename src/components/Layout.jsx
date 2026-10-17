import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { FloatingTimer } from './FloatingTimer';

export function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sms_sidebar_collapsed') === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('sms_sidebar_collapsed', sidebarCollapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [sidebarCollapsed]);

  const sidebarWidth = sidebarCollapsed ? '76px' : '260px';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      <main style={{
        marginLeft: sidebarWidth,
        flex: 1,
        padding: '2.5rem',
        maxWidth: `calc(100vw - ${sidebarWidth})`,
        transition: 'margin-left 0.25s ease, max-width 0.25s ease'
      }}>
        <Outlet />
      </main>
      <FloatingTimer />
    </div>
  );
}
