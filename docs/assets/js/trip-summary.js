const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Tell whether a photo has a usable location.
 * @param {object} photo Published photo.
 * @returns {boolean} True when latitude and longitude are known.
 */
export function hasLocation(photo) {
  return Number.isFinite(photo.latitude) && Number.isFinite(photo.longitude);
}

/**
 * Get the calendar day a photo was taken on.
 * @param {?string} takenAt Camera timestamp.
 * @returns {?string} Day such as 2026-10-01, or null when unknown.
 */
export function dayKeyOf(takenAt) {
  return typeof takenAt === 'string' && takenAt.length >= 10 ? takenAt.slice(0, 10) : null;
}

/**
 * Group photos by the day they were taken, numbering days from the start of the trip.
 * @param {object[]} photos Published photos in chronological order.
 * @returns {{dayKey: ?string, dayNumber: ?number, photos: object[]}[]} Day groups, undated photos last.
 */
export function groupPhotosByDay(photos) {
  const photosByDay = new Map();
  for (const photo of photos) {
    const dayKey = dayKeyOf(photo.takenAt);
    if (!photosByDay.has(dayKey)) photosByDay.set(dayKey, []);
    photosByDay.get(dayKey).push(photo);
  }
  const datedKeys = [...photosByDay.keys()].filter(Boolean).sort();
  const firstDayKey = datedKeys[0];
  const groups = datedKeys.map((dayKey) => ({
    dayKey,
    dayNumber: calendarDaysBetween(firstDayKey, dayKey) + 1,
    photos: photosByDay.get(dayKey),
  }));
  if (photosByDay.has(null)) groups.push({ dayKey: null, dayNumber: null, photos: photosByDay.get(null) });
  return groups;
}

/**
 * Compute the headline figures for the trip.
 * @param {object[]} photos Published photos in chronological order.
 * @returns {{photoCount: number, locatedCount: number, dayCount: number, firstDayKey: ?string, lastDayKey: ?string}} Trip figures.
 */
export function summarizeTrip(photos) {
  const dayKeys = photos.map((photo) => dayKeyOf(photo.takenAt)).filter(Boolean).sort();
  const firstDayKey = dayKeys[0] ?? null;
  const lastDayKey = dayKeys.at(-1) ?? null;
  return {
    photoCount: photos.length,
    locatedCount: photos.filter(hasLocation).length,
    dayCount: firstDayKey ? calendarDaysBetween(firstDayKey, lastDayKey) + 1 : 0,
    firstDayKey,
    lastDayKey,
  };
}

function calendarDaysBetween(firstDayKey, secondDayKey) {
  const toUtcDay = (dayKey) => {
    const [year, month, day] = dayKey.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtcDay(secondDayKey) - toUtcDay(firstDayKey)) / MILLISECONDS_PER_DAY);
}
