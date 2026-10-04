const LOCALE = 'en-GB';
const DAY_HEADING_FORMAT = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const FULL_DATE_FORMAT = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const TIME_FORMAT = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const SHORT_DATE_WITH_YEAR_FORMAT = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const LAST_HOUR_OF_DAY = 23;
const MINUTES_THAT_ROUND_UP = 30;
const NUMBER_FORMAT = new Intl.NumberFormat(LOCALE);
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Turn a camera timestamp into a Date that keeps the camera's wall-clock time.
 * @param {?string} takenAt Timestamp such as 2026-10-01T14:23:05.
 * @returns {?Date} The wall-clock time, or null when unknown.
 */
export function parseTakenAt(takenAt) {
  const match = TIMESTAMP_PATTERN.exec(takenAt ?? '');
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Turn a day key into a Date at midnight.
 * @param {string} dayKey Day such as 2026-10-01.
 * @returns {?Date} The day, or null for an invalid key.
 */
export function parseDayKey(dayKey) {
  const match = DAY_KEY_PATTERN.exec(dayKey ?? '');
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a day as a heading.
 * @param {string} dayKey Day such as 2026-10-01.
 * @returns {string} Text such as "Thursday 1 October".
 */
export function formatDayHeading(dayKey) {
  const day = parseDayKey(dayKey);
  return day ? DAY_HEADING_FORMAT.format(day) : 'Date unknown';
}

/**
 * Format the span between two days.
 * @param {string} firstDayKey First day.
 * @param {string} lastDayKey Last day.
 * @returns {string} Text such as "1–18 October 2026".
 */
export function formatDateRange(firstDayKey, lastDayKey) {
  const firstDay = parseDayKey(firstDayKey);
  const lastDay = parseDayKey(lastDayKey);
  if (!firstDay || !lastDay) return '';
  if (firstDayKey === lastDayKey) return FULL_DATE_FORMAT.format(firstDay);
  return FULL_DATE_FORMAT.formatRange(firstDay, lastDay);
}

/**
 * Format a timestamp as a full calendar date.
 * @param {?string} timestamp ISO timestamp.
 * @returns {string} Text such as "3 October 2026", or an empty string.
 */
export function formatCalendarDate(timestamp) {
  const date = parseTakenAt(timestamp);
  return date ? FULL_DATE_FORMAT.format(date) : '';
}

/**
 * Format the day and the hour a photo was taken, rounded to the nearest hour.
 * @param {?string} takenAt Camera timestamp.
 * @returns {string} Text such as "Thu 1 Oct, 14:00".
 */
export function formatDateTime(takenAt) {
  const date = parseTakenAt(takenAt);
  return date ? DATE_TIME_FORMAT.format(roundedToHour(date)) : 'Date unknown';
}

/**
 * Format the hour a photo was taken, rounded to the nearest hour.
 * @param {?string} takenAt Camera timestamp.
 * @returns {string} Text such as "14:00", or an empty string.
 */
export function formatTime(takenAt) {
  const date = parseTakenAt(takenAt);
  return date ? TIME_FORMAT.format(roundedToHour(date)) : '';
}

/**
 * Format the days between two days in short form, including the year.
 * @param {?string} firstDayKey First day.
 * @param {?string} lastDayKey Last day.
 * @returns {string} Text such as "26 Sept – 3 Oct 2026", or an empty string.
 */
export function formatShortDateRangeWithYear(firstDayKey, lastDayKey) {
  const firstDay = parseDayKey(firstDayKey);
  const lastDay = parseDayKey(lastDayKey);
  if (!firstDay || !lastDay) return '';
  if (firstDayKey === lastDayKey) return SHORT_DATE_WITH_YEAR_FORMAT.format(firstDay);
  return SHORT_DATE_WITH_YEAR_FORMAT.formatRange(firstDay, lastDay);
}

/**
 * Format the days between two days in short form.
 * @param {string} firstDayKey First day.
 * @param {string} lastDayKey Last day.
 * @returns {string} Text such as "26 Sept – 3 Oct", or a single day.
 */
export function formatShortDateRange(firstDayKey, lastDayKey) {
  const firstDay = parseDayKey(firstDayKey);
  const lastDay = parseDayKey(lastDayKey);
  if (!firstDay || !lastDay) return '';
  if (firstDayKey === lastDayKey) return SHORT_DATE_FORMAT.format(firstDay);
  return SHORT_DATE_FORMAT.formatRange(firstDay, lastDay);
}

/**
 * Format a position in degrees with compass directions.
 * @param {number} latitude Latitude in degrees.
 * @param {number} longitude Longitude in degrees.
 * @returns {string} Text such as "35.6595° N, 139.7005° E".
 */
export function formatCoordinates(latitude, longitude) {
  const latitudeText = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const longitudeText = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
  return `${latitudeText}, ${longitudeText}`;
}

/**
 * Format a number with thousands separators.
 * @param {number} value Number to format.
 * @returns {string} Formatted number.
 */
export function formatNumber(value) {
  return NUMBER_FORMAT.format(value);
}

/**
 * Format a count with the matching noun.
 * @param {number} count Number of items.
 * @param {string} singular Noun for one item.
 * @param {string} plural Noun for several items.
 * @returns {string} Text such as "12 photos".
 */
export function formatCount(count, singular, plural) {
  return `${NUMBER_FORMAT.format(count)} ${count === 1 ? singular : plural}`;
}

function roundedToHour(date) {
  const roundsUp = date.getMinutes() >= MINUTES_THAT_ROUND_UP && date.getHours() < LAST_HOUR_OF_DAY;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + (roundsUp ? 1 : 0));
}
