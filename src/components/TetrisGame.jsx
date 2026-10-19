import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { DataStore } from '../services/DataStore';
import { computeGameChampion, buildStaffDirectors, formatRecordDate } from '../utils/gameUtils';

/*
 * Neon Blocks — glow-neon Tetris clone. Canvas renderer, 7-bag randomizer,
 * ghost piece, particles, Web Audio synth SFX + bass BGM. Per-player high
 * scores (students, the teacher and group directors) persist via DataStore
 * ('tetrisRecords'); guest scores are discarded. All mutable game state lives
 * inside the mount effect; React state only mirrors gameState/score/lines for
 * the overlays.
 *
 * Performance note: as in SpaceGame, ctx.shadowBlur is NOT used (it stalls the
 * main thread). The neon glow is faked with a translucent halo under each cell
 * plus a bright inner rim.
 */

const COLS = 10;
const ROWS = 20;

const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};
const NEON_COLORS = {
    I: '#00f3ff', O: '#facc15', T: '#c084fc', S: '#34d399',
    Z: '#ff0055', J: '#4d7cff', L: '#fb923c',
};
const PIECE_TYPES = Object.keys(SHAPES);
const LINE_POINTS = [0, 100, 300, 500, 800];

const rotateCW = (matrix) => matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
const rotateCCW = (matrix) => matrix[0].map((_, i) => matrix.map(row => row[row.length - 1 - i]));

