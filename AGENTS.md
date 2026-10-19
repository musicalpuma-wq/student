# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

**Listados** (package name `student-management`) is a single-teacher student
management web app: course rosters, gradebook, attendance, behavior
observations ("Observador"), materials tracking, performance statistics,
and PDF report generation.
It is a **fully client-side single-page application** — there is no backend.
All data lives in the browser's `localStorage`.

The UI is Spanish-first (default language `'es'`, with English translations
available); code, comments, and documentation are in English.

## Repository and GitHub Access (important — do not mix accounts)

- GitHub repo: `musicalpuma-wq/student` (owner's **personal** account
  `musicalpuma-wq`), branch `main`.
- The `origin` remote uses the SSH alias `github-musical`:
  `git@github-musical:musicalpuma-wq/student.git`. The alias is defined in
  `~/.ssh/config` and points to the dedicated key `~/.ssh/id_ed25519_musical`
  (ed25519, registered in the `musicalpuma-wq` GitHub account).
- Commits are signed with repo-local identity `John Herrera
  <johnmaohd@gmail.com>` (local `git config`, not global).
- **Never use the `Evetev-Dev` account for this repo.** That is the company
  account, used for unrelated work projects via HTTPS credential helpers.
  This project must stay 100% on the personal SSH key; pushes as Evetev-Dev
  fail with 403 (by design).
- If a push fails with "Permission denied to Evetev-Dev", the remote URL was
  probably reset to HTTPS — restore it with:
  `git remote set-url origin git@github-musical:musicalpuma-wq/student.git`

## Tech Stack

- **React 19** (plain JSX, no TypeScript) + **Vite 7** (`@vitejs/plugin-react`)
- **react-router-dom 7** (`BrowserRouter`)
- **jspdf + jspdf-autotable** for PDF report generation
- **lucide-react** for icons
- ESLint 9 (flat config), no test framework, no CI

## Build and Development Commands

```bash
npm install        # install dependencies (package-lock.json present)
npm run dev        # Vite dev server with HMR
npm run build      # production build -> dist/
npm run preview    # preview the production build
npm run lint       # eslint .
```

Notes:

- `npm run build` currently succeeds but warns that the main chunk is >500 kB.
- `npm run lint` currently reports pre-existing errors (~24, mostly
  `react-hooks/set-state-in-effect`, a few `no-unused-vars`, and
  `react-refresh/only-export-components` in the context files). Do not assume a
  clean baseline — when changing code, keep the files you touch no worse.
- There are **no tests** and no test runner configured.

## Deployment

- Deployed to **Netlify** (`netlify.toml`): build command `npm run build`,
  publish dir `dist`, with an SPA fallback redirect (`/* -> /index.html`).
- `public/_redirects` duplicates the SPA fallback; `dist/` is build output and
  should never be edited directly.

## Code Organization

