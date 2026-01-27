import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ 
        marginLeft: '260px', 
        flex: 1, 
        padding: '2.5rem',
        maxWidth: 'calc(100vw - 260px)'
      }}>
        <Outlet />
      </main>
    </div>
  );
}
