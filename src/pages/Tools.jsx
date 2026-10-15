import { useState, useEffect, useRef } from 'react';
import { Timer, Music, AudioWaveform, Play, Pause, Square, RotateCcw, Bell } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

// Shared AudioContext, created lazily on the first user gesture
let audioCtx = null;
const getAudioContext = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
};

// Short enveloped oscillator burst used for alarms and metronome clicks
const playBlip = (frequency, startTime, duration, peak = 0.5, type = 'sine') => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
};

const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Solfège names for the chromatic buttons (semitone offset from A)
const CHROMATIC_NOTES = [
    { letter: 'C', solfege: 'Do', offset: -9 },
    { letter: 'C#', solfege: 'Do#', offset: -8 },
    { letter: 'D', solfege: 'Re', offset: -7 },
    { letter: 'D#', solfege: 'Re#', offset: -6 },
    { letter: 'E', solfege: 'Mi', offset: -5 },
    { letter: 'F', solfege: 'Fa', offset: -4 },
    { letter: 'F#', solfege: 'Fa#', offset: -3 },
    { letter: 'G', solfege: 'Sol', offset: -2 },
    { letter: 'G#', solfege: 'Sol#', offset: -1 },
    { letter: 'A', solfege: 'La', offset: 0 },
    { letter: 'A#', solfege: 'La#', offset: 1 },
    { letter: 'B', solfege: 'Si', offset: 2 },
];