```
src/
  main.jsx                  Entry point
  App.jsx                   Auth gate + route definitions
  index.css                 Global styles, CSS variables (theming), utility classes
  pages/
    Login.jsx               Password gate
    Dashboard.jsx           Stats, course overview/creation
    StudentRegistration.jsx Student CRUD form/list
    CourseGradebook.jsx     Core screen (~2400 lines): grades, attendance,
                            observer (annotations), materials tabs. The grades
                            table ends with Heteroevaluación (final average),
                            Co-evaluación and Auto-evaluación columns; co/auto
                            entries must stay within ±25% of the
                            heteroevaluation (rejected with an alert otherwise)
                            and are blocked while no average exists. All grade
                            inputs accept a digit shorthand on blur: "5" ->
                            "5.0", "45" -> "4.5" (see utils/gradeUtils.js)
    Statistics.jsx          Cross-course performance metrics with course
                            checkboxes: averages, pass rate, best/low
                            students, hardest/easiest activities, distribution
    Downloads.jsx           PDF report download center
    Tools.jsx               Classroom tools, each card with a fullscreen
                            button (native Fullscreen API): timer (quick-set
                            5/10/15 min plus free min:sec entry, visual +
                            sound alarm; state lives in TimerContext so it
                            keeps running across pages, with a FloatingTimer
                            mini widget shown outside /tools),
                            metronome (60/90/120 BPM presets, time signatures
                            2/4, 3/4, 4/4 and custom n/m with compound-meter
                            accents), tone generator (chromatic scale, custom
                            Hz, dedicated A440, 5-octave piano keyboard C2–B6,
                            6 timbres: sine/triangle/square/sawtooth plus
                            piano and organ via PeriodicWave), the
                            SpaceGame (Neon Galaga canvas shooter) and the
                            TetrisGame (glow-neon Tetris clone). Each game
                            card shows its cover art (src/assets/games/) and
                            the current record holder; clicking opens the
                            game fullscreen.
                            All sound uses the Web Audio API; no audio assets.
  components/
    Layout.jsx              Shell with Sidebar + <Outlet/>; owns the collapsed
                            state of the sidebar and mounts FloatingTimer
    Sidebar.jsx             Nav, backup download/restore, settings entry;
                            collapsible to icon-only (76 px) mode
    SettingsModal.jsx       Teacher name, subject, language, theme, font size,
                            Dashboard course visibility (per period)
    GenericModal.jsx        Reusable alert/confirm/prompt modal
    FloatingTimer.jsx       Corner widget mirroring the global timer when it
                            runs (or rings) outside /tools; click returns there
    SpaceGame.jsx           Neon Galaga: canvas space shooter (own Web Audio
                            synth, touch controls). One life per run (no LIFE
                            power-up). The start screen has a player selector
                            (students grouped by course, the teacher and group
                            directors, or guest) and shows the current record
                            holder with score + date; per-player records are
                            stored in DataStore `gameRecords` with the name
                            embedded in new records (guest scores are not
                            saved). The record holder is also shown on the
                            Tools launcher card and in the in-game HUD
    TetrisGame.jsx          Neon Blocks: glow-neon Tetris clone (canvas, own
                            Web Audio synth, touch controls, ghost piece,
                            7-bag randomizer). Player selector lists the
                            teacher and group directors alongside students by
                            course (or guest); per-player records are stored
                            in DataStore `tetrisRecords` with the name
                            embedded, shown with score + date (guest scores
                            are not saved). Reuses the `sg-*` overlay/launcher
                            styles from SpaceGame. The record holder is also
                            shown on the Tools launcher card and in the HUD
    RandomPickerModal.jsx   Random student picker with roulette animation and
                            sounds; modes: no-repeat (pool of pickedIds kept by
                            CourseGradebook) or repeats allowed
  context/
    SettingsContext.jsx     Settings state, theme application, t() translator
    GlobalModalContext.jsx  showAlert/showConfirm/showPrompt hooks
    TimerContext.jsx        Global countdown timer state + alarm (survives
                            navigation); consumed by Tools and FloatingTimer
  services/
    DataStore.js            All persistence (localStorage) + data migrations
    PDFGenerator.js         All PDF report generation (jsPDF + autotable)
  utils/
    translations.js         es/en string tables
    spriteUtils.js          Mascot sprite-sheet helpers (course animal by hash)
    audioUtils.js           Shared lazy AudioContext, playBlip, formatTime
    gameUtils.js            Shared game helpers: champion computation, staff
                            player list (teacher/directors), record date format
    gradeUtils.js           Grade digit-shorthand formatter ("45" -> "4.5")
                            and ±25% evaluation-range helpers
  assets/mascots/           PNG sprite sheets (dog, bear, fox; 5 expressions each)
  assets/games/             Game cover art (space-cover.jpg, tetris-cover.jpg)
                            shown on the Tools game cards
```

### Routing

Routes live in `src/App.jsx`: `/` (Dashboard), `/register`
(StudentRegistration), `/course/:courseId` (CourseGradebook), `/statistics`
(Statistics), `/tools` (Tools), `/downloads` (Downloads). All are wrapped in
`Layout`. If
`isAuthenticated` is false, only `Login` renders — auth is **in-memory
only**, so a page reload logs the user out (this is intentional; see the
comment in `App.jsx`).

## Data Model and Persistence (important)

Everything is stored under the `localStorage` key `sms_data_v1`, accessed
exclusively through `src/services/DataStore.js`:

```js
{
  version: 'v2',
  students: [ { id, name, course, birthDate, age, parentName, parentPhone,
                parentPhone2, parentEmail, vpsCode, jornada,
                grades, attendance, materials, annotations,
                coevaluation, autoevaluation } ],
  courses: [ 'CourseName', ... ],          // explicit, sorted list
  courseDetails: { courseName: { director, schedule } },
  activities: { 'period_courseName': [ { id, name, date, locked } ] },
  materials:  { 'period_courseName': [ { id, name } ] },
  gameRecords: { playerId: { score, date, name? } }   // SpaceGame per-player
                            // best; playerId is a student id, '__teacher__' or
                            // '__director__<course>'; name is embedded in new
                            // records (legacy records resolve via the roster)
  tetrisRecords: { playerId: { score, date, name } }   // Tetris per-player best;
                            // playerId is a student id, '__teacher__' or
                            // '__director__<course>'; name is embedded so the
                            // record display survives roster/staff edits
}
```

