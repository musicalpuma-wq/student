import { createContext, useContext, useState, useRef } from 'react';
import { getAudioContext, playBlip } from '../utils/audioUtils';

const TimerContext = createContext();

/*
 * Global countdown timer. Lives in a provider so the countdown and the alarm
 * keep running while the user navigates to other pages; the Tools page and
 * the FloatingTimer widget are both consumers of this single state.
 */
export function TimerProvider({ children }) {
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

    const quickSet = (minutes) => {
        stopAlarm();
        const seconds = minutes * 60;
        setTimerTotal(seconds);
        setTimerRemaining(seconds);
        startTimer(seconds);
    };

    const startCustom = (seconds) => {
        if (seconds <= 0) return;
        stopAlarm();
        setTimerTotal(seconds);
        setTimerRemaining(seconds);
        startTimer(seconds);
    };

    const toggleStartPause = () => {
        if (timerRunning) {
            clearTimerInterval();
            setTimerRunning(false);
        } else if (timerRemaining > 0) {
            stopAlarm();
            startTimer(timerRemaining);
        }
    };

    const resetTimer = () => {
        stopAlarm();
        clearTimerInterval();
        setTimerRunning(false);
        setTimerRemaining(timerTotal);
    };

    return (
        <TimerContext.Provider value={{
            timerTotal, timerRemaining, timerRunning, timerAlarm,
            quickSet, startCustom, toggleStartPause, resetTimer, stopAlarm,
        }}>
            {children}
        </TimerContext.Provider>
    );
}

export const useTimer = () => useContext(TimerContext);