export function Tools() {
    const { t } = useSettings();

    // ---------------- Timer ----------------
    const [timerTotal, setTimerTotal] = useState(0);
    const [timerRemaining, setTimerRemaining] = useState(0);
    const [timerRunning, setTimerRunning] = useState(false);
    const [timerAlarm, setTimerAlarm] = useState(false);
    const timerEndRef = useRef(0);
    const timerIntervalRef = useRef(null);
    const alarmIntervalRef = useRef(null);

    const clearTimerInterval = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    };

    const stopAlarm = () => {
        if (alarmIntervalRef.current) {
            clearInterval(alarmIntervalRef.current);
            alarmIntervalRef.current = null;
        }
        setTimerAlarm(false);
    };

    const startAlarm = () => {
        setTimerAlarm(true);
        const ring = () => {
            const now = getAudioContext().currentTime;
            playBlip(880, now, 0.12);
            playBlip(880, now + 0.18, 0.12);
            playBlip(659.25, now + 0.36, 0.3);
        };
        ring();
        alarmIntervalRef.current = setInterval(ring, 1000);
    };

    const startTimer = (seconds) => {
        clearTimerInterval();
        timerEndRef.current = 0; // Computed on the first tick (keeps Date.now out of render scope)
        setTimerRunning(true);
        timerIntervalRef.current = setInterval(() => {
            if (timerEndRef.current === 0) {
                timerEndRef.current = Date.now() + seconds * 1000;
            }
            const left = Math.max(0, Math.round((timerEndRef.current - Date.now()) / 1000));
            setTimerRemaining(left);
            if (left <= 0) {
                clearTimerInterval();
                setTimerRunning(false);
                startAlarm();
            }
        }, 250);
    };

    const handleQuickSet = (minutes) => {
        stopAlarm();
        const seconds = minutes * 60;
        setTimerTotal(seconds);
        setTimerRemaining(seconds);
        startTimer(seconds);
    };

    const handleTimerStartPause = () => {
        if (timerRunning) {
            clearTimerInterval();
            setTimerRunning(false);
        } else if (timerRemaining > 0) {
            stopAlarm();
            startTimer(timerRemaining);
        }
    };

    const handleTimerReset = () => {
        stopAlarm();
        clearTimerInterval();
        setTimerRunning(false);
        setTimerRemaining(timerTotal);
    };

    // ---------------- Metronome ----------------
    const [bpm, setBpm] = useState(90);
    const [metronomePlaying, setMetronomePlaying] = useState(false);
    const [currentBeat, setCurrentBeat] = useState(0); // 0 = stopped, 1..sigTop = beat in the bar
    const [sigPreset, setSigPreset] = useState('4/4'); // '2/4' | '3/4' | '4/4' | 'custom'
    const [sigTop, setSigTop] = useState(4);       // beats per bar
    const [sigBottom, setSigBottom] = useState(4); // note value (2, 4, 8, 16)
    const bpmRef = useRef(bpm);
    const sigTopRef = useRef(sigTop);
    const sigBottomRef = useRef(sigBottom);
    const nextNoteTimeRef = useRef(0);
    const beatCountRef = useRef(0);
    const schedulerRef = useRef(null);
    const beatTimeoutsRef = useRef([]);

    useEffect(() => {
        bpmRef.current = bpm;
    }, [bpm]);

    useEffect(() => {
        sigTopRef.current = sigTop;
        sigBottomRef.current = sigBottom;
        // Restart the bar on the next click when the signature changes
        beatCountRef.current = 0;
    }, [sigTop, sigBottom]);

    // Compound meter (6/8, 9/8, 12/8): medium accent every 3 eighth-notes
    const isCompoundAccent = (beat) =>
        sigBottomRef.current === 8 && sigTopRef.current % 3 === 0 && sigTopRef.current > 3 && (beat - 1) % 3 === 0;

    const scheduleMetronome = () => {
        const ctx = getAudioContext();
        while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
            beatCountRef.current = (beatCountRef.current % sigTopRef.current) + 1;
            const beat = beatCountRef.current;
            const isAccent = beat === 1;
            const isMedium = !isAccent && isCompoundAccent(beat);
            playBlip(
                isAccent ? 1520 : isMedium ? 1200 : 1000,
                nextNoteTimeRef.current,
                0.05,
                isAccent ? 0.6 : isMedium ? 0.45 : 0.35,
                'square'
            );
            // Align the visual pulse with the scheduled sound
            const delay = Math.max(0, (nextNoteTimeRef.current - ctx.currentTime) * 1000);
            beatTimeoutsRef.current.push(setTimeout(() => setCurrentBeat(beat), delay));
            nextNoteTimeRef.current += 60 / bpmRef.current;
        }
    };

    const handleSigPreset = (preset) => {
        setSigPreset(preset);
        const [top, bottom] = preset.split('/').map(Number);
        setSigTop(top);
        setSigBottom(bottom);
    };

    const handleCustomSigTop = (value) => {
        const n = parseInt(value, 10);
        if (isNaN(n)) return;
        setSigTop(Math.min(16, Math.max(1, n)));
    };

    const handleMetronomeToggle = () => {
        if (metronomePlaying) {
            clearInterval(schedulerRef.current);
            schedulerRef.current = null;
            beatTimeoutsRef.current.forEach(clearTimeout);
            beatTimeoutsRef.current = [];
            setMetronomePlaying(false);
            setCurrentBeat(0);
        } else {
            const ctx = getAudioContext();
            beatCountRef.current = 0;
            nextNoteTimeRef.current = ctx.currentTime + 0.05;
            schedulerRef.current = setInterval(scheduleMetronome, 25);
            setMetronomePlaying(true);
        }
    };

    // ---------------- Tone Generator ----------------
    const [octave, setOctave] = useState(4);
    const [customHz, setCustomHz] = useState('');
    const [playingTone, setPlayingTone] = useState(null); // label of the active tone
    const oscRef = useRef(null);
    const gainRef = useRef(null);

    const stopTone = () => {
        if (oscRef.current) {
            const ctx = getAudioContext();
            gainRef.current.gain.cancelScheduledValues(ctx.currentTime);
            gainRef.current.gain.setValueAtTime(gainRef.current.gain.value, ctx.currentTime);
            gainRef.current.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
            oscRef.current.stop(ctx.currentTime + 0.06);
            oscRef.current = null;
            gainRef.current = null;
        }
        setPlayingTone(null);
    };

    const playTone = (frequency, label) => {
        if (playingTone === label) {
            stopTone();
            return;
        }
        stopTone();
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.03);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        oscRef.current = osc;
        gainRef.current = gain;
        setPlayingTone(label);
    };

    const noteFrequency = (offset) => 440 * Math.pow(2, (offset + (octave - 4) * 12) / 12);

    const handleCustomHzPlay = () => {
        const parsed = parseFloat(customHz.replace(',', '.'));
        if (isNaN(parsed) || parsed < 20 || parsed > 5000) return;
        playTone(parsed, `${parsed} Hz`);
    };

    // Stop all sound when leaving the page
    useEffect(() => {
        return () => {
            clearTimerInterval();
            if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
            if (schedulerRef.current) clearInterval(schedulerRef.current);
            beatTimeoutsRef.current.forEach(clearTimeout);
            if (oscRef.current) {
                oscRef.current.stop();
                oscRef.current = null;
            }
        };
    }, []);

    const sectionTitleStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', marginBottom: '1.2rem' };

    return (
        <div>
            <style>{`
                @keyframes toolsAlarmFlash {
                    0%, 100% { border-color: var(--color-danger); box-shadow: 0 0 4px rgba(255, 59, 48, 0.4); }
                    50% { border-color: transparent; box-shadow: 0 0 24px rgba(255, 59, 48, 0.9); }
                }
                .tools-timer-alarm {
                    animation: toolsAlarmFlash 1s infinite;
                    border: 2px solid var(--color-danger);
                }
            `}</style>

            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', letterSpacing: '-0.5px' }}>{t('tools')}</h1>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>

                {/* Timer */}
                <div className={`card ${timerAlarm ? 'tools-timer-alarm' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h3 style={sectionTitleStyle}><Timer size={22} color="var(--color-accent)" /> {t('timer')}</h3>
                    <div style={{
                        fontSize: '3.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        color: timerAlarm ? 'var(--color-danger)' : 'var(--color-text-primary)',
                        marginBottom: '1rem'
                    }}>
                        {formatTime(timerRemaining)}
                    </div>
                    {timerAlarm && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)', fontWeight: 700, marginBottom: '1rem' }}>
                            <Bell size={18} /> {t('timeUp')}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {[5, 10, 15].map(min => (
                            <button key={min} className="btn btn-secondary" onClick={() => handleQuickSet(min)}>
                                {min} {t('min')}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button className="btn" onClick={handleTimerStartPause} disabled={timerRemaining === 0 && !timerAlarm}>
                            {timerRunning ? <><Pause size={16} style={{ marginRight: '4px' }} /> {t('pause')}</> : <><Play size={16} style={{ marginRight: '4px' }} /> {timerRemaining < timerTotal && timerRemaining > 0 ? t('resume') : t('start')}</>}
                        </button>
                        <button className="btn btn-secondary" onClick={handleTimerReset} disabled={timerTotal === 0}>
                            <RotateCcw size={16} style={{ marginRight: '4px' }} /> {t('reset')}
                        </button>
                        {timerAlarm && (
                            <button className="btn" onClick={stopAlarm} style={{ background: 'var(--color-danger)' }}>
                                <Square size={16} style={{ marginRight: '4px' }} /> {t('stop')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Metronome */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h3 style={sectionTitleStyle}><Music size={22} color="var(--color-accent)" /> {t('metronome')}</h3>
                    <div style={{ fontSize: '3.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginBottom: '0.5rem' }}>
                        {bpm} <span style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>BPM</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                        {['2/4', '3/4', '4/4'].map(preset => (
                            <button
                                key={preset}
                                className={`btn ${sigPreset === preset ? '' : 'btn-secondary'}`}
                                onClick={() => handleSigPreset(preset)}
                                style={{ padding: '0.4rem 0.8rem' }}
                            >
                                {preset}
                            </button>
                        ))}
                        <button
                            className={`btn ${sigPreset === 'custom' ? '' : 'btn-secondary'}`}
                            onClick={() => setSigPreset('custom')}
                            style={{ padding: '0.4rem 0.8rem' }}
                        >
                            {t('customTimeSig')}
                        </button>
                        {sigPreset === 'custom' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <input
                                    type="number" min="1" max="16"
                                    value={sigTop}
                                    onChange={(e) => handleCustomSigTop(e.target.value)}
                                    className="input-field no-spin"
                                    style={{ width: '58px', padding: '0.4rem', textAlign: 'center' }}
                                />
                                <span style={{ fontWeight: 700 }}>/</span>
                                <select
                                    value={sigBottom}
                                    onChange={(e) => setSigBottom(Number(e.target.value))}
                                    className="input-field"
                                    style={{ width: '68px', padding: '0.4rem' }}
                                >
                                    {[2, 4, 8, 16].map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '240px' }}>
                        {Array.from({ length: sigTop }, (_, i) => i + 1).map(beat => (
                            <div key={beat} style={{
                                width: '14px', height: '14px', borderRadius: '50%',
                                background: currentBeat === beat ? (beat === 1 ? 'var(--color-warning)' : 'var(--color-accent)') : 'var(--color-border)',
                                transition: 'background 0.05s ease, transform 0.05s ease',
                                transform: currentBeat === beat ? 'scale(1.35)' : 'scale(1)'
                            }} />
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {[60, 90, 120].map(preset => (
                            <button
                                key={preset}
                                className={`btn ${bpm === preset ? '' : 'btn-secondary'}`}
                                onClick={() => setBpm(preset)}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                    <input
                        type="range" min="40" max="208" value={bpm}
                        onChange={(e) => setBpm(Number(e.target.value))}
                        style={{ width: '100%', maxWidth: '260px', marginBottom: '1rem', accentColor: 'var(--color-accent)' }}
                    />
                    <button className="btn" onClick={handleMetronomeToggle} style={metronomePlaying ? { background: 'var(--color-danger)' } : {}}>
                        {metronomePlaying ? <><Square size={16} style={{ marginRight: '4px' }} /> {t('stop')}</> : <><Play size={16} style={{ marginRight: '4px' }} /> {t('start')}</>}
                    </button>
                </div>

                {/* Tone Generator */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <h3 style={sectionTitleStyle}><AudioWaveform size={22} color="var(--color-accent)" /> {t('toneGenerator')}</h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <label style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {t('octave')}
                            <select
                                value={octave}
                                onChange={(e) => { stopTone(); setOctave(Number(e.target.value)); }}
                                className="input-field"
                                style={{ width: 'auto', padding: '0.4rem 0.6rem' }}
                            >
                                {[2, 3, 4, 5].map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </label>
                        {playingTone && (
                            <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                                {t('playing')}: {playingTone}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        {CHROMATIC_NOTES.map(note => {
                            const label = `${note.letter}${octave} (${note.solfege})`;
                            const isActive = playingTone === label;
                            return (
                                <button
                                    key={note.letter}
                                    className={`btn ${isActive ? '' : 'btn-secondary'}`}
                                    onClick={() => playTone(noteFrequency(note.offset), label)}
                                    style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0.5rem' }}
                                >
                                    <span style={{ fontWeight: 700 }}>{note.letter}</span>
                                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{note.solfege}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            className="input-field"
                            style={{ maxWidth: '200px' }}
                            type="text"
                            inputMode="decimal"
                            placeholder={t('customHzPlaceholder')}
                            value={customHz}
                            onChange={(e) => setCustomHz(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomHzPlay(); }}
                        />
                        <button className="btn" onClick={handleCustomHzPlay}>
                            <Play size={16} style={{ marginRight: '4px' }} /> {t('playTone')}
                        </button>
                        <button
                            className={`btn ${playingTone === 'A4 (La) — 440 Hz' ? '' : 'btn-secondary'}`}
                            onClick={() => playTone(440, 'A4 (La) — 440 Hz')}
                            style={{ fontWeight: 700 }}
                        >
                            A4 · 440 Hz
                        </button>
                        {playingTone && (
                            <button className="btn" onClick={stopTone} style={{ background: 'var(--color-danger)' }}>
                                <Square size={16} style={{ marginRight: '4px' }} /> {t('stop')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
