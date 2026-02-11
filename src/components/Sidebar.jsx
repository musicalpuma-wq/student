import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FileSpreadsheet, Settings, Download } from 'lucide-react';
import { SettingsModal } from './SettingsModal';
import { useSettings } from '../context/SettingsContext';

export function Sidebar() {
  const { settings, t } = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  
  const navItems = [
    { icon: LayoutDashboard, label: t('dashboard'), path: '/' },
    { icon: Users, label: t('students'), path: '/register' },
    // { icon: FileSpreadsheet, label: 'Reports', path: '/reports' },
  ];

  const handleBackup = () => {
      const data = localStorage.getItem('sms_data_v1');
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 4); // HHmm
      a.download = `backup-${dateStr}-${timeStr}.json`;
      a.click();
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        // Basic validation
        if (json.students && json.activities) {
          localStorage.setItem('sms_data_v1', JSON.stringify(json));
          alert('Data restored successfully! The page will reload.');
          window.location.reload();
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        alert('Error parsing JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
    <aside style={{
      width: '260px',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      background: 'var(--color-bg-card)', // Changed to card bg for better theme support
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid var(--color-border)',
      padding: '2rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100
    }}>
      <div style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <img src="/logo-note.png" alt="AcademicFlow Logo" style={{ width: '40px', height: 'auto', marginRight: '0.5rem' }} />
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Academic<span style={{color: 'var(--color-accent)'}}>Flow</span></h2>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.8rem 1rem',
              borderRadius: 'var(--radius-md)',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              background: isActive ? 'rgba(0, 113, 227, 0.08)' : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s ease'
            })}
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
        
        <button 
             onClick={() => setShowSettings(true)}
             style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.8rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-secondary)',
                  background: 'transparent',
                  textDecoration: 'none',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  fontSize: 'inherit'
                }}
        >
            <Settings size={20} />
            {t('settings')}
        </button>

        <button
            onClick={handleBackup}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.8rem 1rem',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
              background: 'transparent',
              textDecoration: 'none',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
        >
            <FileSpreadsheet size={20} />
            {t('backupRestore')}
        </button>
        
        <label 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.8rem 1rem',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
              background: 'transparent',
              textDecoration: 'none',
              fontWeight: 500,
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              marginTop: '0.2rem'
            }}
        >
            <Download size={20} />
            {t('restoreBackup')}
            <input 
                type="file" 
                accept=".json" 
                style={{ display: 'none' }} 
                onChange={handleImport}
                onClick={(e) => {
                    if(!window.confirm(t('restoreConfirm'))) e.preventDefault();
                }}
            />
        </label>
      </nav>

      <div style={{ marginTop: 'auto' }}>
        <NavLink
            to="/downloads"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.8rem 1rem',
              borderRadius: 'var(--radius-md)',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              background: isActive ? 'rgba(0, 113, 227, 0.08)' : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s ease',
              marginBottom: '1rem'
            })}
        >
            <Download size={20} />
            {t('downloads')}
        </NavLink>
        
        <div style={{ padding: '1rem', background: 'var(--color-bg-body)', borderRadius: 'var(--radius-md)' }}>
            <TeacherInfo />
        </div>
      </div>
    </aside>
    {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

// Small component to consume context safely
function TeacherInfo() {
    // If context not valid (e.g. login screen or test), fallback
    try {
        const { settings } = useSettings();
        return (
            <>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{settings.subject || 'Teacher'}</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{settings.teacherName || 'User'}</p>
            </>
        );
    } catch (e) {
        return (
            <>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Teacher</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Mauricio Herrera</p>
            </>
        );
    }
}
