const SHORTEST_SEGMENT_WITH_ARROW_PX = 44;
const ARROW_SPACING_PX = 160;
const ARROW_SIZE_PX = 14;
const ARROW_HIT_AREA_PX = 26;
const ARROW_POSITION = 0.35;

/**
 * Draw clickable arrows along directed segments that point in the direction of travel and adapt to the zoom level.
 * @param {L.Map} map Map to draw on.
 * @param {{start: number[], end: number[], photoIds: string[], title: string}[]} directedSegments Segments from start
 *   to end as [latitude, longitude], with the photos an arrow leads to and its tooltip.
 * @param {function(string[]): void} onNavigate Called with a segment's photo ids when one of its arrows is clicked.
 */
export function addDirectionArrows(map, directedSegments, onNavigate) {
  if (directedSegments.length === 0) return;
  const arrowLayer = L.layerGroup().addTo(map);
  const redraw = () => {
    arrowLayer.clearLayers();
    for (const segment of directedSegments) {
      for (const arrow of arrowsAlong(map, segment)) {
        arrow.on('click', () => onNavigate(segment.photoIds));
        arrowLayer.addLayer(arrow);
      }
    }
  };
  map.whenReady(redraw);
  map.on('zoomend', redraw);
}

function arrowsAlong(map, segment) {
  const startPoint = map.latLngToLayerPoint(segment.start);
  const endPoint = map.latLngToLayerPoint(segment.end);
  const length = startPoint.distanceTo(endPoint);
  if (length < SHORTEST_SEGMENT_WITH_ARROW_PX) return [];
  const travel = endPoint.subtract(startPoint);
  const angleDegrees = (Math.atan2(travel.y, travel.x) * 180) / Math.PI;
  const arrowCount = Math.max(1, Math.floor(length / ARROW_SPACING_PX));
  return Array.from({ length: arrowCount }, (_, index) => {
    const fraction = (index + ARROW_POSITION) / arrowCount;
    const position = map.layerPointToLatLng(startPoint.add(travel.multiplyBy(fraction)));
    return L.marker(position, { icon: arrowIcon(angleDegrees), title: segment.title, alt: segment.title });
  });
}

function arrowIcon(angleDegrees) {
  return L.divIcon({
    className: 'route-arrow',
    html:
      `<svg viewBox="0 0 14 14" width="${ARROW_SIZE_PX}" height="${ARROW_SIZE_PX}" ` +
      `style="transform: rotate(${angleDegrees.toFixed(1)}deg)" aria-hidden="true">` +
      '<path d="M4.5 2.5 9.5 7l-5 4.5"/></svg>',
    iconSize: [ARROW_HIT_AREA_PX, ARROW_HIT_AREA_PX],
  });
}
