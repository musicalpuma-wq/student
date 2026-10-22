import { DataStore } from '../services/DataStore';
import { BOGOTA_TIMEZONE } from './dateUtils';

/*
 * Shared helpers for the Tools-page games (SpaceGame, TetrisGame).
 */

// Highest record among game records. Uses the name embedded in the record
// when present; falls back to the student roster for legacy records saved
// before names were embedded (records of deleted students without an
// embedded name are ignored). Returns { playerId, name, course, score, date }.
export const computeGameChampion = (records, students = []) => {
    let champion = null;
    for (const [playerId, rec] of Object.entries(records || {})) {
        if (!rec) continue;
        const student = students.find(s => s.id === playerId);
        const name = rec.name || (student && student.name);
        if (!name) continue;
        if (!champion || rec.score > champion.score) {
            champion = { playerId, name, course: student ? student.course : '', score: rec.score, date: rec.date };
        }
    }
    return champion;
};

// Staff players for the game selectors: one entry per course that has a group
// director assigned. The teacher entry is added by the caller because the
// name comes from reactive settings.
export const buildStaffDirectors = () =>
    DataStore.getCourses()
        .map(course => {
            const name = (DataStore.getCourseDetails(course).director || '').trim();
            return name ? { id: `__director__${course}`, name, course } : null;
        })
        .filter(Boolean);

// Short locale-aware date for record displays ("18 oct 2026" / "Oct 18, 2026")
export const formatRecordDate = (iso, language) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(language === 'en' ? 'en-US' : 'es-CO', {
        timeZone: BOGOTA_TIMEZONE,
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};
