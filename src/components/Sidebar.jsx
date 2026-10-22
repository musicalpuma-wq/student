import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, Download, CloudUpload, GraduationCap, BarChart3, Wrench, ChevronsLeft, ChevronsRight, Calendar } from 'lucide-react';
import { SettingsModal } from './SettingsModal';
import { useSettings } from '../context/SettingsContext';
import { useGlobalModal } from '../context/GlobalModalContext';
import { useRef } from 'react';
import { getBogotaDateString, getBogotaHHMM } from '../utils/dateUtils';

export function Sidebar({ collapsed = false, onToggle }) {
  const { settings, t, updateSettings } = useSettings();
  const { showAlert, showConfirm } = useGlobalModal();
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef(null);

  const navItems = [
    { icon: LayoutDashboard, label: t('dashboard'), path: '/' },
    { icon: Users, label: t('students'), path: '/register' },
    { icon: BarChart3, label: t('statistics'), path: '/statistics' },
    { icon: Wrench, label: t('tools'), path: '/tools' },
    // { icon: FileSpreadsheet, label: 'Reports', path: '/reports' },
  ];

  const handleBackup = () => {
      const data = localStorage.getItem('sms_data_v1');
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const dateStr = getBogotaDateString(now);
      const timeStr = getBogotaHHMM(now); // HHmm in America/Bogota
      a.download = `backup-${dateStr}-${timeStr}.json`;
      a.click();
      showAlert(t('backupRestore'), "Copia de seguridad descargada exitosamente.");
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
          // Store backup data (migration will run on next load)
          localStorage.setItem('sms_data_v1', JSON.stringify(json));
          // Reset period to 1 so user always lands on Period 1 after restore
          const currentSettings = JSON.parse(localStorage.getItem('sms_settings') || '{}');
          localStorage.setItem('sms_settings', JSON.stringify({ ...currentSettings, currentPeriod: '1' }));
          showAlert(t('backupRestore'), t('backupSuccess'), () => window.location.reload());
        } else {
          showAlert(t('backupRestore'), 'Invalid backup file format.');
        }
      } catch (err) {
        showAlert(t('backupRestore'), t('backupError'));
      }
    };
    reader.readAsText(file);
    // Reset value to allow re-uploading same file if failed
    event.target.value = '';
  };


  const initiateRestore = () => {
      showConfirm(
          t('restoreBackup'),
          t('restoreConfirm'),
          () => {
              // Confirmed
              if (fileInputRef.current) fileInputRef.current.click();
          }
      );
  };

  const itemStyle = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'flex-start',
      gap: collapsed ? 0 : '0.75rem',
      padding: '0.8rem 1rem',
      borderRadius: 'var(--radius-md)',
      fontWeight: 500,
  };

  return (
    <>
    <aside style={{
      width: collapsed ? '76px' : '260px',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      background: 'var(--color-bg-card)', // Changed to card bg for better theme support
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid var(--color-border)',
      padding: collapsed ? '2rem 0.75rem' : '2rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      transition: 'width 0.25s ease, padding 0.25s ease',
      overflow: 'hidden'
    }}>
      <div style={{
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title={collapsed ? 'AcademicFlow' : undefined}>
          <GraduationCap size={collapsed ? 32 : 40} color="var(--color-accent)" style={{ marginRight: collapsed ? 0 : '0.5rem', flexShrink: 0 }} />
          {!collapsed && <h2 style={{ fontSize: '1.2rem', margin: 0, whiteSpace: 'nowrap' }}>Academic<span style={{color: 'var(--color-accent)'}}>Flow</span></h2>}
        </div>
        <button
          onClick={onToggle}
          title={collapsed ? t('expandMenu') : t('collapseMenu')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            padding: '4px',
            display: collapsed ? 'none' : 'flex',
            alignItems: 'center',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          <ChevronsLeft size={20} />
        </button>
      </div>
      {collapsed && (
        <button
          onClick={onToggle}
          title={t('expandMenu')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            padding: '4px',
            margin: '0 auto 1rem auto',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          <ChevronsRight size={20} />
        </button>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
          {!collapsed && (
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  {t('period') || 'Periodo Activo'}
              </label>
          )}
          {collapsed ? (
              <div
                  title={`${t('period') || 'Periodo'} ${settings.currentPeriod}`}
                  onClick={onToggle}
                  style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      cursor: 'pointer',
                      color: 'var(--color-text-secondary)'
                  }}
              >
                  <Calendar size={20} color="var(--color-accent)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{settings.currentPeriod}</span>
              </div>
          ) : (
              <select
                  value={settings.currentPeriod}
                  onChange={(e) => updateSettings({ currentPeriod: e.target.value })}
                  style={{
                      width: '100%',
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.95rem',
                      background: 'var(--color-bg-body)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      fontWeight: 500
                  }}
              >
                  <option value="1">Periodo 1</option>
                  <option value="2">Periodo 2</option>
                  <option value="3">Periodo 3</option>
                  <option value="4">Periodo 4</option>
              </select>
          )}
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={collapsed ? item.label : undefined}
            style={({ isActive }) => ({
              ...itemStyle,
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              background: isActive ? 'rgba(0, 113, 227, 0.08)' : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            })}
          >
            <item.icon size={20} style={{ flexShrink: 0 }} />
            {!collapsed && item.label}
          </NavLink>
        ))}

        <button
             onClick={() => setShowSettings(true)}
             title={collapsed ? t('settings') : undefined}
             style={{
                  ...itemStyle,
                  color: 'var(--color-text-secondary)',
                  background: 'transparent',
                  textDecoration: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  whiteSpace: 'nowrap'
                }}
        >
            <Settings size={20} style={{ flexShrink: 0 }} />
            {!collapsed && t('settings')}
        </button>



        {/* Restore Backup Button (Programmatic) */}
        <button
            onClick={initiateRestore}
            title={collapsed ? t('restoreBackup') : undefined}
            style={{
              ...itemStyle,
              color: 'var(--color-text-secondary)',
              background: 'transparent',
              textDecoration: 'none',
              fontWeight: 500,
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              border: 'none',
              marginTop: '0.2rem',
              whiteSpace: 'nowrap'
            }}
        >
            <Download size={20} style={{ flexShrink: 0 }} />
            {!collapsed && t('restoreBackup')}
        </button>
        <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImport}
        />

        <button
            onClick={(e) => {
                e.preventDefault();
                handleBackup();
                window.open("https://drive.google.com/drive/folders/1KJfQ6nJ_hHReADMdTjD1woIfy9rrtE_x?usp=sharing", "_blank");
                // Small timeout to allow download to start visually before alert
                setTimeout(() => {
                    showAlert(t('driveUpload'), t('driveUploadInstruction'));
                }, 500);
            }}
            title={collapsed ? t('driveUpload') : undefined}
            style={{
              ...itemStyle,
              color: 'var(--color-text-secondary)',
              background: 'transparent',
              textDecoration: 'none',
              fontWeight: 500,
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              border: 'none',
              marginTop: '0.2rem',
              whiteSpace: 'nowrap'
            }}
        >
            <CloudUpload size={20} style={{ flexShrink: 0 }} />
            {!collapsed && t('driveUpload')}
        </button>
      </nav>

      <div style={{ marginTop: 'auto' }}>
        <NavLink
            to="/downloads"
            title={collapsed ? t('downloads') : undefined}
            style={({ isActive }) => ({
              ...itemStyle,
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              background: isActive ? 'rgba(0, 113, 227, 0.08)' : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s ease',
              marginBottom: '1rem',
              whiteSpace: 'nowrap'
            })}
        >
            <Download size={20} style={{ flexShrink: 0 }} />
            {!collapsed && t('downloads')}
        </NavLink>

        {!collapsed && (
            <div style={{ padding: '1rem', background: 'var(--color-bg-body)', borderRadius: 'var(--radius-md)' }}>
                <TeacherInfo />
            </div>
        )}
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
