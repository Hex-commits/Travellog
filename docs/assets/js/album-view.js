import { formatCount, formatDateTime, formatDayHeading, formatTime } from './formatting.js';
import { hasLocation } from './trip-summary.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Show the photos as an album grouped by day.
 * @param {HTMLElement} container Element that receives the album.
 * @param {{dayKey: ?string, dayNumber: ?number, photos: object[]}[]} dayGroups Photos grouped by day.
 * @param {{onOpenPhoto: function(string): void, onPreviewPhoto: function(?string): void}} callbacks Reactions to the album.
 * @returns {{highlight: function(?string, {scroll: boolean, focus: boolean}=): void,
 *   photoInDirection: function(?string, string): ?string}} Album controls.
 */
export function createAlbumView(container, dayGroups, { onOpenPhoto, onPreviewPhoto }) {
  container.replaceChildren(...(dayGroups.length ? dayGroups.map(renderDay) : [renderEmptyState()]));
  const thumbnails = new Map(
    [...container.querySelectorAll('[data-photo-id]')].map((element) => [element.dataset.photoId, element]),
  );
  const thumbnailFromEvent = (event) => event.target.closest('[data-photo-id]');

  container.addEventListener('click', (event) => {
    const thumbnail = thumbnailFromEvent(event);
    if (thumbnail) onOpenPhoto(thumbnail.dataset.photoId);
  });
  for (const eventName of ['pointerover', 'focusin']) {
    container.addEventListener(eventName, (event) => {
      const thumbnail = thumbnailFromEvent(event);
      if (thumbnail) onPreviewPhoto(thumbnail.dataset.photoId);
    });
  }
  container.addEventListener('pointerleave', () => onPreviewPhoto(null));

  let activeThumbnail = null;

  function highlight(photoId, { scroll = false, focus = false } = {}) {
    activeThumbnail?.classList.remove('is-active');
    activeThumbnail = thumbnails.get(photoId) ?? null;
    if (!activeThumbnail) return;
    activeThumbnail.classList.add('is-active');
    if (focus) activeThumbnail.focus({ preventScroll: true });
    if (scroll) {
      activeThumbnail.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
  }

  function photoInDirection(photoId, direction) {
    const orderedIds = [...thumbnails.keys()];
    if (!thumbnails.has(photoId)) return orderedIds[0] ?? null;
    if (direction === 'next' || direction === 'previous') {
      return orderedIds[orderedIds.indexOf(photoId) + (direction === 'next' ? 1 : -1)] ?? null;
    }
    return photoInNeighbouringRow(thumbnails, photoId, direction === 'down');
  }

  return { highlight, photoInDirection };
}

function photoInNeighbouringRow(thumbnails, photoId, downwards) {
  const current = thumbnails.get(photoId).getBoundingClientRect();
  const currentCenter = current.left + current.width / 2;
  const candidates = [...thumbnails]
    .map(([candidateId, element]) => ({ candidateId, box: element.getBoundingClientRect() }))
    .filter(({ box }) => (downwards ? box.top >= current.bottom - 1 : box.bottom <= current.top + 1));
  if (candidates.length === 0) return null;
  const rowTops = candidates.map(({ box }) => box.top);
  const rowTop = downwards ? Math.min(...rowTops) : Math.max(...rowTops);
  const row = candidates.filter(({ box }) => Math.abs(box.top - rowTop) < 1);
  const horizontalOffset = ({ box }) => Math.abs(box.left + box.width / 2 - currentCenter);
  return row.reduce((closest, candidate) => (horizontalOffset(candidate) < horizontalOffset(closest) ? candidate : closest))
    .candidateId;
}

function renderDay(group) {
  const section = document.createElement('section');
  section.className = 'day';
  const headingId = `day-${group.dayKey ?? 'undated'}`;
  section.setAttribute('aria-labelledby', headingId);

  const header = document.createElement('header');
  header.className = 'day-header';
  const dayNumber = document.createElement('p');
  dayNumber.className = 'day-number';
  dayNumber.textContent = group.dayNumber ? `Day ${group.dayNumber}` : 'Undated';
  const title = document.createElement('h2');
  title.className = 'day-title';
  title.id = headingId;
  title.textContent = group.dayKey ? formatDayHeading(group.dayKey) : 'Date unknown';
  const count = document.createElement('p');
  count.className = 'day-count';
  count.textContent = formatCount(group.photos.length, 'photo', 'photos');
  header.append(dayNumber, title, count);

  const grid = document.createElement('ul');
  grid.className = 'thumb-grid';
  grid.setAttribute('role', 'list');
  grid.append(...group.photos.map(renderThumbnail));

  section.append(header, grid);
  return section;
}

function renderThumbnail(photo) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'thumb';
  button.dataset.photoId = photo.id;
  button.setAttribute('aria-label', `Open photo from ${formatDateTime(photo.takenAt)}`);

  const image = document.createElement('img');
  image.src = photo.thumb;
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.width = photo.width;
  image.height = photo.height;

  const caption = document.createElement('span');
  caption.className = 'thumb-caption';
  const time = formatTime(photo.takenAt);
  caption.textContent = hasLocation(photo) ? time : [time, 'no location'].filter(Boolean).join(' · ');

  button.append(image, caption);
  item.append(button);
  return item;
}

function renderEmptyState() {
  const emptyState = document.createElement('div');
  emptyState.className = 'album-empty';
  const title = document.createElement('p');
  title.className = 'album-empty-title';
  title.textContent = 'No photos published yet';
  const explanation = document.createElement('p');
  explanation.textContent = 'Photos appear here once the site has been built from the Takeout export.';
  emptyState.append(title, explanation);
  return emptyState;
}
