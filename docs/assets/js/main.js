import { sectionsByDate, sectionsByPlace } from './album-sections.js';
import { createAlbumTabs } from './album-tabs.js';
import { createAlbumView } from './album-view.js';
import { formatCalendarDate, formatDateRange, formatNumber } from './formatting.js';
import { createLightbox } from './lightbox.js';
import { createMapView } from './map-view.js';
import { createPhotoContext } from './photo-context.js';
import { enableSelectionControls } from './selection-controls.js';
import { summarizeTrip } from './trip-summary.js';

const MANIFEST_URL = 'data/photos.json';
const ROUTE_URL = 'data/route.json';
const EMPTY_ROUTE = { areas: [], connections: [], localPaths: [] };

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
 * @returns {Promise<{areas: object[], connections: object[], localPaths: string[][]}>} The route,
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
 * @param {?string} generatedAt When the photo list was last published.
 */
function renderSummary(summary, generatedAt) {
  const setText = (id, text) => {
    document.getElementById(id).textContent = text;
  };
  setText(
    'trip-dates',
    summary.firstDayKey ? formatDateRange(summary.firstDayKey, summary.lastDayKey) : 'No photos published yet',
  );
  setText('stat-photos', formatNumber(summary.photoCount));
  setText('stat-days', formatNumber(summary.dayCount));
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
  renderSummary(summarizeTrip(photos), manifest.generatedAt);

  let lightbox = null;
  let album = null;
  let mapView = null;
  let selectedPhotoId = null;
  const albumElement = document.getElementById('album');
  const lightboxElement = document.getElementById('lightbox');
  const photoContext = createPhotoContext(
    {
      frameElement: lightboxElement.querySelector('[data-lightbox-map-frame]'),
      mapElement: lightboxElement.querySelector('[data-lightbox-map]'),
      areaElement: lightboxElement.querySelector('[data-lightbox-area]'),
    },
    photos,
    route,
  );

  const selectPhoto = (photoId, { moveMap = true } = {}) => {
    selectedPhotoId = photoId;
    album.highlight(photoId, { scroll: true, focus: true });
    if (moveMap) mapView.focusPhoto(photoId);
  };

  mapView = createMapView(document.getElementById('map'), photos, route, {
    onOpenPhoto: (photoId) => lightbox.open(photoId),
    onSelectPhoto: (photoId) => selectPhoto(photoId, { moveMap: false }),
  });
  album = createAlbumView(albumElement, {
    onOpenPhoto: (photoId) => lightbox.open(photoId),
  });
  const sectionsInOrder = {
    date: () => sectionsByDate(photos),
    place: () => sectionsByPlace(photos, route.areas),
  };
  createAlbumTabs(document.getElementById('album-tabs'), (order) => {
    album.render(sectionsInOrder[order]());
    album.highlight(selectedPhotoId, { scroll: true, instant: true });
  });
  lightbox = createLightbox(lightboxElement, photos, {
    onShowPhoto: (photoId) => {
      selectedPhotoId = photoId;
      album.highlight(photoId);
      mapView.highlight(photoId);
      photoContext.show(photoId);
    },
    onClose: (photoId) => selectPhoto(photoId),
  });
  enableSelectionControls({
    move: (direction) => {
      const targetPhotoId = album.photoInDirection(selectedPhotoId, direction);
      if (targetPhotoId) selectPhoto(targetPhotoId);
    },
    isViewerOpen: () => lightboxElement.open,
    stepViewer: (offset) => lightbox.step(offset),
    swipeArea: albumElement,
  });
}

start();
