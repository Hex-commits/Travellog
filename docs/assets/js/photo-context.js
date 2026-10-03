import { addBaseTiles } from './map-tiles.js';
import { drawAreaOutlines, drawRouteLines } from './route-layers.js';
import { hasLocation } from './trip-summary.js';

const CONTEXT_ZOOM = 13;
const PHOTO_DOT_RADIUS = 4;
const CURRENT_PHOTO_RADIUS = 7;

/**
 * Show where the photo in the viewer was taken on a small map with the travel route, and name its area.
 * @param {{frameElement: HTMLElement, mapElement: HTMLElement, areaElement: HTMLElement}} elements The map's frame,
 *   the map container inside it and the line that names the area.
 * @param {object[]} photos Published photos in chronological order.
 * @param {{areas: object[], connections: object[], localPaths: string[][]}} route Travel route from route.json.
 * @returns {{show: function(string): void}} Context controls.
 */
export function createPhotoContext({ frameElement, mapElement, areaElement }, photos, route) {
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  const areaOfPhoto = new Map(route.areas.flatMap((area) => (area.photoIds ?? []).map((photoId) => [photoId, area])));
  const dots = new Map();
  let map = null;
  let currentDot = null;

  function createMap() {
    map = L.map(mapElement, { zoomControl: false, keyboard: false, zoomSnap: 0.5 });
    map.attributionControl.setPrefix(false);
    addBaseTiles(map);
    drawAreaOutlines(map, route.areas);
    drawRouteLines(map, route, photosById);
    for (const photo of photos.filter(hasLocation)) {
      const dot = L.circleMarker([photo.latitude, photo.longitude], {
        radius: PHOTO_DOT_RADIUS,
        className: 'photo-marker',
        fillOpacity: 1,
        weight: 1.5,
        interactive: false,
      });
      dots.set(photo.id, dot.addTo(map));
    }
  }

  function markCurrent(photoId) {
    if (currentDot) {
      currentDot.setRadius(PHOTO_DOT_RADIUS);
      currentDot.getElement()?.classList.remove('is-active');
    }
    currentDot = dots.get(photoId) ?? null;
    if (!currentDot) return;
    currentDot.setRadius(CURRENT_PHOTO_RADIUS).bringToFront();
    currentDot.getElement()?.classList.add('is-active');
  }

  function show(photoId) {
    const photo = photosById.get(photoId);
    areaElement.replaceChildren(...areaNameNodes(areaOfPhoto.get(photoId)));
    const located = Boolean(photo && hasLocation(photo));
    frameElement.classList.toggle('is-unlocated', !located);
    if (!located) return;
    const isFirstView = map === null;
    if (isFirstView) createMap();
    map.invalidateSize();
    map.setView([photo.latitude, photo.longitude], isFirstView ? CONTEXT_ZOOM : map.getZoom(), {
      animate: !isFirstView,
    });
    markCurrent(photoId);
  }

  return { show };
}

function areaNameNodes(area) {
  if (!area) return [];
  const name = document.createElement('span');
  name.textContent = area.name;
  if (!area.nameJa) return [name];
  const japaneseName = document.createElement('span');
  japaneseName.lang = 'ja';
  japaneseName.textContent = area.nameJa;
  return [name, japaneseName];
}
