import { useState, useEffect, useRef } from 'react';
import { Timer, Music, AudioWaveform, Gamepad2, Blocks, Play, Pause, Square, RotateCcw, Bell, Maximize2, Minimize2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useTimer } from '../context/TimerContext';
import { getAudioContext, playBlip, formatTime } from '../utils/audioUtils';
import { DataStore } from '../services/DataStore';
import { computeGameChampion } from '../utils/gameUtils';
import { SpaceGame } from '../components/SpaceGame';
import { TetrisGame } from '../components/TetrisGame';
import spaceCover from '../assets/games/space-cover.jpg';
import tetrisCover from '../assets/games/tetris-cover.jpg';

// Available tone-generator timbres: native oscillator types + custom PeriodicWaves
const TIMBRES = [
    { id: 'sine', labelKey: 'timbreSine' },
    { id: 'triangle', labelKey: 'timbreTriangle' },
    { id: 'square', labelKey: 'timbreSquare' },
    { id: 'sawtooth', labelKey: 'timbreSawtooth' },
    { id: 'piano', labelKey: 'timbrePiano' },
    { id: 'organ', labelKey: 'timbreOrgan' },
];

// Harmonic amplitudes for the custom (non-native) timbres
const CUSTOM_WAVES = {
    piano: [1, 0.6, 0.35, 0.2, 0.12, 0.07],
    organ: [1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2],
};

const waveCache = {};
const getPeriodicWave = (ctx, name) => {
    if (!waveCache[name]) {
        const harmonics = CUSTOM_WAVES[name];
        const real = new Float32Array(harmonics.length + 1);
        const imag = new Float32Array(harmonics.length + 1);
        harmonics.forEach((amp, i) => { imag[i + 1] = amp; });
        waveCache[name] = ctx.createPeriodicWave(real, imag);
    }
    return waveCache[name];
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

const NOTE_OFFSETS = Object.fromEntries(CHROMATIC_NOTES.map(n => [n.letter, n.offset]));

// Piano keyboard: 5 octaves (C2–B6), black key sits after these white keys
const KEYBOARD_OCTAVES = [2, 3, 4, 5, 6];
const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_AFTER = { C: 'C#', D: 'D#', F: 'F#', G: 'G#', A: 'A#' };

// Small icon button that toggles the target card in/out of fullscreen
function FullscreenButton({ targetRef, active, onToggle, titleActive, titleInactive }) {
    return (
        <button
            onClick={() => onToggle(targetRef)}
            title={active ? titleActive : titleInactive}
            style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-secondary)', padding: '4px',
                display: 'flex', alignItems: 'center'
            }}
        >
            {active ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
    );
}

