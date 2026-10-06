import { formatCount, formatDateTime } from './formatting.js';

const SCROLL_REST_MS = 150;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Show the photos as an album of sections, such as days or places.
 * @param {HTMLElement} container Element that receives the album and scrolls it to the selected photo.
 * @param {{onOpenPhoto: function(string): void, onScrollToPhoto: function(string): void}} callbacks Reactions to a
 *   click on a photo and to the photo a finger scroll stops at.
 * @returns {{render: function(object[]): void, highlight: function(?string, {scroll: boolean, focus: boolean,
 *   instant: boolean}=): void, photoInDirection: function(?string, string): ?string}} Album controls.
 */
export function createAlbumView(container, { onOpenPhoto, onScrollToPhoto }) {
  let thumbnails = new Map();
  let activeThumbnail = null;

  container.addEventListener('click', (event) => {
    const thumbnail = event.target.closest('[data-photo-id]');
    if (thumbnail) onOpenPhoto(thumbnail.dataset.photoId);
  });
  whenFingerScrollingRests(container, () => {
    const photoId = photoNearestToMiddle(container, thumbnails);
    if (photoId) onScrollToPhoto(photoId);
  });

  function render(sections) {
    container.replaceChildren(...(sections.length ? sections.map(renderSection) : [renderEmptyState()]));
    thumbnails = new Map(
      [...container.querySelectorAll('[data-photo-id]')].map((element) => [element.dataset.photoId, element]),
    );
    activeThumbnail = null;
    container.scrollTop = 0;
  }

  function highlight(photoId, { scroll = false, focus = false, instant = false } = {}) {
    activeThumbnail?.classList.remove('is-active');
    activeThumbnail = thumbnails.get(photoId) ?? null;
    if (!activeThumbnail) return;
    activeThumbnail.classList.add('is-active');
    if (focus) activeThumbnail.focus({ preventScroll: true });
    if (scroll) centerInView(container, activeThumbnail, instant);
  }

  function photoInDirection(photoId, direction) {
    const orderedIds = [...thumbnails.keys()];
    if (!thumbnails.has(photoId)) return orderedIds[0] ?? null;
    if (direction === 'next' || direction === 'previous') {
      return orderedIds[orderedIds.indexOf(photoId) + (direction === 'next' ? 1 : -1)] ?? null;
    }
    return photoInNeighbouringRow(thumbnails, photoId, direction === 'down');
  }

  return { render, highlight, photoInDirection };
}

function centerInView(container, element, instant) {
  const containerBox = container.getBoundingClientRect();
  const elementBox = element.getBoundingClientRect();
  const offset = elementBox.top - containerBox.top - (containerBox.height - elementBox.height) / 2;
  container.scrollBy({ top: offset, behavior: instant || reducedMotion.matches ? 'auto' : 'smooth' });
}

function whenFingerScrollingRests(container, onRest) {
  let fingersOnScreen = 0;
  let touchedSinceRest = false;
  let scrolledSinceTouch = false;
  let restTimer = 0;
  const awaitRest = () => {
    clearTimeout(restTimer);
    restTimer = setTimeout(() => {
      if (fingersOnScreen > 0) return;
      const scrolledByFinger = scrolledSinceTouch;
      touchedSinceRest = false;
      scrolledSinceTouch = false;
      if (scrolledByFinger) onRest();
    }, SCROLL_REST_MS);
  };
  const liftFinger = (event) => {
    fingersOnScreen = event.touches.length;
    if (fingersOnScreen === 0) awaitRest();
  };
  container.addEventListener(
    'touchstart',
    (event) => {
      fingersOnScreen = event.touches.length;
      touchedSinceRest = true;
    },
    { passive: true },
  );
  container.addEventListener('touchend', liftFinger, { passive: true });
  container.addEventListener('touchcancel', liftFinger, { passive: true });
  container.addEventListener(
    'scroll',
    () => {
      if (!touchedSinceRest) return;
      scrolledSinceTouch = true;
      awaitRest();
    },
    { passive: true },
  );
}

function photoNearestToMiddle(container, thumbnails) {
  const containerBox = container.getBoundingClientRect();
  const middleX = containerBox.left + containerBox.width / 2;
  const middleY = containerBox.top + containerBox.height / 2;
  const candidates = [...thumbnails].map(([candidateId, element]) => {
    const box = element.getBoundingClientRect();
    return { candidateId, distance: Math.hypot(box.left + box.width / 2 - middleX, box.top + box.height / 2 - middleY) };
  });
  if (candidates.length === 0) return null;
  return candidates.reduce((nearest, candidate) => (candidate.distance < nearest.distance ? candidate : nearest))
    .candidateId;
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

function renderSection(section, index) {
  const element = document.createElement('section');
  element.className = 'album-section';
  const headingId = `album-section-${index}`;
  element.setAttribute('aria-labelledby', headingId);

  const header = document.createElement('header');
  header.className = 'section-header';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'section-eyebrow';
  eyebrow.textContent = section.eyebrow;
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.id = headingId;
  title.textContent = section.title;
  if (section.titleJa) {
    const japaneseTitle = document.createElement('span');
    japaneseTitle.lang = 'ja';
    japaneseTitle.textContent = section.titleJa;
    title.append(' ', japaneseTitle);
  }
  const count = document.createElement('p');
  count.className = 'section-count';
  count.textContent = formatCount(section.photos.length, 'photo', 'photos');
  header.append(eyebrow, title, count);

  const grid = document.createElement('ul');
  grid.className = 'thumb-grid';
  grid.setAttribute('role', 'list');
  grid.append(...section.photos.map((photo) => renderThumbnail(photo, section.caption(photo))));

  element.append(header, grid);
  return element;
}

function renderThumbnail(photo, captionText) {
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
  caption.textContent = captionText;

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
