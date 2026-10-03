const BOUNDARY_PANE = 'area-boundaries';
const BOUNDARY_PANE_Z_INDEX = '300';
const CONNECTION_PANE = 'area-connections';
const CONNECTION_PANE_Z_INDEX = '350';
const LABEL_PANE = 'area-labels';
const LABEL_PANE_Z_INDEX = '450';

/**
 * Draw the travel route: faint area outlines, one line between the outlines of each pair of connected areas, area
 * names and the paths between photos.
 * @param {L.Map} map Map to draw on.
 * @param {{areas: object[], connections: object[], localPaths: string[][]}} route Travel route from route.json.
 * @param {Map<string, object>} photosById Published photos keyed by id.
 */
export function drawTravelRoute(map, route, photosById) {
  drawAreaOutlines(map, route.areas);
  map.createPane(LABEL_PANE).style.zIndex = LABEL_PANE_Z_INDEX;
  for (const area of route.areas) {
    L.marker(areaLabelPoint(area), {
      pane: LABEL_PANE,
      icon: areaLabelIcon(area),
      interactive: false,
      keyboard: false,
    }).addTo(map);
  }
  drawRouteLines(map, route, photosById);
}

/**
 * Draw the faint outlines of the areas underneath everything else.
 * @param {L.Map} map Map to draw on.
 * @param {object[]} areas Areas from route.json.
 */
export function drawAreaOutlines(map, areas) {
  map.createPane(BOUNDARY_PANE).style.zIndex = BOUNDARY_PANE_Z_INDEX;
  for (const area of areas) {
    if (!area.boundary) continue;
    L.geoJSON(area.boundary, {
      pane: BOUNDARY_PANE,
      interactive: false,
      style: () => ({ className: 'area-boundary', fill: true, weight: 1 }),
    }).addTo(map);
  }
}

/**
 * Draw the lines between connected areas and the paths between photos.
 * @param {L.Map} map Map to draw on.
 * @param {{areas: object[], connections: object[], localPaths: string[][]}} route Travel route from route.json.
 * @param {Map<string, object>} photosById Published photos keyed by id.
 */
export function drawRouteLines(map, route, photosById) {
  map.createPane(CONNECTION_PANE).style.zIndex = CONNECTION_PANE_Z_INDEX;
  drawAreaConnections(map, route.connections);
  drawLocalPaths(map, route.localPaths, photosById);
}

/**
 * Get the point where an area's name is shown.
 * @param {object} area Area from route.json.
 * @returns {number[]} The point as [latitude, longitude].
 */
export function areaLabelPoint(area) {
  return [area.labelLatitude, area.labelLongitude];
}

function drawAreaConnections(map, connections) {
  for (const connection of connections) {
    L.polyline([connection.fromPoint, connection.toPoint], {
      pane: CONNECTION_PANE,
      className: 'area-connection',
      interactive: false,
    }).addTo(map);
  }
}

function drawLocalPaths(map, localPaths, photosById) {
  for (const path of localPaths) {
    const points = path
      .map((photoId) => photosById.get(photoId))
      .filter(Boolean)
      .map(toLatLng);
    if (points.length > 1) L.polyline(points, { className: 'photo-route', interactive: false }).addTo(map);
  }
}

function toLatLng(photo) {
  return [photo.latitude, photo.longitude];
}

function areaLabelIcon(area) {
  const label = document.createElement('div');
  label.className = 'area-label';
  const name = document.createElement('strong');
  name.textContent = area.name;
  label.append(name);
  if (area.nameJa) {
    const japaneseName = document.createElement('span');
    japaneseName.lang = 'ja';
    japaneseName.textContent = area.nameJa;
    label.append(japaneseName);
  }
  return L.divIcon({ className: 'area-label-anchor', html: label, iconSize: [0, 0] });
}
