import { hasLocation } from './trip-summary.js';

const LEG_PANE = 'last-leg';
const LEG_PANE_Z_INDEX = '390';

/**
 * Draw one line from the photo taken just before the shown photo to the shown photo: solid when both lie in the same
 * area, dotted when the photo before lies in another area.
 * @param {L.Map} map Map to draw on.
 * @param {object[]} photos Published photos in chronological order.
 * @param {object[]} areas Areas from areas.json with the ids of their photos.
 * @returns {{show: function(?string): void}} Shows the line leading to a photo, or hides it for null.
 */
export function createLastLeg(map, photos, areas) {
  const locatedPhotos = photos.filter(hasLocation);
  const photoById = new Map(locatedPhotos.map((photo) => [photo.id, photo]));
  const photoBefore = new Map(locatedPhotos.slice(1).map((photo, index) => [photo.id, locatedPhotos[index]]));
  const areaIdOfPhoto = new Map(areas.flatMap((area) => (area.photoIds ?? []).map((photoId) => [photoId, area.id])));
  map.createPane(LEG_PANE).style.zIndex = LEG_PANE_Z_INDEX;
  const leg = L.polyline([], { pane: LEG_PANE, className: 'last-leg', interactive: false });

  function show(photoId) {
    const photo = photoById.get(photoId);
    const previousPhoto = photoBefore.get(photoId);
    if (!photo || !previousPhoto) {
      leg.remove();
      return;
    }
    leg.setLatLngs([
      [previousPhoto.latitude, previousPhoto.longitude],
      [photo.latitude, photo.longitude],
    ]);
    if (!map.hasLayer(leg)) leg.addTo(map);
    const previousAreaId = areaIdOfPhoto.get(previousPhoto.id);
    const staysInArea = previousAreaId !== undefined && previousAreaId === areaIdOfPhoto.get(photoId);
    leg.getElement()?.classList.toggle('is-travel', !staysInArea);
  }

  return { show };
}
