const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MAX_TILE_ZOOM = 19;

/**
 * Add the OpenStreetMap base layer to a map.
 * @param {L.Map} map Map that receives the tiles.
 */
export function addBaseTiles(map) {
  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: MAX_TILE_ZOOM }).addTo(map);
}
