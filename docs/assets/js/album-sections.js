import { formatDayHeading, formatShortDateRange, formatTime } from './formatting.js';
import { dayKeyOf, groupPhotosByDay, hasLocation } from './trip-summary.js';

const OTHER_PLACES = 'other-places';
const NO_LOCATION = 'no-location';

/**
 * Split the photos into one album section per day.
 * @param {object[]} photos Published photos, newest first.
 * @returns {{eyebrow: string, title: string, titleJa: ?string, photos: object[], caption: function(object): string}[]}
 *   Sections, newest day first.
 */
export function sectionsByDate(photos) {
  return groupPhotosByDay(photos).map((group) => ({
    eyebrow: group.dayNumber ? `Day ${group.dayNumber}` : 'Undated',
    title: group.dayKey ? formatDayHeading(group.dayKey) : 'Date unknown',
    titleJa: null,
    photos: group.photos,
    caption: (photo) => (hasLocation(photo) ? formatTime(photo.takenAt) : joinParts(formatTime(photo.takenAt), 'no location')),
  }));
}

/**
 * Split the photos into one album section per area, most recently visited area first.
 * @param {object[]} photos Published photos, newest first.
 * @param {object[]} areas Areas from areas.json with the ids of their photos.
 * @returns {{eyebrow: string, title: string, titleJa: ?string, photos: object[], caption: function(object): string}[]}
 *   Sections for the areas, followed by photos outside every area and photos without a location.
 */
export function sectionsByPlace(photos, areas) {
  const areaOfPhoto = new Map(areas.flatMap((area) => (area.photoIds ?? []).map((photoId) => [photoId, area])));
  const photosByPlace = new Map();
  for (const photo of photos) {
    const placeKey = areaOfPhoto.get(photo.id)?.id ?? (hasLocation(photo) ? OTHER_PLACES : NO_LOCATION);
    if (!photosByPlace.has(placeKey)) photosByPlace.set(placeKey, []);
    photosByPlace.get(placeKey).push(photo);
  }
  const areasById = new Map(areas.map((area) => [area.id, area]));
  const placeKeys = [...photosByPlace.keys()].sort(
    (first, second) => placeRank(first, areasById) - placeRank(second, areasById),
  );
  return placeKeys.map((placeKey) => {
    const placePhotos = photosByPlace.get(placeKey);
    const area = areasById.get(placeKey);
    return {
      eyebrow: daySpanOf(placePhotos),
      title: area?.name ?? (placeKey === OTHER_PLACES ? 'Other places' : 'No location'),
      titleJa: area?.nameJa ?? null,
      photos: placePhotos,
      caption: (photo) => joinParts(formatShortDateRange(dayKeyOf(photo.takenAt), dayKeyOf(photo.takenAt)), formatTime(photo.takenAt)),
    };
  });
}

function placeRank(placeKey, areasById) {
  if (areasById.has(placeKey)) return 0;
  return placeKey === OTHER_PLACES ? 1 : 2;
}

function daySpanOf(photos) {
  const dayKeys = photos.map((photo) => dayKeyOf(photo.takenAt)).filter(Boolean).sort();
  return dayKeys.length ? formatShortDateRange(dayKeys[0], dayKeys.at(-1)) : 'Undated';
}

function joinParts(...parts) {
  return parts.filter(Boolean).join(' · ');
}
