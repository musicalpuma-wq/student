export const BOGOTA_TIMEZONE = 'America/Bogota';

/**
 * Returns the date formatted as YYYY-MM-DD in America/Bogota timezone.
 * Prevents UTC rollover issues (e.g. after 7:00 PM in Colombia when toISOString() jumps to the next day).
 */
export function getBogotaDateString(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BOGOTA_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
}

/**
 * Returns a localized date string (e.g., DD/MM/YYYY) in America/Bogota timezone.
 */
export function formatBogotaDate(date = new Date(), locale = 'es-CO', options = {}) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(locale, {
        timeZone: BOGOTA_TIMEZONE,
        ...options
    }).format(d);
}

/**
 * Returns a 12-hour time string (hh:mm a. m./p. m.) in America/Bogota timezone.
 */
export function getBogotaTimeString(date = new Date(), locale = 'es-CO') {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(locale, {
        timeZone: BOGOTA_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Returns compact HHmm in 24-hour format in America/Bogota timezone (useful for backup filenames).
 */
export function getBogotaHHMM(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '0000';
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: BOGOTA_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(d);
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    return `${hour}${minute}`;
}

/**
 * Returns the current hour (0-23) in America/Bogota timezone.
 */
export function getBogotaHour(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return 12;
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: BOGOTA_TIMEZONE,
        hour: 'numeric',
        hour12: false
    }).formatToParts(d);
    const hourStr = parts.find(p => p.type === 'hour')?.value || '0';
    const hour = parseInt(hourStr, 10);
    return hour === 24 ? 0 : hour;
}

/**
 * Returns the current 4-digit year in America/Bogota timezone.
 */
export function getBogotaYear(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return new Date().getFullYear();
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BOGOTA_TIMEZONE,
        year: 'numeric'
    }).formatToParts(d);
    return parseInt(parts.find(p => p.type === 'year')?.value || String(new Date().getFullYear()), 10);
}
