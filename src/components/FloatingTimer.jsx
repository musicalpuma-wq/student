import { useLocation, useNavigate } from 'react-router-dom';
import { Timer, Play, Pause, Square } from 'lucide-react';
import { useTimer } from '../context/TimerContext';
import { useSettings } from '../context/SettingsContext';
import { formatTime } from '../utils/audioUtils';

/*
 * Mini floating countdown shown on every page except /tools while the global
 * timer is running (or ringing). Clicking the time returns to the Tools page.
 */
export function FloatingTimer() {
    const { timerRemaining, timerRunning, timerAlarm, toggleStartPause, stopAlarm } = useTimer();
    const { t } = useSettings();
    const location = useLocation();
    const navigate = useNavigate();

    if (location.pathname === '/tools') return null;
    if (!timerRunning && !timerAlarm) return null;

    return (
        <div
            className={timerAlarm ? 'tools-timer-alarm' : ''}
            style={{
                position: 'fixed',
                right: '1.25rem',
                bottom: '1.25rem',
                zIndex: 300,
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.6rem 0.9rem',
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
            }}
        >
            <Timer size={18} color={timerAlarm ? 'var(--color-danger)' : 'var(--color-accent)'} />
            <button
                onClick={() => navigate('/tools')}
                title={t('backToTools')}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: timerAlarm ? 'var(--color-danger)' : 'var(--color-text-primary)',
                    padding: 0,
                }}
            >
                {formatTime(timerRemaining)}
            </button>
            {timerAlarm ? (
                <button
                    onClick={stopAlarm}
                    title={t('stop')}
                    style={{
                        background: 'var(--color-danger)',
                        color: 'var(--color-on-accent, white)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <Square size={14} />
                </button>
            ) : (
                <button
                    onClick={toggleStartPause}
                    title={timerRunning ? t('pause') : t('resume')}
                    style={{
                        background: 'var(--color-accent)',
                        color: 'var(--color-on-accent, white)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    {timerRunning ? <Pause size={14} /> : <Play size={14} />}
                </button>
            )}
        </div>
    );
}
