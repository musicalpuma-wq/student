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
- `npm run lint` currently reports pre-existing errors (~23, mostly
  `react-hooks/set-state-in-effect` and one `no-unused-vars`). Do not assume a
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
    CourseGradebook.jsx     Core screen (~2200 lines): grades, attendance,
                            observer (annotations), materials tabs
    Statistics.jsx          Cross-course performance metrics with course
                            checkboxes: averages, pass rate, best/low
                            students, hardest/easiest activities, distribution
    Downloads.jsx           PDF report download center
  components/
    Layout.jsx              Shell with Sidebar + <Outlet/>
    Sidebar.jsx             Nav, backup download/restore, settings entry
    SettingsModal.jsx       Teacher name, subject, language, theme, period
    GenericModal.jsx        Reusable alert/confirm/prompt modal
  context/
    SettingsContext.jsx     Settings state, theme application, t() translator
    GlobalModalContext.jsx  showAlert/showConfirm/showPrompt hooks
  services/
    DataStore.js            All persistence (localStorage) + data migrations
    PDFGenerator.js         All PDF report generation (jsPDF + autotable)
  utils/
    translations.js         es/en string tables
    spriteUtils.js          Mascot sprite-sheet helpers (course animal by hash)
  assets/mascots/           PNG sprite sheets (dog, bear, fox; 5 expressions each)
```

### Routing

Routes live in `src/App.jsx`: `/` (Dashboard), `/register`
(StudentRegistration), `/course/:courseId` (CourseGradebook), `/statistics`
(Statistics), `/downloads` (Downloads). All are wrapped in `Layout`. If
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
                grades, attendance, materials, annotations } ],
  courses: [ 'CourseName', ... ],          // explicit, sorted list
  courseDetails: { courseName: { director, schedule } },
  activities: { 'period_courseName': [ { id, name, date, locked } ] },
  materials:  { 'period_courseName': [ { id, name } ] }
}
```

Key conventions:

- **Academic periods**: there are 4 periods (`'1'`–`'4'`). Activities and
  materials are keyed as `${period}_${courseName}`. Student-level `grades`,
  `attendance`, `materials`, and `annotations` are objects keyed by period.
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
themeMode, fontSize, currentPeriod), `app_password` (login password),
`sms_late_times` (late-arrival time cache in CourseGradebook),
`sms_perf_chart_hidden` (courses hidden from the Dashboard performance
chart, keyed by period: `{ [period]: [courseName] }`).

**Backup/restore**: the Sidebar downloads the raw `sms_data_v1` JSON as
`backup-YYYY-MM-DD-HHmm.json` and restores by overwriting that key, then
reloads the page. A sample backup (`backup-2026-03-29-1715.json`) sits in the
repo root.

## Architecture Patterns and Conventions

- **State**: local `useState` in pages + two React contexts. There is no
  global store. Pages read via `DataStore` getters and re-render via a
  `refreshTrigger` counter after mutations.
- **i18n**: never hardcode UI strings in pages — add keys to both `es` and
  `en` tables in `src/utils/translations.js` and render with `t('key')` from
  `useSettings()`. Spanish is the default/fallback language.
- **Theming**: CSS custom properties in `src/index.css` (Apple-inspired
  palette). Dark mode is toggled by `data-theme="dark"` on `<html>`;
  `themeMode: 'auto'` switches by time of day (dark 18:00–06:00). Use the
  `var(--color-*)` variables rather than hardcoded colors. Many components use
  inline styles referencing these variables; match that idiom.
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
