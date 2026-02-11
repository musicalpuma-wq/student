import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { X, Moon, Sun, Monitor, Type, User, Book, Globe, Lock } from 'lucide-react';

export function SettingsModal({ onClose }) {
  const { settings, updateSettings, currentTheme, t } = useSettings();
  const [activeTab, setActiveTab] = useState('general'); // general, display, security
  
  // Local state for password change (simple version)
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });

  const handlePasswordChange = (e) => {
      e.preventDefault();
      
      const storedPassword = localStorage.getItem('app_password') || '6251';

      if (passwordData.current !== storedPassword) {
          alert(t('wrongCurrentPassword'));
          return;
      }
      
      if (passwordData.new !== passwordData.confirm) {
          alert(t('passwordMismatch'));
          return;
      }

      if (passwordData.new.length < 4) {
          alert("Password must be at least 4 characters");
          return;
      }
      
      localStorage.setItem('app_password', passwordData.new);
      alert(t('passwordUpdated'));
      setPasswordData({ current: '', new: '', confirm: '' });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      backdropFilter: 'blur(5px)'
    }} onClick={onClose}>
      <div className="card" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', padding: 0 }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{t('settingsTitle')}</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <X size={24} />
            </button>
        </div>
        
        <div style={{ display: 'flex', minHeight: '400px' }}>
            {/* Sidebar Tabs */}
            <div style={{ width: '180px', background: 'var(--color-bg-secondary)', padding: '1rem 0' }}>
                <button 
                    onClick={() => setActiveTab('general')}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px',
                        width: '100%', padding: '0.8rem 1rem', border: 'none', background: activeTab === 'general' ? 'var(--color-bg-card)' : 'transparent',
                        color: activeTab === 'general' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        fontWeight: 500, cursor: 'pointer', textAlign: 'left'
                    }}
                >
                    <User size={18} /> {t('general')}
                </button>
                <button 
                    onClick={() => setActiveTab('display')}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px',
                        width: '100%', padding: '0.8rem 1rem', border: 'none', background: activeTab === 'display' ? 'var(--color-bg-card)' : 'transparent',
                        color: activeTab === 'display' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        fontWeight: 500, cursor: 'pointer', textAlign: 'left'
                    }}
                >
                    <Monitor size={18} /> {t('display')}
                </button>
                 <button 
                    onClick={() => setActiveTab('security')}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px',
                        width: '100%', padding: '0.8rem 1rem', border: 'none', background: activeTab === 'security' ? 'var(--color-bg-card)' : 'transparent',
                        color: activeTab === 'security' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        fontWeight: 500, cursor: 'pointer', textAlign: 'left'
                    }}
                >
                    <Lock size={18} /> {t('security')}
                </button>
            </div>
            
            <div style={{ flex: 1, padding: '2rem', background: 'var(--color-bg-primary)', display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ flex: 1 }}>
                {activeTab === 'general' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>{t('teacherName')}</label>
                            <input 
                                className="input-field" 
                                value={settings.teacherName} 
                                onChange={(e) => updateSettings({ teacherName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>{t('subject')}</label>
                            <input 
                                className="input-field" 
                                value={settings.subject} 
                                onChange={(e) => updateSettings({ subject: e.target.value })}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>{t('language')}</label>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input 
                                        type="radio" 
                                        name="lang" 
                                        checked={settings.language === 'en'} 
                                        onChange={() => updateSettings({ language: 'en' })}
                                    />
                                    English
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input 
                                        type="radio" 
                                        name="lang" 
                                        checked={settings.language === 'es'} 
                                        onChange={() => updateSettings({ language: 'es' })}
                                    />
                                    Español
                                </label>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'display' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.8rem', fontWeight: 500 }}>{t('theme')}</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <button 
                                    className={`btn ${settings.themeMode === 'light' ? '' : 'btn-secondary'}`}
                                    onClick={() => updateSettings({ themeMode: 'light' })}
                                    style={{ justifyContent: 'center' }}
                                >
                                    <Sun size={16} style={{ marginRight: '6px' }} /> {t('themeLight')}
                                </button>
                                <button 
                                    className={`btn ${settings.themeMode === 'dark' ? '' : 'btn-secondary'}`}
                                    onClick={() => updateSettings({ themeMode: 'dark' })}
                                    style={{ justifyContent: 'center' }}
                                >
                                    <Moon size={16} style={{ marginRight: '6px' }} /> {t('themeDark')}
                                </button>
                                <button 
                                    className={`btn ${settings.themeMode === 'auto' ? '' : 'btn-secondary'}`}
                                    onClick={() => updateSettings({ themeMode: 'auto' })}
                                    title="Auto: Dark from 6PM to 6AM"
                                    style={{ justifyContent: 'center' }}
                                >
                                    <Monitor size={16} style={{ marginRight: '6px' }} /> {t('themeAuto')}
                                </button>
                            </div>
                        </div>
                        
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.8rem', fontWeight: 500 }}>{t('fontSize')}</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
                                <Type size={14} />
                                <input 
                                    type="range" min="0" max="2" step="1"
                                    value={settings.fontSize === 'small' ? 0 : settings.fontSize === 'medium' ? 1 : 2}
                                    onChange={(e) => {
                                        const maps = ['small', 'medium', 'large'];
                                        updateSettings({ fontSize: maps[e.target.value] });
                                    }}
                                    style={{ flex: 1 }}
                                />
                                <Type size={24} />
                            </div>
                            <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                                {t(`fs${settings.fontSize.charAt(0).toUpperCase() + settings.fontSize.slice(1)}`)}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t('changePassword')}</h3>
                        <form onSubmit={handlePasswordChange}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('currentPassword')}</label>
                                <input 
                                    type="password" className="input-field" 
                                    value={passwordData.current} onChange={e => setPasswordData({...passwordData, current: e.target.value})}
                                />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('newPassword')}</label>
                                <input 
                                    type="password" className="input-field" 
                                    value={passwordData.new} onChange={e => setPasswordData({...passwordData, new: e.target.value})}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('confirmPassword')}</label>
                                <input 
                                    type="password" className="input-field" 
                                    value={passwordData.confirm} onChange={e => setPasswordData({...passwordData, confirm: e.target.value})}
                                />
                            </div>
                            <button type="submit" className="btn" style={{ width: '100%' }}>{t('updatePassword')}</button>
                        </form>
                     </div>
                )}
                </div>

                {/* Save & Exit Button */}
                <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} className="btn">
                        {t('saveAndExit')}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
