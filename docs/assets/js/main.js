import { createAlbumView } from './album-view.js';
import { formatCalendarDate, formatDateRange, formatDistance, formatNumber } from './formatting.js';
import { enableArrowKeySelection } from './keyboard-selection.js';
import { createLightbox } from './lightbox.js';
import { createMapView } from './map-view.js';
import { groupPhotosByDay, summarizeTrip } from './trip-summary.js';

const MANIFEST_URL = 'data/photos.json';
const ROUTE_URL = 'data/route.json';
const EMPTY_ROUTE = { areas: [], connections: [], localPaths: [], distanceKm: null };

/**
 * Load the list of published photos.
 * @returns {Promise<{generatedAt: ?string, photos: object[]}>} The published photo list.
 * @throws {Error} When the list cannot be downloaded.
 */
async function loadManifest() {
  const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${MANIFEST_URL} (HTTP ${response.status})`);
  const manifest = await response.json();
  return { generatedAt: manifest.generatedAt ?? null, photos: Array.isArray(manifest.photos) ? manifest.photos : [] };
}

/**
 * Load the travel route between the areas the photos were taken in.
 * @returns {Promise<{areas: object[], connections: object[], localPaths: string[][], distanceKm: ?number}>} The route,
 *   or an empty route when none has been built yet.
 */
async function loadRoute() {
  try {
    const response = await fetch(ROUTE_URL, { cache: 'no-cache' });
    if (!response.ok) return EMPTY_ROUTE;
    return { ...EMPTY_ROUTE, ...(await response.json()) };
  } catch (error) {
    console.error(error);
    return EMPTY_ROUTE;
  }
}

/**
 * Fill the report header with the trip's figures.
 * @param {ReturnType<typeof summarizeTrip>} summary Trip figures.
 * @param {?number} distanceKm Distance travelled, when known.
 * @param {?string} generatedAt When the photo list was last published.
 */
function renderSummary(summary, distanceKm, generatedAt) {
  const setText = (id, text) => {
    document.getElementById(id).textContent = text;
  };
  setText(
    'trip-dates',
    summary.firstDayKey ? formatDateRange(summary.firstDayKey, summary.lastDayKey) : 'No photos published yet',
  );
  setText('stat-photos', formatNumber(summary.photoCount));
  setText('stat-days', formatNumber(summary.dayCount));
  setText('stat-distance', Number.isFinite(distanceKm) ? formatDistance(distanceKm) : '–');
  setText('stat-located', `${formatNumber(summary.locatedCount)} of ${formatNumber(summary.photoCount)}`);
  setText('updated-at', generatedAt ? `Updated ${formatCalendarDate(generatedAt)}` : '');
}

/**
 * Load the photos and route, then connect the summary, map, album and photo viewer.
 */
async function start() {
  let manifest = { generatedAt: null, photos: [] };
  const routeLoading = loadRoute();
  try {
    manifest = await loadManifest();
  } catch (error) {
    console.error(error);
  }
  const route = await routeLoading;
  const { photos } = manifest;
  renderSummary(summarizeTrip(photos), route.distanceKm, manifest.generatedAt);

  let lightbox = null;
  let album = null;
  let selectedPhotoId = null;
  const lightboxElement = document.getElementById('lightbox');
  const mapView = createMapView(document.getElementById('map'), photos, route, {
    onOpenPhoto: (photoId) => lightbox.open(photoId),
    onSelectPhoto: (photoId) => {
      selectedPhotoId = photoId;
      album.highlight(photoId, { scroll: true });
    },
  });
  album = createAlbumView(document.getElementById('album'), groupPhotosByDay(photos), {
    onOpenPhoto: (photoId) => lightbox.open(photoId),
    onPreviewPhoto: (photoId) => mapView.highlight(photoId),
  });
  lightbox = createLightbox(lightboxElement, photos, {
    onShowPhoto: (photoId) => {
      selectedPhotoId = photoId;
      album.highlight(photoId);
      mapView.highlight(photoId);
    },
    onClose: (photoId) => {
      album.highlight(photoId, { scroll: true, focus: true });
      mapView.focusPhoto(photoId);
    },
  });
  enableArrowKeySelection({
    photoInDirection: album.photoInDirection,
    selectPhoto: (photoId) => {
      selectedPhotoId = photoId;
      album.highlight(photoId, { scroll: true, focus: true });
      mapView.showPhoto(photoId);
    },
    selectedPhotoId: () => selectedPhotoId,
    isPaused: () => lightboxElement.open,
  });
}

start();
