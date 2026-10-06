import { sectionsByDate, sectionsByPlace } from './album-sections.js';
import { createAlbumSwitcher } from './album-switcher.js';
import { createAlbumTabs } from './album-tabs.js';
import { createAlbumView } from './album-view.js';
import { formatCalendarDate, formatDateRange, formatNumber } from './formatting.js';
import { createLightbox } from './lightbox.js';
import { createMapView } from './map-view.js';
import { createPhotoContext } from './photo-context.js';
import { enableSelectionControls } from './selection-controls.js';
import { summarizeTrip } from './trip-summary.js';

const ALBUM_INDEX_URL = 'data/albums.json';
const ALBUM_ADDRESS_PARAMETER = 'album';

/**
 * Load the list of albums on the site.
 * @returns {Promise<object[]>} Albums, most recent first, or none when the site has not been built yet.
 */
async function loadAlbumIndex() {
  try {
    const response = await fetch(ALBUM_INDEX_URL, { cache: 'no-cache' });
    if (!response.ok) return [];
    const { albums } = await response.json();
    return Array.isArray(albums) ? albums : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

/**
 * Pick the album named in the page address, or the most recent album.
 * @param {object[]} albums Albums, most recent first.
 * @returns {?object} The album to show.
 */
function chooseAlbum(albums) {
  const requestedSlug = new URLSearchParams(window.location.search).get(ALBUM_ADDRESS_PARAMETER);
  return albums.find((album) => album.slug === requestedSlug) ?? albums[0] ?? null;
}

/**
 * Load an album's published photos, with their image addresses made relative to this page.
 * @param {string} albumFolder Address of the album's folder, ending in a slash.
 * @returns {Promise<{generatedAt: ?string, photos: object[]}>} The album's photo list.
 * @throws {Error} When the list cannot be downloaded.
 */
async function loadManifest(albumFolder) {
  const manifestUrl = `${albumFolder}data/photos.json`;
  const response = await fetch(manifestUrl, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${manifestUrl} (HTTP ${response.status})`);
  const manifest = await response.json();
  const photos = Array.isArray(manifest.photos) ? manifest.photos : [];
  return {
    generatedAt: manifest.generatedAt ?? null,
    photos: photos.map((photo) => ({ ...photo, full: albumFolder + photo.full, thumb: albumFolder + photo.thumb })),
  };
}

/**
 * Load the areas an album's photos were taken in.
 * @param {string} albumFolder Address of the album's folder, ending in a slash.
 * @returns {Promise<object[]>} The areas, or none when they have not been built yet.
 */
async function loadAreas(albumFolder) {
  try {
    const response = await fetch(`${albumFolder}data/areas.json`, { cache: 'no-cache' });
    if (!response.ok) return [];
    const { areas } = await response.json();
    return Array.isArray(areas) ? areas : [];
  } catch (error) {
    console.error(error);
    return [];
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
 * Load the chosen album's photos and areas, then connect the summary, map, album and photo viewer.
 */
async function start() {
  const albums = await loadAlbumIndex();
  const currentAlbum = chooseAlbum(albums);
  createAlbumSwitcher(document.getElementById('album-switcher'), albums, currentAlbum);
  if (currentAlbum) document.title = currentAlbum.name;

  let manifest = { generatedAt: null, photos: [] };
  let areas = [];
  if (currentAlbum) {
    const albumFolder = `albums/${encodeURIComponent(currentAlbum.slug)}/`;
    const areasLoading = loadAreas(albumFolder);
    try {
      manifest = await loadManifest(albumFolder);
    } catch (error) {
      console.error(error);
    }
    areas = await areasLoading;
  }
  const { photos } = manifest;
  renderSummary(summarizeTrip(photos), manifest.generatedAt);

  let lightbox = null;
  let albumView = null;
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
    areas,
  );

  const selectPhoto = (photoId, { moveMap = true, moveAlbum = true } = {}) => {
    selectedPhotoId = photoId;
    albumView.highlight(photoId, { scroll: moveAlbum, focus: moveAlbum });
    if (moveMap) mapView.focusPhoto(photoId);
  };

  mapView = createMapView(document.getElementById('map'), photos, areas, {
    onOpenPhoto: (photoId) => lightbox.open(photoId),
    onSelectPhoto: (photoId) => selectPhoto(photoId, { moveMap: false }),
  });
  albumView = createAlbumView(albumElement, {
    onOpenPhoto: (photoId) => lightbox.open(photoId),
    onScrollToPhoto: (photoId) => {
      if (photoId !== selectedPhotoId) selectPhoto(photoId, { moveAlbum: false });
    },
  });
  const sectionsInOrder = {
    date: () => sectionsByDate(photos),
    place: () => sectionsByPlace(photos, areas),
  };
  createAlbumTabs(document.getElementById('album-tabs'), (order) => {
    albumView.render(sectionsInOrder[order]());
    albumView.highlight(selectedPhotoId, { scroll: true, instant: true });
  });
  lightbox = createLightbox(lightboxElement, photos, {
    onShowPhoto: (photoId) => {
      selectedPhotoId = photoId;
      albumView.highlight(photoId);
      mapView.highlight(photoId);
      photoContext.show(photoId);
    },
    onClose: (photoId) => selectPhoto(photoId),
  });
  enableSelectionControls({
    move: (direction) => {
      const targetPhotoId = albumView.photoInDirection(selectedPhotoId, direction);
      if (targetPhotoId) selectPhoto(targetPhotoId);
    },
    isViewerOpen: () => lightboxElement.open,
    stepViewer: (offset) => lightbox.step(offset),
  });
}

start();
