import { createActiveDot } from './active-dot.js';
import { addBaseTiles } from './map-tiles.js';
import { drawAreaOutlines } from './area-layers.js';
import { createLastLeg } from './last-leg.js';
import { hasLocation } from './trip-summary.js';

const CONTEXT_ZOOM = 13;
const PHOTO_DOT_RADIUS = 4;
const CURRENT_PHOTO_RADIUS = 7;
const ACTIVE_DOT_SIZE_PX = 12;

/**
 * Show where the photo in the viewer was taken on a small map with the line leading to it, and name its area.
 * @param {{frameElement: HTMLElement, mapElement: HTMLElement, areaElement: HTMLElement}} elements The map's frame,
 *   the map container inside it and the line that names the area.
 * @param {object[]} photos Published photos in chronological order.
 * @param {object[]} areas Areas from areas.json with the ids of their photos.
 * @returns {{show: function(string): void}} Context controls.
 */
export function createPhotoContext({ frameElement, mapElement, areaElement }, photos, areas) {
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  const areaOfPhoto = new Map(areas.flatMap((area) => (area.photoIds ?? []).map((photoId) => [photoId, area])));
  const dots = new Map();
  let map = null;
  let lastLeg = null;
  let activeDot = null;
  let currentDot = null;

  function createMap() {
    map = L.map(mapElement, { zoomControl: false, keyboard: false, zoomSnap: 0.5 });
    map.attributionControl.setPrefix(false);
    addBaseTiles(map);
    drawAreaOutlines(map, areas);
    lastLeg = createLastLeg(map, photos, areas);
    activeDot = createActiveDot(map, { sizePx: ACTIVE_DOT_SIZE_PX });
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
    lastLeg.show(photoId);
    if (currentDot) {
      currentDot.setRadius(PHOTO_DOT_RADIUS);
      currentDot.getElement()?.classList.remove('is-active');
    }
    currentDot = dots.get(photoId) ?? null;
    activeDot.moveTo(currentDot?.getLatLng() ?? null);
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