export function Tools() {
    const { t } = useSettings();

    // ---------------- Timer (global, keeps running across pages) ----------------
    const {
        timerTotal, timerRemaining, timerRunning, timerAlarm,
        quickSet, startCustom, toggleStartPause, resetTimer, stopAlarm,
    } = useTimer();
    const [customMin, setCustomMin] = useState('');
    const [customSec, setCustomSec] = useState('');

    const handleCustomTimerStart = () => {
        const minutes = parseInt(customMin, 10) || 0;
        const secs = parseInt(customSec, 10) || 0;
        const seconds = minutes * 60 + Math.min(secs, 59);
        startCustom(seconds);
    };

    // ---------------- Fullscreen ----------------
    const [fullscreenActive, setFullscreenActive] = useState(false);
    const timerCardRef = useRef(null);
    const metronomeCardRef = useRef(null);
    const toneCardRef = useRef(null);
    const gameCardRef = useRef(null);
    const tetrisCardRef = useRef(null);

    useEffect(() => {
        const onChange = () => setFullscreenActive(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const toggleFullscreen = (ref) => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            ref.current?.requestFullscreen();
        }
    };

    const fsButtonProps = {
        active: fullscreenActive,
        onToggle: toggleFullscreen,
        titleActive: t('exitFullscreen'),
        titleInactive: t('fullscreen'),
    };

    // Record holders shown on the game launcher cards. Computed at render so
    // they stay fresh after playing (the page re-renders on fullscreen exit)
    const gameChampions = {
        space: computeGameChampion(DataStore.getGameRecords(), DataStore.getStudents()),
        tetris: computeGameChampion(DataStore.getTetrisRecords()),
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
    const [toneView, setToneView] = useState('notes'); // 'notes' | 'keyboard'
    const [timbre, setTimbre] = useState('sine');
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
        if (CUSTOM_WAVES[timbre]) {
            osc.setPeriodicWave(getPeriodicWave(ctx, timbre));
        } else {
            osc.type = timbre;
        }
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.03);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        oscRef.current = osc;
        gainRef.current = gain;
        setPlayingTone(label);
    };

    const noteFrequency = (offset, oct = octave) => 440 * Math.pow(2, (offset + (oct - 4) * 12) / 12);

    const handleCustomHzPlay = () => {
        const parsed = parseFloat(customHz.replace(',', '.'));
        if (isNaN(parsed) || parsed < 20 || parsed > 5000) return;
        playTone(parsed, `${parsed} Hz`);
    };

    // Stop metronome/tone sound when leaving the page (the timer keeps running)
    useEffect(() => {
        return () => {
            if (schedulerRef.current) clearInterval(schedulerRef.current);
            beatTimeoutsRef.current.forEach(clearTimeout);
            if (oscRef.current) {
                oscRef.current.stop();
                oscRef.current = null;
            }
        };
    }, []);

    const sectionTitleStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', margin: 0 };
    const cardHeaderStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem', width: '100%' };

    return (
        <div>
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', letterSpacing: '-0.5px' }}>{t('tools')}</h1>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>

                {/* Timer */}
                <div ref={timerCardRef} className={`card ${timerAlarm ? 'tools-timer-alarm' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={cardHeaderStyle}>
                        <h3 style={sectionTitleStyle}><Timer size={22} color="var(--color-accent)" /> {t('timer')}</h3>
                        <FullscreenButton targetRef={timerCardRef} {...fsButtonProps} />
                    </div>
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
                            <button key={min} className="btn btn-secondary" onClick={() => quickSet(min)}>
                                {min} {t('min')}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                        <input
                            type="number" min="0" placeholder={t('timerMinPh')}
                            value={customMin}
                            onChange={(e) => setCustomMin(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomTimerStart(); }}
                            className="input-field no-spin"
                            style={{ width: '70px', padding: '0.4rem', textAlign: 'center' }}
                        />
                        <span style={{ fontWeight: 700 }}>:</span>
                        <input
                            type="number" min="0" max="59" placeholder={t('timerSecPh')}
                            value={customSec}
                            onChange={(e) => setCustomSec(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomTimerStart(); }}
                            className="input-field no-spin"
                            style={{ width: '70px', padding: '0.4rem', textAlign: 'center' }}
                        />
                        <button className="btn btn-secondary" onClick={handleCustomTimerStart} disabled={(parseInt(customMin, 10) || 0) === 0 && (parseInt(customSec, 10) || 0) === 0}>
                            <Play size={16} style={{ marginRight: '4px' }} /> {t('start')}
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button className="btn" onClick={toggleStartPause} disabled={timerRemaining === 0 && !timerAlarm}>
                            {timerRunning ? <><Pause size={16} style={{ marginRight: '4px' }} /> {t('pause')}</> : <><Play size={16} style={{ marginRight: '4px' }} /> {timerRemaining < timerTotal && timerRemaining > 0 ? t('resume') : t('start')}</>}
                        </button>
                        <button className="btn btn-secondary" onClick={resetTimer} disabled={timerTotal === 0}>
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
                <div ref={metronomeCardRef} className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={cardHeaderStyle}>
                        <h3 style={sectionTitleStyle}><Music size={22} color="var(--color-accent)" /> {t('metronome')}</h3>
                        <FullscreenButton targetRef={metronomeCardRef} {...fsButtonProps} />
                    </div>
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
                <div ref={toneCardRef} className="card" style={{ gridColumn: '1 / -1' }}>
                    <div style={cardHeaderStyle}>
                        <h3 style={sectionTitleStyle}><AudioWaveform size={22} color="var(--color-accent)" /> {t('toneGenerator')}</h3>
                        <FullscreenButton targetRef={toneCardRef} {...fsButtonProps} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className={`btn ${toneView === 'notes' ? '' : 'btn-secondary'}`}
                                onClick={() => setToneView('notes')}
                                style={{ padding: '0.4rem 0.8rem' }}
                            >
                                {t('toneNotes')}
                            </button>
                            <button
                                className={`btn ${toneView === 'keyboard' ? '' : 'btn-secondary'}`}
                                onClick={() => setToneView('keyboard')}
                                style={{ padding: '0.4rem 0.8rem' }}
                            >
                                {t('toneKeyboard')}
                            </button>
                        </div>
                        <label style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {t('timbre')}
                            <select
                                value={timbre}
                                onChange={(e) => { stopTone(); setTimbre(e.target.value); }}
                                className="input-field"
                                style={{ width: 'auto', padding: '0.4rem 0.6rem' }}
                            >
                                {TIMBRES.map(tb => <option key={tb.id} value={tb.id}>{t(tb.labelKey)}</option>)}
                            </select>
                        </label>
                        {toneView === 'notes' && (
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
                        )}
                        {playingTone && (
                            <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                                {t('playing')}: {playingTone}
                            </span>
                        )}
                    </div>

                    {toneView === 'notes' ? (
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
                    ) : (
                        (() => {
                            const whiteCount = KEYBOARD_OCTAVES.length * WHITE_NOTES.length;
                            const whiteWidth = 100 / whiteCount;
                            const blackWidth = whiteWidth * 0.62;
                            return (
                                <div style={{ overflowX: 'auto', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
                                    <div style={{ position: 'relative', display: 'flex', height: '170px', minWidth: '720px', userSelect: 'none' }}>
                                        {KEYBOARD_OCTAVES.flatMap(oct =>
                                            WHITE_NOTES.map(letter => {
                                                const label = `${letter}${oct}`;
                                                const isActive = playingTone === label;
                                                return (
                                                    <button
                                                        key={label}
                                                        onClick={() => playTone(noteFrequency(NOTE_OFFSETS[letter], oct), label)}
                                                        style={{
                                                            width: `${whiteWidth}%`, height: '100%',
                                                            background: isActive ? 'var(--color-accent)' : '#fafafa',
                                                            border: '1px solid #bbb', borderRadius: '0 0 4px 4px',
                                                            cursor: 'pointer', padding: 0,
                                                            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                                                            fontSize: '0.7rem', fontWeight: 600, paddingBottom: '4px',
                                                            color: isActive ? 'var(--color-on-accent)' : '#888',
                                                            transition: 'background 0.05s ease'
                                                        }}
                                                    >
                                                        {letter === 'C' ? label : ''}
                                                    </button>
                                                );
                                            })
                                        )}
                                        {KEYBOARD_OCTAVES.flatMap((oct, octIdx) =>
                                            WHITE_NOTES.flatMap((letter, noteIdx) => {
                                                const black = BLACK_AFTER[letter];
                                                if (!black) return [];
                                                const label = `${black}${oct}`;
                                                const isActive = playingTone === label;
                                                const whiteIndex = octIdx * WHITE_NOTES.length + noteIdx;
                                                return (
                                                    <button
                                                        key={label}
                                                        onClick={() => playTone(noteFrequency(NOTE_OFFSETS[black], oct), label)}
                                                        style={{
                                                            position: 'absolute', top: 0,
                                                            left: `${(whiteIndex + 1) * whiteWidth - blackWidth / 2}%`,
                                                            width: `${blackWidth}%`, height: '60%',
                                                            background: isActive ? 'var(--color-accent)' : '#1c1c1e',
                                                            border: '1px solid #000', borderRadius: '0 0 3px 3px',
                                                            cursor: 'pointer', padding: 0, zIndex: 1,
                                                            transition: 'background 0.05s ease'
                                                        }}
                                                    />
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })()
                    )}

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

                {/* Space Game — cover card; the game itself renders in fullscreen */}
                <div ref={gameCardRef} className="card sg-game-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={cardHeaderStyle}>
                        <h3 style={sectionTitleStyle}><Gamepad2 size={22} color="var(--color-accent)" /> {t('spaceGame')}</h3>
                        <FullscreenButton targetRef={gameCardRef} {...fsButtonProps} />
                    </div>
                    <div
                        className="sg-launcher sg-launcher-cover"
                        onClick={() => toggleFullscreen(gameCardRef)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleFullscreen(gameCardRef); }}
                        title={t('fullscreen')}
                    >
                        <div className="sg-cover-frame">
                            <img src={spaceCover} alt={t('spaceGame')} className="sg-cover-img" loading="lazy" />
                            <span className="sg-cover-play"><Play size={48} /></span>
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.9rem' }}>{t('gameTagline')}</p>
                        {gameChampions.space ? (
                            <span className="sg-cover-champion">🏆 {gameChampions.space.name} · {gameChampions.space.score}</span>
                        ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                {t('gameHighScore')}: {parseInt(localStorage.getItem('neon_galaga_highscore') || '0', 10)}
                            </span>
                        )}
                    </div>
                    <div className="sg-game-area">
                        <SpaceGame />
                    </div>
                </div>

                {/* Tetris Game — cover card; the game itself renders in fullscreen */}
                <div ref={tetrisCardRef} className="card sg-game-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={cardHeaderStyle}>
                        <h3 style={sectionTitleStyle}><Blocks size={22} color="var(--color-accent)" /> {t('tetrisGame')}</h3>
                        <FullscreenButton targetRef={tetrisCardRef} {...fsButtonProps} />
                    </div>
                    <div
                        className="sg-launcher sg-launcher-cover"
                        onClick={() => toggleFullscreen(tetrisCardRef)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleFullscreen(tetrisCardRef); }}
                        title={t('fullscreen')}
                    >
                        <div className="sg-cover-frame">
                            <img src={tetrisCover} alt={t('tetrisGame')} className="sg-cover-img" loading="lazy" />
                            <span className="sg-cover-play"><Play size={48} /></span>
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.9rem' }}>{t('tetrisTagline')}</p>
                        {gameChampions.tetris && (
                            <span className="sg-cover-champion">🏆 {gameChampions.tetris.name} · {gameChampions.tetris.score}</span>
                        )}
                    </div>
                    <div className="sg-game-area">
                        <TetrisGame />
                    </div>
                </div>
            </div>
        </div>
    );
}
