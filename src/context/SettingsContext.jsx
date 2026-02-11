import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  // Load from localStorage or defaults
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('sms_settings');
    return saved ? JSON.parse(saved) : {
      teacherName: 'Mauricio Herrera',
      subject: 'Música',
      language: 'es', // 'en' | 'es'
      themeMode: 'auto', // 'light' | 'dark' | 'auto'
      fontSize: 'medium', // 'small' | 'medium' | 'large'
    };
  });

  const [currentTheme, setCurrentTheme] = useState('light');

  useEffect(() => {
    localStorage.setItem('sms_settings', JSON.stringify(settings));
    applyTheme();
    applyFontSize();
  }, [settings]);

  // Auto Theme Logic
  useEffect(() => {
    const checkAutoTheme = () => {
      if (settings.themeMode === 'auto') {
        const hour = new Date().getHours();
        // Night: 18:00 (6pm) - 6:00 (6am)
        const isNight = hour >= 18 || hour < 6;
        setCurrentTheme(isNight ? 'dark' : 'light');
      } else {
        setCurrentTheme(settings.themeMode);
      }
    };

    checkAutoTheme();
    // Check every minute if auto
    const interval = setInterval(checkAutoTheme, 60000);
    return () => clearInterval(interval);
  }, [settings.themeMode]);

  useEffect(() => {
    // Apply theme class to body
    document.body.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  const applyTheme = () => {
      // Handled by effect above via currentTheme
  };

  const applyFontSize = () => {
      const sizes = {
          small: '14px',
          medium: '16px',
          large: '18px'
      };
      document.documentElement.style.fontSize = sizes[settings.fontSize] || '16px';
  };

  const updateSettings = (newSettings) => {
      setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, currentTheme }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
