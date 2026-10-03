import { formatCoordinates, formatDateTime } from './formatting.js';
import { addBaseTiles } from './map-tiles.js';
import { areaLabelPoint, drawTravelRoute } from './route-layers.js';
import { hasLocation } from './trip-summary.js';

const JAPAN_CENTER = [36.2, 138.25];
const JAPAN_ZOOM = 5;
const SINGLE_PHOTO_ZOOM = 12;
const FOCUS_ZOOM = 13;
const PAN_SECONDS = 0.35;
const FLY_SECONDS = 0.8;
const MARKER_RADIUS = 6;
const ACTIVE_MARKER_RADIUS = 10;
const POPUP_WIDTH = 240;
const FIT_PADDING_TOP_LEFT = [48, 48];
const FIT_PADDING_BOTTOM_RIGHT_FOR_LABELS = [170, 48];

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Show the photos as markers on a map together with the travel route between the areas they were taken in.
 * @param {HTMLElement} container Element that receives the map.
 * @param {object[]} photos Published photos in chronological order.
 * @param {{areas: object[], connections: object[], localPaths: string[][]}} route Travel route from route.json.
 * @param {{onOpenPhoto: function(string): void, onSelectPhoto: function(string): void}} callbacks Reactions to the map.
 * @returns {{highlight: function(?string): void, focusPhoto: function(string): void}} Map controls: mark a photo, or
 *   move the map to a photo, mark it and open its preview.
 */
export function createMapView(container, photos, route, { onOpenPhoto, onSelectPhoto }) {
  const map = L.map(container, { zoomSnap: 0.5 });
  addBaseTiles(map);
  const locatedPhotos = photos.filter(hasLocation);
  let activeMarker = null;

  showEverything(map, [...locatedPhotos.map(toLatLng), ...route.areas.map(areaLabelPoint)]);
  drawTravelRoute(map, route, new Map(photos.map((photo) => [photo.id, photo])));
  const markers = new Map(locatedPhotos.map((photo) => [photo.id, createMarker(photo, onOpenPhoto).addTo(map)]));

  for (const [photoId, marker] of markers) {
    marker.on('popupopen', () => {
      highlight(photoId);
      onSelectPhoto(photoId);
    });
  }

  function highlight(photoId) {
    if (activeMarker) {
      activeMarker.setRadius(MARKER_RADIUS);
      activeMarker.getElement()?.classList.remove('is-active');
    }
    activeMarker = markers.get(photoId) ?? null;
    if (!activeMarker) return;
    activeMarker.setRadius(ACTIVE_MARKER_RADIUS).bringToFront();
    activeMarker.getElement()?.classList.add('is-active');
  }

  let photoAwaitingPopup = null;
  map.on('moveend', () => {
    if (!photoAwaitingPopup) return;
    markers.get(photoAwaitingPopup)?.openPopup();
    photoAwaitingPopup = null;
  });

  function focusPhoto(photoId) {
    const marker = markers.get(photoId);
    map.closePopup();
    if (!marker) {
      highlight(null);
      return;
    }
    highlight(photoId);
    photoAwaitingPopup = photoId;
    const target = marker.getLatLng();
    if (reducedMotion.matches) {
      map.setView(target, Math.max(map.getZoom(), FOCUS_ZOOM), { animate: false });
    } else if (map.getZoom() >= FOCUS_ZOOM) {
      map.panTo(target, { duration: PAN_SECONDS });
    } else {
      map.flyTo(target, FOCUS_ZOOM, { duration: FLY_SECONDS });
    }
  }

  return { highlight, focusPhoto };
}

function showEverything(map, points) {
  if (points.length === 0) {
    map.setView(JAPAN_CENTER, JAPAN_ZOOM);
  } else if (points.length === 1) {
    map.setView(points[0], SINGLE_PHOTO_ZOOM);
  } else {
    map.fitBounds(points, {
      paddingTopLeft: FIT_PADDING_TOP_LEFT,
      paddingBottomRight: FIT_PADDING_BOTTOM_RIGHT_FOR_LABELS,
      maxZoom: FOCUS_ZOOM,
    });
  }
}

function createMarker(photo, onOpenPhoto) {
  const marker = L.circleMarker(toLatLng(photo), {
    radius: MARKER_RADIUS,
    className: 'photo-marker',
    fillOpacity: 1,
    weight: 2,
  });
  marker.bindPopup(() => buildPopup(photo, onOpenPhoto), {
    className: 'photo-popup',
    closeButton: false,
    minWidth: POPUP_WIDTH,
    maxWidth: POPUP_WIDTH,
    autoPanPadding: [24, 24],
  });
  return marker;
}

function buildPopup(photo, onOpenPhoto) {
  const card = document.createElement('div');
  card.className = 'popup-card';

  const imageButton = document.createElement('button');
  imageButton.type = 'button';
  imageButton.className = 'popup-image';
  imageButton.setAttribute('aria-label', `Open photo from ${formatDateTime(photo.takenAt)}`);
  imageButton.addEventListener('click', () => onOpenPhoto(photo.id));

  const image = document.createElement('img');
  image.src = photo.thumb;
  image.alt = '';
  imageButton.append(image);

  const details = document.createElement('div');
  details.className = 'popup-details';
  const dateLine = document.createElement('p');
  dateLine.className = 'popup-date';
  dateLine.textContent = formatDateTime(photo.takenAt);
  const coordinatesLine = document.createElement('p');
  coordinatesLine.className = 'popup-coordinates';
  coordinatesLine.textContent = formatCoordinates(photo.latitude, photo.longitude);
  details.append(dateLine, coordinatesLine);

  card.append(imageButton, details);
  return card;
}

function toLatLng(place) {
  return [place.latitude, place.longitude];
}