Key conventions:

- **Academic periods**: there are 4 periods (`'1'`–`'4'`). Activities and
  materials are keyed as `${period}_${courseName}`. Student-level `grades`,
  `attendance`, `materials`, `annotations`, `coevaluation`, and
  `autoevaluation` are objects keyed by period.
  The active period comes from `settings.currentPeriod`.
- **Migrations**: `DataStore.load()` transparently migrates legacy flat
  (pre-v2) data into period-scoped format and re-saves. Any change to the data
  shape must extend this migration logic, because users restore old backup
  JSON files.
- **Renames/deletes cascade**: `updateCourseName` and `deleteCourse` update
  the course list, students, and all period-prefixed `activities`/`materials`
  keys. Empty courses are allowed (deleting the last student does not remove
  the course).
- `sanitizeStudent` fills defaults (`"Pending"`) and derives `age` from
  `birthDate`.
- IDs are generated with `crypto.randomUUID()`.

Other localStorage keys: `sms_settings` (teacher name, subject, language,
themeMode, fontSize, currentPeriod, dashboardHidden), `app_password` (login
password), `sms_late_times` (late-arrival time cache in CourseGradebook),
`sms_perf_chart_hidden` (courses hidden from the Dashboard performance
chart, keyed by period: `{ [period]: [courseName] }`),
`sms_sidebar_collapsed` (`'1'` when the sidebar is collapsed to icons),
`neon_galaga_highscore` (legacy SpaceGame high score — now read-only baseline;
current records live in `gameRecords` inside `sms_data_v1`),
`neon_galaga_player` (last selected SpaceGame player id),
`neon_tetris_player` (last selected Tetris player id).

`settings.dashboardHidden` hides courses from the whole Dashboard (course
cards, quick-access dropdown and performance chart) without deleting them,
keyed by period: `{ [period]: [courseName] }`. Courses not listed are
visible, so new courses are visible by default. Other pages (Statistics,
Downloads, registration) always list all courses.

**Backup/restore**: the Sidebar downloads the raw `sms_data_v1` JSON as
`backup-YYYY-MM-DD-HHmm.json` and restores by overwriting that key, then
reloads the page. A sample backup (`backup-2026-03-29-1715.json`) sits in the
repo root.

## Architecture Patterns and Conventions

- **State**: local `useState` in pages + three React contexts (Settings,
  GlobalModal, Timer). There is no
  global store. Pages read via `DataStore` getters and re-render via a
  `refreshTrigger` counter after mutations.
- **i18n**: never hardcode UI strings in pages — add keys to both `es` and
  `en` tables in `src/utils/translations.js` and render with `t('key')` from
  `useSettings()`. Spanish is the default/fallback language.
- **Theming**: CSS custom properties in `src/index.css` (Apple-inspired
  palette). Dark mode is toggled by `data-theme="dark"` on `<html>`;
  `themeMode: 'auto'` switches by time of day (dark 18:00–06:00).
  `themeMode: 'cyberpunk'` sets `data-theme="cyberpunk"`, a neon/glow
  variant whose palette and hover effects are overrides at the end of
  `src/index.css` (scope new cyberpunk rules under
  `:root[data-theme='cyberpunk']`). Use the `var(--color-*)` variables
  rather than hardcoded colors; for text/icons drawn on top of
  `--color-accent` use `--color-on-accent` (white in light/dark, dark ink
  in cyberpunk). Many components use inline styles
  referencing these variables; match that idiom.
- **Modals**: use `useGlobalModal()` (`showAlert`, `showConfirm`,
  `showPrompt`) instead of `window.confirm`/`alert`.
- **Components** are named exports (`export function Foo`), one per file,
  PascalCase filenames.
- **ESLint**: flat config in `eslint.config.js`; `no-unused-vars` errors
  unless the variable matches `^[A-Z_]`. react-hooks and react-refresh rules
  are enabled.

## Security Considerations

This is a personal, trust-the-local-user app — treat its "security" features
accordingly and do not mistake them for real access control:

- The login password is checked against `localStorage.getItem('app_password')`
  with a **hardcoded fallback `'6251'`** in `src/pages/Login.jsx`. It is
  trivially bypassable and only meant to keep casual users out.
- All student data (names, parent contacts, grades, behavior notes) is stored
  unencrypted in `localStorage` and in downloadable backup JSON files.
- Some destructive actions in `CourseGradebook` are gated by a security-code
  modal and timed confirmation inputs; preserve these guards when editing
  those flows.
