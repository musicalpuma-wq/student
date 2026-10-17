import { useState, useEffect, useRef } from 'react';
import { Dices, X, RotateCcw } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { getAudioContext, playBlip } from '../utils/audioUtils';

/*
 * Random student picker with a roulette effect: names cycle fast and slow down
 * until one remains. mode 'noRepeat' draws without replacement (pickedIds kept
 * by the parent so the pool survives opening/closing the modal); 'allowRepeats'
 * draws from the full roster every time.
 */
export function RandomPickerModal({ students, mode, onModeChange, pickedIds, onPickedIdsChange, onClose }) {
    const { t } = useSettings();
    const [displayName, setDisplayName] = useState(null);
    const [winner, setWinner] = useState(null);
    const [spinning, setSpinning] = useState(false);
    const timeoutRef = useRef(null);

    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    const pool = mode === 'noRepeat'
        ? students.filter(s => !pickedIds.includes(s.id))
        : students;

    const spin = () => {
        if (spinning || pool.length === 0) return;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        setSpinning(true);
        setWinner(null);

        let delay = 60;
        const step = () => {
            // Show any roster name for visual variety while the wheel turns
            const randomStudent = students[Math.floor(Math.random() * students.length)];
            setDisplayName(randomStudent.name);
            const ctx = getAudioContext();
            playBlip(1100 + Math.random() * 300, ctx.currentTime, 0.03, 0.12, 'square');

            delay *= 1.16;
            if (delay < 380) {
                timeoutRef.current = setTimeout(step, delay);
            } else {
                // Final tick: land on the chosen student
                timeoutRef.current = setTimeout(() => {
                    setDisplayName(chosen.name);
                    setWinner(chosen);
                    setSpinning(false);
                    if (mode === 'noRepeat') {
                        onPickedIdsChange(prev => [...prev, chosen.id]);
                    }
                    const c = getAudioContext();
                    playBlip(523.25, c.currentTime, 0.12);
                    playBlip(659.25, c.currentTime + 0.15, 0.12);
                    playBlip(783.99, c.currentTime + 0.3, 0.35);
                }, delay);
            }
        };
        timeoutRef.current = setTimeout(step, delay);
    };

    const resetPool = () => {
        onPickedIdsChange([]);
        setWinner(null);
        setDisplayName(null);
    };

    const modeButtonStyle = (active) => ({
        flex: 1,
        padding: '0.5rem 0.8rem',
        borderRadius: '20px',
        border: active ? 'none' : '1px solid var(--color-border)',
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? 'var(--color-on-accent, white)' : 'var(--color-text-secondary)',
        fontWeight: 500,
        fontSize: '0.85rem',
        cursor: spinning ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit'
    });

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
            backdropFilter: 'blur(5px)'
        }} onClick={spinning ? undefined : onClose}>
            <div className="card" style={{ width: '480px', maxWidth: '92vw', padding: '2rem', position: 'relative' }} onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    disabled={spinning}
                    style={{
                        position: 'absolute', top: '1rem', right: '1rem',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text-secondary)', padding: '4px',
                        display: 'flex', alignItems: 'center'
                    }}
                >
                    <X size={20} />
                </button>

                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.3rem', marginBottom: '1.2rem' }}>
                    <Dices size={24} color="var(--color-accent)" /> {t('pickRandom')}
                </h3>

                {/* Mode toggle */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <button disabled={spinning} style={modeButtonStyle(mode === 'noRepeat')} onClick={() => onModeChange('noRepeat')}>
                        {t('noRepeat')}
                    </button>
                    <button disabled={spinning} style={modeButtonStyle(mode === 'allowRepeats')} onClick={() => onModeChange('allowRepeats')}>
                        {t('allowRepeats')}
                    </button>
                </div>

                {/* Roulette display */}
                <div style={{
                    minHeight: '96px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.5rem',
                    padding: '0.5rem 1rem',
                    textAlign: 'center',
                    background: 'var(--color-bg-body)'
                }}>
                    <span
                        key={`${displayName}-${winner ? 'w' : 's'}`}
                        className={winner ? 'roulette-winner' : ''}
                        style={{
                            fontSize: displayName ? '2rem' : '2.5rem',
                            fontWeight: 700,
                            color: displayName ? undefined : 'var(--color-border)'
                        }}
                    >
                        {displayName || '?'}
                    </span>
                </div>

                <button
                    className="btn"
                    onClick={spin}
                    disabled={spinning || pool.length === 0 || students.length === 0}
                    style={{ width: '100%', fontSize: '1.1rem', padding: '0.8rem', marginBottom: '1rem' }}
                >
                    <Dices size={20} style={{ marginRight: '8px' }} />
                    {spinning ? t('spinning') : t('spin')}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '32px' }}>
                    {mode === 'noRepeat' ? (
                        <>
                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                {t('remainingStudents')}: {pool.length} / {students.length}
                            </span>
                            <button
                                className="btn btn-secondary"
                                onClick={resetPool}
                                disabled={spinning || pickedIds.length === 0}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <RotateCcw size={14} /> {t('resetPool')}
                            </button>
                        </>
                    ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            {t('students')}: {students.length}
                        </span>
                    )}
                </div>

                {mode === 'noRepeat' && pool.length === 0 && students.length > 0 && (
                    <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--color-warning)', fontWeight: 500 }}>
                        {t('poolExhausted')}
                    </p>
                )}
            </div>
        </div>
    );
}
