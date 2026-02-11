import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';

export function Login({ onLogin }) {
  const { t } = useSettings();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const storedPassword = localStorage.getItem('app_password') || '6251'; // Default backup
    if (password === storedPassword) {
      onLogin();
    } else {
      setError(t('invalidPassword'));
      setPassword('');
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      backgroundColor: 'var(--color-bg-secondary)',
      color: 'var(--color-text-primary)'
    }}>
      <div style={{
        background: 'var(--color-bg-primary)',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px var(--shadow-light)',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid var(--color-border)'
      }}>
        <h1 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>{t('loginTitle')}</h1>
        <form onSubmit={handleSubmit} autoComplete="off">
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('passwordPlaceholder')}</label>
            <input
              type="password"
              name="app_login_password_unique_v1"
              autoComplete="new-password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter access code"
              autoFocus
              style={{ width: '100%', padding: '0.8rem' }}
            />
          </div>
          {error && <p style={{ color: 'var(--color-danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          <button 
            type="submit" 
            className="btn"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {t('loginButton')}
          </button>
        </form>
      </div>
    </div>
  );
}