export function TetrisGame() {
    const { t, settings } = useSettings();
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const engineRef = useRef({
        startGame: () => {}, togglePause: () => {}, initSound: () => {},
        touchMove: () => {}, touchRotate: () => {}, touchDrop: () => {},
    });
    const touchStateRef = useRef({ left: false, right: false, down: false });
    const [gameState, setGameState] = useState('START'); // START | PLAYING | PAUSED | GAMEOVER
    const [finalScore, setFinalScore] = useState(0);
    const [finalLines, setFinalLines] = useState(0);
    const [finalLevel, setFinalLevel] = useState(1);
    const [students] = useState(() => DataStore.getStudents());
    const [courses] = useState(() => DataStore.getCourses());
    const [directors] = useState(() => buildStaffDirectors());
    const [records, setRecords] = useState(() => DataStore.getTetrisRecords());
    const [selectedPlayerId, setSelectedPlayerId] = useState(() => localStorage.getItem('neon_tetris_player') || '');
    const [isNewChampion, setIsNewChampion] = useState(false);
    // Mirror of selectedPlayerId readable from inside the mount-effect engine
    const playerRef = useRef(localStorage.getItem('neon_tetris_player') || '');
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    const teacherDisplay = (settings.teacherName || '').trim() || t('gameTeacherFallback');

    // id -> display name for every valid player (read by the engine at game over)
    const playerDirectory = { __teacher__: teacherDisplay };
    students.forEach(s => { playerDirectory[s.id] = s.name; });
    directors.forEach(d => { playerDirectory[d.id] = d.name; });
    const directoryRef = useRef(playerDirectory);
    directoryRef.current = playerDirectory;

    const champion = computeGameChampion(records);
    const selectedPlayerRecord = records[selectedPlayerId] || null;

    const fmtDate = (iso) => formatRecordDate(iso, settings.language);

    const handlePlayerSelect = (e) => {
        const id = e.target.value;
        playerRef.current = id;
        setSelectedPlayerId(id);
        localStorage.setItem('neon_tetris_player', id);
    };

    useEffect(() => {
        // Web Audio API Synthesizer (zero external dependencies)
        class SoundEngine {
            constructor() {
                this.ctx = null;
                this.musicInterval = null;
                this.noteIndex = 0;
            }

            init() {
                if (!this.ctx) {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    this.ctx = new AudioCtx();
                }
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
            }

            blip(freq, dur, type = 'square', vol = 0.1, slideTo = null, when = 0) {
                if (!this.ctx) return;
                const t0 = this.ctx.currentTime + when;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, t0);
                if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
                gain.gain.setValueAtTime(vol, t0);
                gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(t0);
                osc.stop(t0 + dur + 0.02);
            }

            playMove() { this.blip(220, 0.035, 'square', 0.05); }
            playRotate() { this.blip(340, 0.05, 'square', 0.07, 430); }
            playLock() { this.blip(150, 0.07, 'triangle', 0.16); }
            playHardDrop() { this.blip(110, 0.12, 'sawtooth', 0.18, 45); }

            playClear(count) {
                const seq = count >= 4
                    ? [523.25, 659.25, 783.99, 1046.50, 1567.98]
                    : [523.25, 659.25, 783.99, 1046.50].slice(0, count + 1);
                seq.forEach((f, i) => this.blip(f, 0.16, 'sine', 0.18, null, i * 0.06));
            }

            playLevelUp() {
                this.blip(659.25, 0.12, 'sine', 0.16);
                this.blip(987.77, 0.2, 'sine', 0.16, null, 0.09);
            }

            playGameOver() { this.blip(320, 0.7, 'sawtooth', 0.18, 55); }

            startBGM() {
                if (this.musicInterval || !this.ctx) return;
                const bassNotes = [55.00, 55.00, 65.41, 55.00, 82.41, 82.41, 73.42, 49.00]; // A1 A1 C2 A1 E2 E2 D2 G1
                this.musicInterval = setInterval(() => {
                    if (!this.ctx) return;
                    const freq = bassNotes[this.noteIndex % bassNotes.length];
                    this.noteIndex++;

                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    const filter = this.ctx.createBiquadFilter();

                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(320, this.ctx.currentTime);
                    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.ctx.destination);

                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.22);
                }, 210);
            }

            stopBGM() {
                if (this.musicInterval) {
                    clearInterval(this.musicInterval);
                    this.musicInterval = null;
                }
            }
        }

        const sound = new SoundEngine();

        const canvas = canvasRef.current;
        const container = containerRef.current;
        const ctx = canvas.getContext('2d');

        let cell = 24;
        let boardX = 0;
        let boardY = 0;
        let panelX = 0;

        const resizeCanvas = () => {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            cell = Math.max(6, Math.floor(Math.min(canvas.width / (COLS + 7), canvas.height / (ROWS + 2))));
            const boardW = cell * COLS;
            const boardH = cell * ROWS;
            const totalW = boardW + cell + cell * 4.8; // board + gap + side panel
            boardX = Math.max(Math.floor(cell * 0.5), Math.floor((canvas.width - totalW) / 2));
            boardY = Math.max(0, Math.floor((canvas.height - boardH) / 2));
            panelX = boardX + boardW + cell;
        };
        // ResizeObserver covers window resizes and entering/exiting fullscreen
        const resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(container);
        resizeCanvas();

        let gameStateLocal = 'START'; // START, PLAYING, PAUSED, GAMEOVER
        let grid = createEmptyGrid();
        let current = null;       // { type, matrix, x, y }
        let nextType = null;
        let bag = [];
        let score = 0;
        let lines = 0;
        let level = 1;
        let fallTimer = 0;
        let lastTime = 0;
        let particles = [];
        let shake = 0;
        // Record holder drawn in the side panel (refreshed on start/game over)
        const initialChampion = computeGameChampion(DataStore.getTetrisRecords());
        let bestScore = initialChampion ? initialChampion.score : 0;
        let bestName = initialChampion ? initialChampion.name : '';
        const keys = {};
        const touchState = touchStateRef.current;
        const touchRepeat = { left: 0, right: 0 };

        const syncState = (s) => { gameStateLocal = s; setGameState(s); };

        function createEmptyGrid() {
            return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        }

        const refillBag = () => {
            bag = [...PIECE_TYPES];
            for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
        };

        const takeFromBag = () => {
            if (bag.length === 0) refillBag();
            return bag.pop();
        };

        const collides = (matrix, px, py) => {
            for (let y = 0; y < matrix.length; y++) {
                for (let x = 0; x < matrix[y].length; x++) {
                    if (!matrix[y][x]) continue;
                    const gx = px + x;
                    const gy = py + y;
                    if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
                    if (gy >= 0 && grid[gy][gx]) return true;
                }
            }
            return false;
        };

        const spawnPiece = () => {
            const type = nextType || takeFromBag();
            nextType = takeFromBag();
            const matrix = SHAPES[type].map(row => [...row]);
            current = { type, matrix, x: Math.floor((COLS - matrix[0].length) / 2), y: type === 'I' ? -1 : 0 };
            if (collides(matrix, current.x, current.y)) {
                triggerGameOver();
            }
        };

        const fallInterval = () => Math.max(70, 750 * Math.pow(0.86, level - 1));

        const movePiece = (dx) => {
            if (!current || gameStateLocal !== 'PLAYING') return;
            if (!collides(current.matrix, current.x + dx, current.y)) {
                current.x += dx;
                sound.playMove();
            }
        };

        const rotatePiece = (dir = 1) => {
            if (!current || current.type === 'O' || gameStateLocal !== 'PLAYING') return;
            const rotated = dir > 0 ? rotateCW(current.matrix) : rotateCCW(current.matrix);
            for (const kick of [0, -1, 1, -2, 2]) {
                if (!collides(rotated, current.x + kick, current.y)) {
                    current.matrix = rotated;
                    current.x += kick;
                    sound.playRotate();
                    return;
                }
            }
        };

        const stepDown = (isSoft) => {
            if (!current) return;
            if (!collides(current.matrix, current.x, current.y + 1)) {
                current.y += 1;
                if (isSoft) score += 1;
            } else {
                lockPiece();
            }
        };

        const hardDrop = () => {
            if (!current || gameStateLocal !== 'PLAYING') return;
            let dist = 0;
            while (!collides(current.matrix, current.x, current.y + 1)) {
                current.y += 1;
                dist++;
            }
            score += dist * 2;
            shake = Math.min(10, 4 + dist * 0.3);
            sound.playHardDrop();
            lockPiece();
        };

        const spawnParticles = (gx, gy, color) => {
            const cx = boardX + gx * cell + cell / 2;
            const cy = boardY + gy * cell + cell / 2;
            for (let i = 0; i < 4; i++) {
                particles.push({
                    x: cx, y: cy,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.9) * 6,
                    life: 1, color,
                });
            }
        };

        const clearLines = () => {
            let cleared = 0;
            for (let y = ROWS - 1; y >= 0; y--) {
                if (grid[y].every(v => v)) {
                    for (let x = 0; x < COLS; x++) spawnParticles(x, y, grid[y][x]);
                    grid.splice(y, 1);
                    grid.unshift(Array(COLS).fill(null));
                    cleared++;
                    y++; // re-check the row that fell into this slot
                    shake = Math.min(12, shake + 3);
                }
            }
            return cleared;
        };

        const lockPiece = () => {
            const { matrix, x, y, type } = current;
            let allAboveField = true;
            matrix.forEach((row, dy) => row.forEach((v, dx) => {
                if (!v) return;
                const gy = y + dy;
                if (gy >= 0) {
                    grid[gy][x + dx] = NEON_COLORS[type];
                    allAboveField = false;
                }
            }));
            sound.playLock();
            if (allAboveField) { // locked out entirely above the visible field
                triggerGameOver();
                return;
            }
            const cleared = clearLines();
            if (cleared > 0) {
                score += LINE_POINTS[cleared] * level;
                lines += cleared;
                const newLevel = Math.floor(lines / 10) + 1;
                if (newLevel > level) {
                    level = newLevel;
                    sound.playLevelUp();
                }
                sound.playClear(cleared);
            }
            fallTimer = 0;
            spawnPiece();
        };

        // ---------- Rendering ----------

        const drawCell = (px, py, color) => {
            const x = boardX + px * cell + 1;
            const y = boardY + py * cell + 1;
            const s = cell - 2;
            ctx.save();
            // Fake neon glow: translucent halo, solid body, bright inner rim
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.16;
            ctx.fillRect(x - 3, y - 3, s + 6, s + 6);
            ctx.globalAlpha = 0.9;
            ctx.fillRect(x, y, s, s);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
            ctx.restore();
        };

        const drawGhostPiece = () => {
            if (!current || gameStateLocal !== 'PLAYING') return;
            let gy = current.y;
            while (!collides(current.matrix, current.x, gy + 1)) gy++;
            if (gy === current.y) return;
            ctx.save();
            ctx.strokeStyle = NEON_COLORS[current.type];
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1.5;
            current.matrix.forEach((row, dy) => row.forEach((v, dx) => {
                if (!v) return;
                const y = gy + dy;
                if (y < 0) return;
                ctx.strokeRect(boardX + (current.x + dx) * cell + 2.5, boardY + y * cell + 2.5, cell - 5, cell - 5);
            }));
            ctx.restore();
        };

        const drawParticles = () => {
            particles.forEach(p => {
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.life) * 0.8;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
                ctx.restore();
            });
        };

        const drawPanel = () => {
            const labelSize = Math.max(10, cell * 0.5);
            const valueSize = Math.max(14, cell * 0.75);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

            const drawStat = (label, value, y, color) => {
                ctx.font = `700 ${labelSize}px monospace`;
                ctx.fillStyle = color;
                ctx.fillText(label, panelX, y);
                ctx.font = `700 ${valueSize}px monospace`;
                ctx.fillStyle = '#f1f5f9';
                ctx.fillText(String(value), panelX, y + valueSize * 1.2);
            };

            // Next-piece preview box
            let y = boardY + cell * 1.2;
            ctx.font = `700 ${labelSize}px monospace`;
            ctx.fillStyle = '#c084fc';
            ctx.fillText('NEXT', panelX, y);
            const boxY = y + cell * 0.5;
            const boxSize = cell * 4.2;
            ctx.strokeStyle = 'rgba(192, 132, 252, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(panelX - 4, boxY, boxSize, boxSize);
            if (nextType) {
                const m = SHAPES[nextType];
                let minR = m.length, maxR = -1, minC = m[0].length, maxC = -1;
                m.forEach((row, r) => row.forEach((v, c) => {
                    if (v) {
                        if (r < minR) minR = r;
                        if (r > maxR) maxR = r;
                        if (c < minC) minC = c;
                        if (c > maxC) maxC = c;
                    }
                }));
                const offX = panelX - 4 + (boxSize - (maxC - minC + 1) * cell) / 2;
                const offY = boxY + (boxSize - (maxR - minR + 1) * cell) / 2;
                ctx.save();
                ctx.translate(offX - boardX - minC * cell, offY - boardY - minR * cell);
                m.forEach((row, r) => row.forEach((v, c) => { if (v) drawCell(c, r, NEON_COLORS[nextType]); }));
                ctx.restore();
            }

            y = boxY + boxSize + cell * 1.7;
            drawStat('SCORE', score, y, '#00f3ff');
            y += cell * 2.7;
            drawStat('LEVEL', level, y, '#facc15');
            y += cell * 2.7;
            drawStat('LINES', lines, y, '#34d399');
            // Record holder (always visible while playing)
            y += cell * 2.7;
            drawStat('BEST', bestScore, y, '#ff0055');
            if (bestName) {
                ctx.font = `700 ${Math.max(9, cell * 0.42)}px monospace`;
                ctx.fillStyle = '#f1f5f9';
                ctx.fillText(bestName.toUpperCase().slice(0, 14), panelX, y + valueSize * 1.2 + cell * 0.8);
            }
        };

        const draw = () => {
            ctx.fillStyle = '#04040c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            if (shake > 0.4) {
                ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
                shake *= 0.86;
            } else {
                shake = 0;
            }

            const boardW = cell * COLS;
            const boardH = cell * ROWS;

            // Well background
            ctx.fillStyle = 'rgba(10, 10, 24, 0.9)';
            ctx.fillRect(boardX, boardY, boardW, boardH);

            // Faint inner grid
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.06)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let c = 1; c < COLS; c++) {
                ctx.moveTo(boardX + c * cell + 0.5, boardY);
                ctx.lineTo(boardX + c * cell + 0.5, boardY + boardH);
            }
            for (let r = 1; r < ROWS; r++) {
                ctx.moveTo(boardX, boardY + r * cell + 0.5);
                ctx.lineTo(boardX + boardW, boardY + r * cell + 0.5);
            }
            ctx.stroke();

            // Locked cells
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    if (grid[y][x]) drawCell(x, y, grid[y][x]);
                }
            }

            drawGhostPiece();

            if (current) {
                current.matrix.forEach((row, dy) => row.forEach((v, dx) => {
                    if (!v) return;
                    const gy = current.y + dy;
                    if (gy < 0) return;
                    drawCell(current.x + dx, gy, NEON_COLORS[current.type]);
                }));
            }

            // Neon frame (double stroke = cheap glow)
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
            ctx.lineWidth = 6;
            ctx.strokeRect(boardX - 5, boardY - 5, boardW + 10, boardH + 10);
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(boardX - 2, boardY - 2, boardW + 4, boardH + 4);

            drawParticles();
            drawPanel();
            ctx.restore();
        };

        // ---------- Main loop ----------

        const gameLoop = (time) => {
            const dt = Math.min(60, time - (lastTime || time));
            lastTime = time;

            if (gameStateLocal === 'PLAYING') {
                // Held touch buttons auto-repeat
                if (touchState.left && time - touchRepeat.left > 115) {
                    touchRepeat.left = time;
                    movePiece(-1);
                }
                if (touchState.right && time - touchRepeat.right > 115) {
                    touchRepeat.right = time;
                    movePiece(1);
                }

                fallTimer += dt;
                const softDropping = !!(keys['ArrowDown'] || keys['s'] || keys['S'] || touchState.down);
                const interval = softDropping ? 45 : fallInterval();
                while (fallTimer >= interval && gameStateLocal === 'PLAYING') {
                    fallTimer -= interval;
                    stepDown(softDropping);
                }
                if (gameStateLocal !== 'PLAYING') fallTimer = 0;
            }

            // Particles keep animating behind the overlays
            const k = dt / 16.7;
            particles.forEach(p => {
                p.x += p.vx * k;
                p.y += p.vy * k;
                p.vy += 0.15 * k;
                p.life -= 0.02 * k;
            });
            particles = particles.filter(p => p.life > 0);

            draw();
            rafId = requestAnimationFrame(gameLoop);
        };

        // ---------- State machine ----------

        function startGame() {
            sound.init();
            sound.startBGM();
            grid = createEmptyGrid();
            current = null;
            nextType = null;
            bag = [];
            score = 0;
            lines = 0;
            level = 1;
            fallTimer = 0;
            particles = [];
            shake = 0;
            const champ = computeGameChampion(DataStore.getTetrisRecords());
            bestScore = champ ? champ.score : 0;
            bestName = champ ? champ.name : '';
            spawnPiece();
            syncState('PLAYING');
        }

        function togglePause() {
            if (gameStateLocal === 'PLAYING') {
                syncState('PAUSED');
            } else if (gameStateLocal === 'PAUSED') {
                syncState('PLAYING');
            }
        }

        function triggerGameOver() {
            syncState('GAMEOVER');
            sound.stopBGM();
            sound.playGameOver();

            // Only assigned players get their record saved; guest scores are discarded
            const playerId = playerRef.current;
            const name = playerId ? directoryRef.current[playerId] : null;
            if (name) {
                const prevChampion = computeGameChampion(DataStore.getTetrisRecords());
                const prevChampionScore = prevChampion ? prevChampion.score : 0;
                DataStore.saveTetrisRecord(playerId, name, score);
                const updated = DataStore.getTetrisRecords();
                setRecords(updated);
                setIsNewChampion(score > prevChampionScore && score > 0);
                const newChampion = computeGameChampion(updated);
                bestScore = newChampion ? newChampion.score : 0;
                bestName = newChampion ? newChampion.name : '';
            } else {
                setIsNewChampion(false);
            }

            setFinalScore(score);
            setFinalLines(lines);
            setFinalLevel(level);
        }

        // ---------- Input ----------

        const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '];
        const onKeyDown = (e) => {
            if (gameStateLocal === 'PLAYING' && GAME_KEYS.includes(e.key)) e.preventDefault();
            keys[e.key] = true;

            if (e.key === 'Enter' &&
                (gameStateLocal === 'START' || gameStateLocal === 'GAMEOVER') &&
                !['SELECT', 'INPUT', 'BUTTON'].includes(e.target.tagName)) {
                startGame();
                return;
            }
            if (e.key === 'p' || e.key === 'P') {
                if (gameStateLocal === 'PLAYING' || gameStateLocal === 'PAUSED') togglePause();
                return;
            }
            if (gameStateLocal !== 'PLAYING') return;
            // Held left/right rely on native key repeat; rotate/drop fire once per press
            if (e.repeat && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' &&
                e.key !== 'a' && e.key !== 'A' && e.key !== 'd' && e.key !== 'D') return;

            switch (e.key) {
                case 'ArrowLeft': case 'a': case 'A': movePiece(-1); break;
                case 'ArrowRight': case 'd': case 'D': movePiece(1); break;
                case 'ArrowUp': case 'x': case 'X': rotatePiece(1); break;
                case 'z': case 'Z': rotatePiece(-1); break;
                case ' ': hardDrop(); break;
            }
        };
        const onKeyUp = (e) => { keys[e.key] = false; };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        const onFullscreenChange = () => {
            if (!document.fullscreenElement && gameStateLocal === 'PLAYING') {
                togglePause();
            }
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);

        // Bridge used by the React overlays and touch controls
        engineRef.current = {
            startGame,
            togglePause,
            initSound: () => sound.init(),
            touchMove: (dx) => {
                touchRepeat[dx < 0 ? 'left' : 'right'] = performance.now();
                movePiece(dx);
            },
            touchRotate: () => rotatePiece(1),
            touchDrop: () => hardDrop(),
        };

        let rafId = requestAnimationFrame(gameLoop);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            resizeObserver.disconnect();
            sound.stopBGM();
        };
    }, []);

    const touchBtnHandlers = (keyName) => ({
        onTouchStart: (e) => {
            e.preventDefault();
            touchStateRef.current[keyName] = true;
            engineRef.current.initSound();
            if (keyName === 'left') engineRef.current.touchMove(-1);
            if (keyName === 'right') engineRef.current.touchMove(1);
        },
        onTouchEnd: (e) => { e.preventDefault(); touchStateRef.current[keyName] = false; },
    });

    const selectStyle = {
        background: '#0a0a14',
        color: '#e2e8f0',
        border: '1px solid #00f3ff',
        borderRadius: '6px',
        padding: '6px 10px',
        fontSize: '0.85rem',
        fontFamily: 'monospace',
        maxWidth: '240px'
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                width: '100%',
                flex: 1,
                minHeight: 0,
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#05050a'
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%', height: '100%', background: '#000', touchAction: 'none', userSelect: 'none' }}
                onTouchStart={() => engineRef.current.initSound()}
            />
            <div className="sg-scanlines" />

            {gameState === 'START' && (
                <div className="sg-overlay">
                    <h2 className="sg-neon-title">{t('tetrisGame')}</h2>
                    <div className="sg-neon-subtitle">GLOW NEON EDITION</div>
                    <p style={{ color: '#67e8f9', marginBottom: '1rem', fontSize: '0.9rem', maxWidth: '420px' }}>
                        {t('tetrisTagline')}
                    </p>

                    {/* Current record holder: name + score + date */}
                    <div style={{ marginBottom: '1rem', fontSize: '0.95rem', textAlign: 'center', maxWidth: '420px' }}>
                        {champion ? (
                            <span style={{ color: '#facc15', fontWeight: 700 }}>
                                🏆 {t('gameChampion')}: {champion.name} · {champion.score} · {fmtDate(champion.date)}
                            </span>
                        ) : (
                            <span style={{ color: '#94a3b8' }}>{t('gameNoChampionYet')}</span>
                        )}
                    </div>

                    {/* Player selector: teacher + directors + students by course */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: selectedPlayerRecord ? '0.25rem' : '1.5rem' }}>
                        <label htmlFor="tg-player-select" style={{ color: '#67e8f9', fontSize: '0.85rem' }}>{t('gameSelectPlayer')}:</label>
                        <select
                            id="tg-player-select"
                            value={playerDirectory[selectedPlayerId] ? selectedPlayerId : ''}
                            onChange={handlePlayerSelect}
                            style={selectStyle}
                        >
                            <option value="">{t('gameGuestOption')}</option>
                            <optgroup label={t('gameStaffGroup')}>
                                <option value="__teacher__">{teacherDisplay}</option>
                                {directors.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} · Dir. {d.course}</option>
                                ))}
                            </optgroup>
                            {courses.map(course => {
                                const courseStudents = students
                                    .filter(s => s.course === course)
                                    .sort((a, b) => a.name.localeCompare(b.name));
                                if (courseStudents.length === 0) return null;
                                return (
                                    <optgroup key={course} label={course}>
                                        {courseStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </optgroup>
                                );
                            })}
                        </select>
                    </div>
                    {selectedPlayerRecord && (
                        <div style={{ marginBottom: '1.25rem', fontSize: '0.8rem', color: '#22d3ee' }}>
                            {t('gamePersonalBest')}: {selectedPlayerRecord.score} · {fmtDate(selectedPlayerRecord.date)}
                        </div>
                    )}

                    <button className="sg-neon-button" onClick={() => engineRef.current.startGame()}>
                        {t('gameStart')}
                    </button>
                    <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>{t('tetrisControls')}</p>
                </div>
            )}

            {gameState === 'PAUSED' && (
                <div className="sg-overlay">
                    <h2 className="sg-neon-title" style={{ fontSize: '2.5rem' }}>{t('gamePause')}</h2>
                    <button className="sg-neon-button" onClick={() => engineRef.current.togglePause()}>
                        {t('gameResume')}
                    </button>
                    <button className="sg-neon-button sg-neon-button-pink" onClick={() => engineRef.current.startGame()}>
                        {t('gameRestart')}
                    </button>
                </div>
            )}

            {gameState === 'GAMEOVER' && (
                <div className="sg-overlay">
                    <h2 className="sg-neon-title sg-neon-title-pink">{t('gameOver')}</h2>
                    {isNewChampion && (
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#facc15' }}>
                            🏆 {t('gameNewRecord')}
                        </div>
                    )}
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.5rem 0', color: '#22d3ee' }}>
                        {t('gameScore')}: {finalScore}
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                        {t('gameLines')}: {finalLines} · {t('gameLevel')}: {finalLevel}
                    </div>
                    {selectedPlayerRecord && (
                        <div style={{ fontSize: '1rem', color: '#67e8f9', marginBottom: '0.25rem' }}>
                            {t('gamePersonalBest')}: {selectedPlayerRecord.score} · {fmtDate(selectedPlayerRecord.date)}
                        </div>
                    )}
                    {champion && (
                        <div style={{ fontSize: '1rem', color: '#facc15', marginBottom: '1.5rem' }}>
                            🏆 {t('gameChampion')}: {champion.name} · {champion.score} · {fmtDate(champion.date)}
                        </div>
                    )}
                    <button className="sg-neon-button" onClick={() => engineRef.current.startGame()}>
                        {t('gamePlayAgain')}
                    </button>
                </div>
            )}

            {gameState === 'PLAYING' && (
                <button
                    className="sg-pause-btn"
                    onClick={() => engineRef.current.togglePause()}
                    title={t('gamePause')}
                >
                    &#10074;&#10074;
                </button>
            )}

            {isTouchDevice && gameState === 'PLAYING' && (
                <div className="sg-touch-controls">
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div className="sg-touch-btn" {...touchBtnHandlers('left')}>&#9664;</div>
                        <div className="sg-touch-btn" {...touchBtnHandlers('down')}>&#9660;</div>
                        <div className="sg-touch-btn" {...touchBtnHandlers('right')}>&#9654;</div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div
                            className="sg-touch-btn"
                            onTouchStart={(e) => { e.preventDefault(); engineRef.current.initSound(); engineRef.current.touchRotate(); }}
                        >
                            &#10227;
                        </div>
                        <div
                            className="sg-touch-btn sg-touch-btn-fire"
                            onTouchStart={(e) => { e.preventDefault(); engineRef.current.initSound(); engineRef.current.touchDrop(); }}
                        >
                            &#10515;
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
