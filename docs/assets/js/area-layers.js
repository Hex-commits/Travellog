const BOUNDARY_PANE = 'area-boundaries';
const BOUNDARY_PANE_Z_INDEX = '300';
const LABEL_PANE = 'area-labels';
const LABEL_PANE_Z_INDEX = '450';

/**
 * Draw the faint outline and the name of every area.
 * @param {L.Map} map Map to draw on.
 * @param {object[]} areas Areas from areas.json.
 */
export function drawAreas(map, areas) {
  drawAreaOutlines(map, areas);
  map.createPane(LABEL_PANE).style.zIndex = LABEL_PANE_Z_INDEX;
  for (const area of areas) {
    L.marker(areaLabelPoint(area), {
      pane: LABEL_PANE,
      icon: areaLabelIcon(area),
      interactive: false,
      keyboard: false,
    }).addTo(map);
  }
}

/**
 * Draw the faint outlines of the areas underneath everything else.
 * @param {L.Map} map Map to draw on.
 * @param {object[]} areas Areas from areas.json.
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
 * Get the point where an area's name is shown.
 * @param {object} area Area from areas.json.
 * @returns {number[]} The point as [latitude, longitude].
 */
export function areaLabelPoint(area) {
  return [area.labelLatitude, area.labelLongitude];
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
