const DEFAULT_DOT_SIZE_PX = 16;
const ABOVE_OTHER_MARKERS = 1000;

/**
 * Mark the selected photo's spot on a map with a pulsing orange dot.
 * @param {L.Map} map Map to draw on.
 * @param {{sizePx: number}=} options Diameter of the dot in pixels.
 * @returns {{moveTo: function(?L.LatLng): void}} Moves the dot to a position, or hides it for null.
 */
export function createActiveDot(map, { sizePx = DEFAULT_DOT_SIZE_PX } = {}) {
  const dot = L.marker([0, 0], {
    icon: L.divIcon({ className: 'active-dot', iconSize: [sizePx, sizePx] }),
    interactive: false,
    keyboard: false,
    zIndexOffset: ABOVE_OTHER_MARKERS,
  });

  function moveTo(position) {
    if (!position) {
      dot.remove();
      return;
    }
    dot.setLatLng(position);
    if (!map.hasLayer(dot)) dot.addTo(map);
  }

  return { moveTo };
}
