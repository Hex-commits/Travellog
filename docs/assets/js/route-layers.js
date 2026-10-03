import { addDirectionArrows } from './route-direction.js';

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
 * @param {function(string[]): void} onNavigate Called with the photos an arrow leads to when it is clicked.
 */
export function drawTravelRoute(map, route, photosById, onNavigate) {
  map.createPane(BOUNDARY_PANE).style.zIndex = BOUNDARY_PANE_Z_INDEX;
  map.createPane(CONNECTION_PANE).style.zIndex = CONNECTION_PANE_Z_INDEX;
  map.createPane(LABEL_PANE).style.zIndex = LABEL_PANE_Z_INDEX;
  for (const area of route.areas) {
    if (area.boundary) {
      L.geoJSON(area.boundary, {
        pane: BOUNDARY_PANE,
        interactive: false,
        style: () => ({ className: 'area-boundary', fill: true, weight: 1 }),
      }).addTo(map);
    }
    L.marker(areaLabelPoint(area), {
      pane: LABEL_PANE,
      icon: areaLabelIcon(area),
      interactive: false,
      keyboard: false,
    }).addTo(map);
  }
  const areaNames = new Map(route.areas.map((area) => [area.id, area.name]));
  addDirectionArrows(
    map,
    [...drawAreaConnections(map, route.connections, areaNames), ...drawLocalPaths(map, route.localPaths, photosById)],
    onNavigate,
  );
}

/**
 * Get the point where an area's name is shown.
 * @param {object} area Area from route.json.
 * @returns {number[]} The point as [latitude, longitude].
 */
export function areaLabelPoint(area) {
  return [area.labelLatitude, area.labelLongitude];
}

function drawAreaConnections(map, connections, areaNames) {
  const directedSegments = [];
  for (const connection of connections) {
    const { fromPoint, toPoint } = connection;
    L.polyline([fromPoint, toPoint], { pane: CONNECTION_PANE, className: 'area-connection', interactive: false }).addTo(
      map,
    );
    const forwardArrivals = connection.forwardArrivals ?? [];
    const backwardArrivals = connection.backwardArrivals ?? [];
    if (forwardArrivals.length) {
      const title = `Go to ${areaNames.get(connection.to) ?? 'the next area'}`;
      directedSegments.push({ start: fromPoint, end: toPoint, photoIds: forwardArrivals, title });
    }
    if (backwardArrivals.length) {
      const title = `Go to ${areaNames.get(connection.from) ?? 'the next area'}`;
      directedSegments.push({ start: toPoint, end: fromPoint, photoIds: backwardArrivals, title });
    }
  }
  return directedSegments;
}

function drawLocalPaths(map, localPaths, photosById) {
  const directedSegments = [];
  for (const path of localPaths) {
    const pathPhotos = path.map((photoId) => photosById.get(photoId)).filter(Boolean);
    if (pathPhotos.length < 2) continue;
    L.polyline(pathPhotos.map(toLatLng), { className: 'photo-route', interactive: false }).addTo(map);
    for (let index = 1; index < pathPhotos.length; index += 1) {
      directedSegments.push({
        start: toLatLng(pathPhotos[index - 1]),
        end: toLatLng(pathPhotos[index]),
        photoIds: [pathPhotos[index].id],
        title: 'Go to the next photo',
      });
    }
  }
  return directedSegments;
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
