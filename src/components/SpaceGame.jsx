import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { DataStore } from '../services/DataStore';
import { computeGameChampion, buildStaffDirectors, formatRecordDate } from '../utils/gameUtils';

/*
 * Neon Galaga — canvas space shooter ported from the standalone naves.html.
 * Self-contained: no external fonts/libraries, Web Audio synth. One life per
 * run. Per-player high scores (students, the teacher and group directors) are
 * persisted via DataStore ('gameRecords', name embedded in new records);
 * 'neon_galaga_highscore' survives only as a legacy read-only baseline.
 * All mutable game state lives inside the mount effect; React state only
 * mirrors gameState/score for the overlays.
 *
 * Performance note: ctx.shadowBlur is NOT used (it is extremely expensive and
 * stalls the main thread when applied to many entities per frame). The neon
 * glow is faked with a wide translucent under-stroke, which is far cheaper.
 */

export function SpaceGame() {
    const { t, settings } = useSettings();
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const engineRef = useRef({ startGame: () => {}, togglePause: () => {}, moveTo: () => {}, initSound: () => {} });
    const touchStateRef = useRef({ left: false, right: false, fire: false });
    const [gameState, setGameState] = useState('START'); // START | PLAYING | PAUSED | GAMEOVER
    const [finalScore, setFinalScore] = useState(0);
    const [students] = useState(() => DataStore.getStudents());
    const [courses] = useState(() => DataStore.getCourses());
    const [records, setRecords] = useState(() => DataStore.getGameRecords());
    const [directors] = useState(() => buildStaffDirectors());
    const [selectedPlayerId, setSelectedPlayerId] = useState(() => localStorage.getItem('neon_galaga_player') || '');
    const [isNewChampion, setIsNewChampion] = useState(false);
    // Mirror of selectedPlayerId readable from inside the mount-effect engine
    const playerRef = useRef(localStorage.getItem('neon_galaga_player') || '');
    const [highScore, setHighScore] = useState(() => {
        const legacy = parseInt(localStorage.getItem('neon_galaga_highscore') || '0', 10);
        const champ = computeGameChampion(DataStore.getGameRecords(), DataStore.getStudents());
        return Math.max(legacy, champ ? champ.score : 0);
    });
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    const teacherDisplay = (settings.teacherName || '').trim() || t('gameTeacherFallback');

    // id -> display name for every valid player (read by the engine at game over)
    const playerDirectory = { __teacher__: teacherDisplay };
    students.forEach(s => { playerDirectory[s.id] = s.name; });
    directors.forEach(d => { playerDirectory[d.id] = d.name; });
    const directoryRef = useRef(playerDirectory);
    directoryRef.current = playerDirectory;

    const champion = computeGameChampion(records, students);
    const selectedPlayerRecord = records[selectedPlayerId] || null;

    const handlePlayerSelect = (e) => {
        const id = e.target.value;
        playerRef.current = id;
        setSelectedPlayerId(id);
        localStorage.setItem('neon_galaga_player', id);
    };

    useEffect(() => {
        // Web Audio API Synthesizer (zero external dependencies)
        class SoundEngine {
            constructor() {
                this.ctx = null;
                this.muted = false;
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

            playLaser() {
                if (!this.ctx || this.muted) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(800, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);

                gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + 0.15);
            }

            playExplosion(isBig = false) {
                if (!this.ctx || this.muted) return;
                const dur = isBig ? 0.6 : 0.3;
                const bufferSize = this.ctx.sampleRate * dur;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);

                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(isBig ? 400 : 800, this.ctx.currentTime);
                filter.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + dur);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(isBig ? 0.5 : 0.3, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                noise.start();
            }

            playPowerup() {
                if (!this.ctx || this.muted) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.linearRampToValueAtTime(600, now + 0.1);
                osc.frequency.linearRampToValueAtTime(900, now + 0.25);

                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now);
                osc.stop(now + 0.3);
            }

            playHit() {
                if (!this.ctx || this.muted) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, this.ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.1);

                gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.1);
            }

            startSynthwaveBGM() {
                if (this.musicInterval || !this.ctx) return;
                const bassNotes = [65.41, 65.41, 87.31, 87.31, 98.00, 98.00, 73.42, 73.42]; // C2, F2, G2, D2
                this.musicInterval = setInterval(() => {
                    if (this.muted) return;
                    const freq = bassNotes[this.noteIndex % bassNotes.length];
                    this.noteIndex++;

                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    const filter = this.ctx.createBiquadFilter();

                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(350, this.ctx.currentTime);

                    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.ctx.destination);

                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.25);
                }, 250);
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

        // Assigned later; resizeCanvas guards against null on its first sync call
        let player = null;
        let starfield = null;
        let synthGrid = null;

        const resizeCanvas = () => {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            // Re-anchor the ship to the new bottom and rebuild the starfield
            if (player) {
                player.y = canvas.height - 70;
                player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
            }
            if (starfield) starfield.init();
        };
        // ResizeObserver covers window resizes and entering/exiting fullscreen
        const resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(container);
        resizeCanvas();

        let gameStateLocal = 'START'; // START, PLAYING, PAUSED, GAMEOVER
        let score = 0;
        const engineChampion = computeGameChampion(DataStore.getGameRecords(), DataStore.getStudents());
        let high = Math.max(
            parseInt(localStorage.getItem('neon_galaga_highscore') || '0', 10),
            engineChampion ? engineChampion.score : 0
        );
        let championName = engineChampion ? engineChampion.name : '';
        let wave = 1;
        let combo = 1;
        let comboTimer = 0;
        let screenShake = 0;
        const keys = {};
        const touchState = touchStateRef.current;

        const syncState = (s) => { gameStateLocal = s; setGameState(s); };

        // Keyboard listeners
        const onKeyDown = (e) => {
            keys[e.code] = true;
            if (e.code === 'KeyP' || e.code === 'Escape') {
                togglePause();
            }
            // Only swallow game keys while playing so the page can scroll otherwise
            if (gameStateLocal === 'PLAYING' &&
                ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
                e.preventDefault();
            }
        };
        const onKeyUp = (e) => { keys[e.code] = false; };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        // Pause when the user leaves fullscreen mid-game (the launcher card hides the canvas)
        const onFullscreenChange = () => {
            if (!document.fullscreenElement && gameStateLocal === 'PLAYING') {
                togglePause();
            }
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);

        // Synthwave Background Grid
        class SynthGrid {
            constructor() {
                this.offset = 0;
            }
            update() {
                this.offset = (this.offset + 1.5) % 40;
            }
            draw() {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 0, 128, 0.15)';
                ctx.lineWidth = 1;

                const horizon = canvas.height * 0.65;
                const cx = canvas.width / 2;

                // Perspective Vertical Lines
                for (let x = -canvas.width; x < canvas.width * 2; x += 60) {
                    ctx.beginPath();
                    ctx.moveTo(x, canvas.height);
                    ctx.lineTo(cx + (x - cx) * 0.1, horizon);
                    ctx.stroke();
                }

                // Horizontal Moving Lines
                for (let y = horizon; y < canvas.height; y += 15) {
                    const ly = y + (this.offset * ((y - horizon) / (canvas.height - horizon)));
                    if (ly <= canvas.height) {
                        ctx.beginPath();
                        ctx.moveTo(0, ly);
                        ctx.lineTo(canvas.width, ly);
                        ctx.stroke();
                    }
                }
                ctx.restore();
            }
        }

        // Parallax Starfield
        class Starfield {
            constructor() {
                this.stars = [];
                this.init();
            }
            init() {
                this.stars = [];
                for (let i = 0; i < 70; i++) {
                    this.stars.push({
                        x: Math.random() * canvas.width,
                        y: Math.random() * canvas.height,
                        size: Math.random() * 2 + 0.5,
                        speed: Math.random() * 2 + 0.5,
                        color: ['#00f3ff', '#ff0055', '#ffffff', '#ffe600'][Math.floor(Math.random() * 4)]
                    });
                }
            }
            update() {
                this.stars.forEach(s => {
                    s.y += s.speed;
                    if (s.y > canvas.height) {
                        s.y = 0;
                        s.x = Math.random() * canvas.width;
                    }
                });
            }
            draw() {
                this.stars.forEach(s => {
                    ctx.fillStyle = s.color;
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        }

        // Particle System
        class Particle {
            constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.color = color;
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 6 + 1;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.life = 1.0;
                this.decay = Math.random() * 0.03 + 0.015;
                this.size = Math.random() * 3 + 2;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.life -= this.decay;
            }
            draw() {
                if (this.life <= 0) return;
                ctx.globalAlpha = this.life;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        let particles = [];
        function createExplosion(x, y, color, count = 25) {
            for (let i = 0; i < count; i++) {
                particles.push(new Particle(x, y, color));
            }
        }

        class PowerUp {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.size = 15;
                this.speed = 2;
                const types = ['SPREAD', 'BEAM', 'SHIELD', 'BOMB'];
                this.type = types[Math.floor(Math.random() * types.length)];
                this.angle = 0;

                this.colors = {
                    'SPREAD': '#00f3ff',
                    'BEAM': '#ff0055',
                    'SHIELD': '#39ff14',
                    'BOMB': '#ffe600'
                };
            }
            update() {
                this.y += this.speed;
                this.angle += 0.05;
            }
            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle);
                ctx.strokeStyle = this.colors[this.type];
                ctx.lineWidth = 2;

                // Fake glow: larger translucent frame behind the solid one
                ctx.globalAlpha = 0.3;
                ctx.lineWidth = 5;
                ctx.strokeRect(-this.size / 2 - 2, -this.size / 2 - 2, this.size + 4, this.size + 4);
                ctx.globalAlpha = 1;
                ctx.lineWidth = 2;
                ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);

                ctx.fillStyle = '#fff';
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.type[0], 0, 0);

                ctx.restore();
            }
        }

        let powerUps = [];

        class Player {
            constructor() {
                this.radius = 20;
                this.x = canvas.width / 2;
                this.y = canvas.height - 70;
                this.speed = 7;
                this.lives = 1; // One life per run: first unshielded hit ends the game
                this.maxLives = 1;
                this.shield = 0; // Shield hit counter
                this.weapon = 'NORMAL'; // NORMAL, SPREAD, BEAM
                this.weaponTimer = 0;
                this.lastShot = 0;
                this.shootDelay = 150; // ms
                this.invulnerable = 0;
            }

            reset() {
                this.x = canvas.width / 2;
                this.y = canvas.height - 70;
                this.lives = 1;
                this.shield = 0;
                this.weapon = 'NORMAL';
                this.weaponTimer = 0;
                this.invulnerable = 0;
            }

            update() {
                // Movement Controls
                if (keys['ArrowLeft'] || keys['KeyA'] || touchState.left) {
                    this.x -= this.speed;
                }
                if (keys['ArrowRight'] || keys['KeyD'] || touchState.right) {
                    this.x += this.speed;
                }

                // Boundaries
                this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));

                // Shooting
                const now = Date.now();
                if ((keys['Space'] || touchState.fire) && now - this.lastShot > this.shootDelay) {
                    this.shoot();
                    this.lastShot = now;
                }

                // Weapon Timer
                if (this.weaponTimer > 0) {
                    this.weaponTimer--;
                    if (this.weaponTimer <= 0) {
                        this.weapon = 'NORMAL';
                        this.shootDelay = 150;
                    }
                }

                if (this.invulnerable > 0) this.invulnerable--;
            }

            shoot() {
                sound.playLaser();
                if (this.weapon === 'NORMAL') {
                    bullets.push(new Bullet(this.x, this.y - 15, 0, -12, '#00f3ff'));
                } else if (this.weapon === 'SPREAD') {
                    bullets.push(new Bullet(this.x, this.y - 15, 0, -12, '#00f3ff'));
                    bullets.push(new Bullet(this.x - 10, this.y - 10, -3, -11, '#00f3ff'));
                    bullets.push(new Bullet(this.x + 10, this.y - 10, 3, -11, '#00f3ff'));
                } else if (this.weapon === 'BEAM') {
                    bullets.push(new Bullet(this.x - 8, this.y - 20, 0, -16, '#ff0055', true));
                    bullets.push(new Bullet(this.x + 8, this.y - 20, 0, -16, '#ff0055', true));
                }
            }

            traceShip() {
                // Cyberpunk Neon Fighter Ship Design
                ctx.beginPath();
                ctx.moveTo(0, -this.radius - 5); // Nose
                ctx.lineTo(-this.radius, this.radius); // Left Wing
                ctx.lineTo(-this.radius / 2, this.radius / 2);
                ctx.lineTo(0, this.radius); // Tail center
                ctx.lineTo(this.radius / 2, this.radius / 2);
                ctx.lineTo(this.radius, this.radius); // Right Wing
                ctx.closePath();
            }

            draw() {
                if (this.invulnerable % 6 > 3) return; // Flash effect when hit

                ctx.save();
                ctx.translate(this.x, this.y);

                // Shield visual aura
                if (this.shield > 0) {
                    ctx.strokeStyle = '#39ff14';
                    ctx.globalAlpha = 0.35;
                    ctx.lineWidth = 8;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // Fake glow: wide translucent under-stroke, then the solid ship
                this.traceShip();
                ctx.strokeStyle = '#00f3ff';
                ctx.globalAlpha = 0.3;
                ctx.lineWidth = 7;
                ctx.stroke();

                ctx.globalAlpha = 1;
                ctx.fillStyle = '#050515';
                ctx.lineWidth = 2.5;
                ctx.fill();
                ctx.stroke();

                // Cockpit Core Glow
                ctx.fillStyle = '#ff0055';
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                ctx.arc(0, -2, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(0, -2, 5, 0, Math.PI * 2);
                ctx.fill();

                // Engine Thruster Flame
                ctx.fillStyle = '#ffe600';
                ctx.beginPath();
                ctx.moveTo(-5, this.radius - 2);
                ctx.lineTo(0, this.radius + 12 + Math.random() * 6);
                ctx.lineTo(5, this.radius - 2);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }
        }

        class Bullet {
            constructor(x, y, vx, vy, color, isBeam = false) {
                this.x = x;
                this.y = y;
                this.vx = vx;
                this.vy = vy;
                this.color = color;
                this.isBeam = isBeam;
                this.radius = isBeam ? 4 : 3;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
            }
            draw() {
                ctx.strokeStyle = this.color;
                ctx.lineCap = 'round';
                // Fake glow: wide translucent under-stroke
                ctx.globalAlpha = 0.3;
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x - this.vx * 2, this.y - this.vy * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x - this.vx * 2, this.y - this.vy * 2);
                ctx.stroke();
            }
        }

        player = new Player();
        let bullets = [];
        let enemyBullets = [];

        class Enemy {
            constructor(x, y, type) {
                this.x = x;
                this.y = y;
                this.type = type; // 'BASIC', 'ZIGZAG', 'BOSS'
                this.startX = x;
                this.startY = y;
                this.time = Math.random() * 100;
                this.isDiving = false;
                this.diveTime = 0;

                if (type === 'BASIC') {
                    this.hp = 1;
                    this.scoreValue = 100;
                    this.color = '#ff0055';
                    this.radius = 16;
                } else if (type === 'ZIGZAG') {
                    this.hp = 2;
                    this.scoreValue = 200;
                    this.color = '#ffe600';
                    this.radius = 18;
                } else if (type === 'BOSS') {
                    this.hp = 15;
                    this.maxHp = 15;
                    this.scoreValue = 1000;
                    this.color = '#a800ff';
                    this.radius = 35;
                }
            }

            update() {
                this.time += 0.04;

                if (!this.isDiving) {
                    // Formation Hover Pattern
                    this.x = this.startX + Math.sin(this.time) * 30;
                    this.y = this.startY + Math.cos(this.time * 0.5) * 10;

                    // Random dive attack trigger (Galaga Style)
                    if (Math.random() < 0.0015 && this.type !== 'BOSS') {
                        this.isDiving = true;
                        this.diveTime = 0;
                    }
                } else {
                    // Diving Attack Trajectory
                    this.diveTime += 0.03;
                    this.y += 3.5;
                    this.x += Math.sin(this.diveTime * 3) * 4;

                    // Loop back to top if off-screen
                    if (this.y > canvas.height + 40) {
                        this.y = -30;
                        this.isDiving = false;
                    }
                }

                // Enemy Shooting
                if (Math.random() < (this.type === 'BOSS' ? 0.04 : 0.003)) {
                    this.shoot();
                }
            }

            shoot() {
                if (this.type === 'BOSS') {
                    enemyBullets.push(new Bullet(this.x - 15, this.y + 20, -1.5, 5, '#a800ff'));
                    enemyBullets.push(new Bullet(this.x + 15, this.y + 20, 1.5, 5, '#a800ff'));
                } else {
                    enemyBullets.push(new Bullet(this.x, this.y + 15, 0, 4.5, '#ff0055'));
                }
            }

            traceShip() {
                if (this.type === 'BASIC') {
                    // Diamond Drone Shape
                    ctx.beginPath();
                    ctx.moveTo(0, this.radius);
                    ctx.lineTo(-this.radius, 0);
                    ctx.lineTo(0, -this.radius);
                    ctx.lineTo(this.radius, 0);
                    ctx.closePath();
                } else if (this.type === 'ZIGZAG') {
                    // Interceptor Crab/Inverted Shape
                    ctx.beginPath();
                    ctx.moveTo(-this.radius, -this.radius / 2);
                    ctx.lineTo(0, this.radius);
                    ctx.lineTo(this.radius, -this.radius / 2);
                    ctx.lineTo(this.radius / 2, -this.radius);
                    ctx.lineTo(-this.radius / 2, -this.radius);
                    ctx.closePath();
                } else if (this.type === 'BOSS') {
                    // Heavy Mothership
                    ctx.beginPath();
                    ctx.moveTo(0, this.radius);
                    ctx.lineTo(-this.radius, -this.radius / 3);
                    ctx.lineTo(-this.radius / 1.5, -this.radius);
                    ctx.lineTo(this.radius / 1.5, -this.radius);
                    ctx.lineTo(this.radius, -this.radius / 3);
                    ctx.closePath();
                }
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.strokeStyle = this.color;

                // Fake glow: wide translucent under-stroke, then the solid ship
                this.traceShip();
                ctx.globalAlpha = 0.3;
                ctx.lineWidth = 7;
                ctx.stroke();

                ctx.globalAlpha = 1;
                ctx.fillStyle = '#0a0010';
                ctx.lineWidth = 2.5;
                ctx.fill();
                ctx.stroke();

                if (this.type === 'BOSS') {
                    // Boss HP Bar overlay
                    ctx.fillStyle = 'rgba(255, 0, 85, 0.3)';
                    ctx.fillRect(-this.radius, -this.radius - 12, this.radius * 2, 5);
                    ctx.fillStyle = '#ff0055';
                    ctx.fillRect(-this.radius, -this.radius - 12, (this.radius * 2) * (this.hp / this.maxHp), 5);
                }

                ctx.restore();
            }
        }

        let enemies = [];

        function spawnWave(waveNum) {
            enemies = [];
            const rows = Math.min(3 + Math.floor(waveNum / 2), 5);
            const cols = Math.min(5 + waveNum, 9);
            const spacingX = Math.min(canvas.width / (cols + 1), 70);

            // Boss spawn on every 3rd wave
            if (waveNum % 3 === 0) {
                enemies.push(new Enemy(canvas.width / 2, 80, 'BOSS'));
            }

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = (canvas.width / 2) - ((cols - 1) * spacingX / 2) + (c * spacingX);
                    const y = 80 + (r * 45) + (waveNum % 3 === 0 ? 60 : 0);
                    const type = (r === 0) ? 'ZIGZAG' : 'BASIC';
                    enemies.push(new Enemy(x, y, type));
                }
            }
        }

        function checkCollisions() {
            // Player Bullets vs Enemies
            for (let bIndex = bullets.length - 1; bIndex >= 0; bIndex--) {
                const b = bullets[bIndex];
                for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
                    const e = enemies[eIndex];
                    const dist = Math.hypot(b.x - e.x, b.y - e.y);

                    if (dist < e.radius + b.radius) {
                        e.hp--;
                        createExplosion(b.x, b.y, b.color, 6);
                        bullets.splice(bIndex, 1);

                        if (e.hp <= 0) {
                            sound.playExplosion(e.type === 'BOSS');
                            createExplosion(e.x, e.y, e.color, e.type === 'BOSS' ? 50 : 20);

                            // Score & Combo System
                            score += e.scoreValue * combo;
                            comboTimer = 120; // reset combo timer
                            combo++;

                            // Drop Powerup Chance
                            if (Math.random() < 0.15) {
                                powerUps.push(new PowerUp(e.x, e.y));
                            }

                            enemies.splice(eIndex, 1);
                        } else {
                            sound.playHit();
                        }
                        break;
                    }
                }
            }

            // Enemy Bullets vs Player
            for (let ebIndex = enemyBullets.length - 1; ebIndex >= 0; ebIndex--) {
                const eb = enemyBullets[ebIndex];
                const dist = Math.hypot(eb.x - player.x, eb.y - player.y);

                if (dist < player.radius + eb.radius) {
                    enemyBullets.splice(ebIndex, 1);
                    handlePlayerHit();
                }
            }

            // Enemy Body vs Player Body
            for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
                const e = enemies[eIndex];
                const dist = Math.hypot(e.x - player.x, e.y - player.y);

                if (dist < player.radius + e.radius) {
                    createExplosion(e.x, e.y, e.color, 20);
                    enemies.splice(eIndex, 1);
                    handlePlayerHit();
                }
            }

            // Player vs Powerups
            for (let pIndex = powerUps.length - 1; pIndex >= 0; pIndex--) {
                const p = powerUps[pIndex];
                const dist = Math.hypot(p.x - player.x, p.y - player.y);

                if (dist < player.radius + p.size) {
                    sound.playPowerup();
                    applyPowerUp(p.type);
                    createExplosion(p.x, p.y, p.colors[p.type], 12);
                    powerUps.splice(pIndex, 1);
                }
            }
        }

        function handlePlayerHit() {
            if (player.invulnerable > 0) return;

            screenShake = 15;

            if (player.shield > 0) {
                player.shield--;
                sound.playHit();
                player.invulnerable = 30;
                return;
            }

            sound.playExplosion(true);
            createExplosion(player.x, player.y, '#00f3ff', 35);
            player.lives--;
            combo = 1;
            player.invulnerable = 90; // Temporary invulnerability after death

            if (player.lives <= 0) {
                triggerGameOver();
            }
        }

        function applyPowerUp(type) {
            if (type === 'SPREAD') {
                player.weapon = 'SPREAD';
                player.weaponTimer = 500;
            } else if (type === 'BEAM') {
                player.weapon = 'BEAM';
                player.weaponTimer = 400;
                player.shootDelay = 80;
            } else if (type === 'SHIELD') {
                player.shield = 2;
            } else if (type === 'BOMB') {
                screenShake = 20;
                sound.playExplosion(true);
                enemies.forEach(e => {
                    createExplosion(e.x, e.y, e.color, 15);
                    score += e.scoreValue;
                });
                enemies = [];
            }
        }

        function drawHUD() {
            ctx.save();
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = '#00f3ff';

            // Score & Wave Info
            ctx.fillText(`SCORE: ${score}`, 20, 35);
            ctx.fillText(`WAVE: ${wave}`, 20, 60);

            // Combo Counter
            if (combo > 1) {
                ctx.fillStyle = '#ffe600';
                ctx.fillText(`COMBO x${combo}`, 20, 85);
            }

            // High Score + record holder name (always visible while playing)
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ff0055';
            ctx.fillText(`HIGH: ${high}`, canvas.width - 20, 35);
            if (championName) {
                ctx.font = 'bold 11px monospace';
                ctx.fillText(`★ ${championName.toUpperCase().slice(0, 20)}`, canvas.width - 20, 76);
                ctx.font = 'bold 14px monospace';
            }

            // Lives Mini Icons
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2;
            for (let i = 0; i < player.lives; i++) {
                const lx = canvas.width - 30 - (i * 25);
                const ly = 55;
                ctx.beginPath();
                ctx.moveTo(lx, ly - 8);
                ctx.lineTo(lx - 7, ly + 7);
                ctx.lineTo(lx + 7, ly + 7);
                ctx.closePath();
                ctx.stroke();
            }

            ctx.restore();
        }

        starfield = new Starfield();
        synthGrid = new SynthGrid();

        let rafId = null;
        function gameLoop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Screen Shake Effect
            ctx.save();
            if (screenShake > 0) {
                const sx = (Math.random() - 0.5) * screenShake;
                const sy = (Math.random() - 0.5) * screenShake;
                ctx.translate(sx, sy);
                screenShake *= 0.9;
                if (screenShake < 0.5) screenShake = 0;
            }

            // Draw Background Elements
            starfield.update();
            starfield.draw();
            synthGrid.update();
            synthGrid.draw();

            if (gameStateLocal === 'PLAYING') {
                // Combo Decay Timer
                if (comboTimer > 0) {
                    comboTimer--;
                    if (comboTimer <= 0) combo = 1;
                }

                // Update & Draw Player
                player.update();
                player.draw();

                // Update & Draw Player Bullets
                bullets.forEach((b, i) => {
                    b.update();
                    b.draw();
                    if (b.y < -20 || b.x < 0 || b.x > canvas.width) bullets.splice(i, 1);
                });

                // Update & Draw Enemy Bullets
                enemyBullets.forEach((eb, i) => {
                    eb.update();
                    eb.draw();
                    if (eb.y > canvas.height + 20) enemyBullets.splice(i, 1);
                });

                // Update & Draw Enemies
                enemies.forEach(e => {
                    e.update();
                    e.draw();
                });

                // Check Wave Completion
                if (enemies.length === 0) {
                    wave++;
                    spawnWave(wave);
                }

                // Update & Draw Powerups
                powerUps.forEach((p, i) => {
                    p.update();
                    p.draw();
                    if (p.y > canvas.height + 20) powerUps.splice(i, 1);
                });

                // Update & Draw Particles
                particles.forEach((p, i) => {
                    p.update();
                    p.draw();
                    if (p.life <= 0) particles.splice(i, 1);
                });

                // Collisions Check
                checkCollisions();

                // Render HUD
                drawHUD();
            }

            ctx.restore();
            rafId = requestAnimationFrame(gameLoop);
        }

        // State Machine Switches
        function startGame() {
            sound.init();
            sound.startSynthwaveBGM();
            score = 0;
            wave = 1;
            combo = 1;
            bullets = [];
            enemyBullets = [];
            powerUps = [];
            particles = [];
            player.reset();
            spawnWave(wave);

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

            // Only assigned players get their record saved; guest scores are discarded
            const playerId = playerRef.current;
            const name = playerId ? directoryRef.current[playerId] : null;
            if (name) {
                const prevChampion = computeGameChampion(DataStore.getGameRecords(), DataStore.getStudents());
                const prevChampionScore = prevChampion ? prevChampion.score : 0;
                DataStore.saveGameRecord(playerId, score, name);
                const updated = DataStore.getGameRecords();
                setRecords(updated);
                setIsNewChampion(score > prevChampionScore && score > 0);
                if (score > high) high = score;
                const newChampion = computeGameChampion(updated, DataStore.getStudents());
                championName = newChampion ? newChampion.name : '';
            } else {
                setIsNewChampion(false);
            }

            setFinalScore(score);
            setHighScore(high);
        }

        // Bridge used by the React overlays and touch controls
        engineRef.current = {
            startGame,
            togglePause,
            initSound: () => sound.init(),
            moveTo: (clientX) => {
                if (gameStateLocal !== 'PLAYING') return;
                const rect = canvas.getBoundingClientRect();
                const newX = clientX - rect.left;
                player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, newX));
            },
        };

        rafId = requestAnimationFrame(gameLoop);

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
        onTouchStart: (e) => { e.preventDefault(); touchStateRef.current[keyName] = true; engineRef.current.initSound(); },
        onTouchEnd: (e) => { e.preventDefault(); touchStateRef.current[keyName] = false; },
    });

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
                onTouchMove={(e) => { if (e.touches.length > 0) engineRef.current.moveTo(e.touches[0].clientX); }}
            />
            <div className="sg-scanlines" />

            {gameState === 'START' && (
                <div className="sg-overlay">
                    <h2 className="sg-neon-title">{t('spaceGame')}</h2>
                    <div className="sg-neon-subtitle">CYBERPUNK INVASION</div>
                    <p style={{ color: '#67e8f9', marginBottom: '1rem', fontSize: '0.9rem', maxWidth: '420px' }}>
                        {t('gameTagline')}
                    </p>

                    {/* Current record holder: name + score + date */}
                    <div style={{ marginBottom: '1rem', fontSize: '0.95rem', textAlign: 'center', maxWidth: '420px' }}>
                        {champion ? (
                            <span style={{ color: '#facc15', fontWeight: 700 }}>
                                🏆 {t('gameChampion')}: {champion.name}{champion.course ? ` · ${champion.course}` : ''} · {champion.score} · {formatRecordDate(champion.date, settings.language)}
                            </span>
                        ) : (
                            <span style={{ color: '#94a3b8' }}>{t('gameNoChampionYet')}</span>
                        )}
                    </div>

                    {/* Player selector: teacher + directors + students by course */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: selectedPlayerRecord ? '0.25rem' : '1.5rem' }}>
                        <label htmlFor="sg-player-select" style={{ color: '#67e8f9', fontSize: '0.85rem' }}>{t('gameSelectPlayer')}:</label>
                        <select
                            id="sg-player-select"
                            value={playerDirectory[selectedPlayerId] ? selectedPlayerId : ''}
                            onChange={handlePlayerSelect}
                            style={{
                                background: '#0a0a14',
                                color: '#e2e8f0',
                                border: '1px solid #00f3ff',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '0.85rem',
                                fontFamily: 'monospace',
                                maxWidth: '240px'
                            }}
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
                            {t('gamePersonalBest')}: {selectedPlayerRecord.score} · {formatRecordDate(selectedPlayerRecord.date, settings.language)}
                        </div>
                    )}

                    <button className="sg-neon-button" onClick={() => engineRef.current.startGame()}>
                        {t('gameStart')}
                    </button>
                    <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>{t('gameControls')}</p>
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
                    {selectedPlayerRecord && (
                        <div style={{ fontSize: '1rem', color: '#67e8f9', marginBottom: '0.25rem' }}>
                            {t('gamePersonalBest')}: {selectedPlayerRecord.score} · {formatRecordDate(selectedPlayerRecord.date, settings.language)}
                        </div>
                    )}
                    <div style={{ fontSize: '1.1rem', color: '#facc15', marginBottom: champion ? '0.25rem' : '1.5rem' }}>
                        {t('gameHighScore')}: {highScore}
                    </div>
                    {champion && (
                        <div style={{ fontSize: '1rem', color: '#facc15', marginBottom: '1.5rem' }}>
                            🏆 {t('gameChampion')}: {champion.name} · {champion.score} · {formatRecordDate(champion.date, settings.language)}
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
                        <div className="sg-touch-btn" {...touchBtnHandlers('right')}>&#9654;</div>
                    </div>
                    <div className="sg-touch-btn sg-touch-btn-fire" {...touchBtnHandlers('fire')}>&#9889;</div>
                </div>
            )}
        </div>
    );
}
