import { formatCoordinates, formatDateTime } from './formatting.js';
import { hasLocation } from './trip-summary.js';

const SWIPE_THRESHOLD_PX = 50;

/**
 * Show photos one at a time in a full-screen viewer.
 * @param {HTMLDialogElement} dialog Viewer element with image, caption and step buttons.
 * @param {object[]} photos Published photos in viewing order.
 * @param {{onShowPhoto: function(string): void, onClose: function(string): void}} callbacks Reactions to the viewer.
 * @returns {{open: function(string): void, step: function(number): void}} Viewer controls.
 */
export function createLightbox(dialog, photos, { onShowPhoto, onClose }) {
  const figure = dialog.querySelector('[data-lightbox-figure]');
  const image = dialog.querySelector('[data-lightbox-image]');
  const dateLabel = dialog.querySelector('[data-lightbox-date]');
  const coordinatesLabel = dialog.querySelector('[data-lightbox-coordinates]');
  const counterLabel = dialog.querySelector('[data-lightbox-counter]');
  const previousButton = dialog.querySelector('[data-lightbox-step="-1"]');
  const nextButton = dialog.querySelector('[data-lightbox-step="1"]');
  let currentIndex = -1;
  let swipeStartX = null;

  function show(index) {
    currentIndex = index;
    const photo = photos[index];
    image.src = photo.full;
    image.width = photo.width;
    image.height = photo.height;
    image.alt = `Photo taken ${formatDateTime(photo.takenAt)}`;
    dateLabel.textContent = formatDateTime(photo.takenAt);
    coordinatesLabel.textContent = hasLocation(photo)
      ? formatCoordinates(photo.latitude, photo.longitude)
      : 'No location recorded';
    counterLabel.textContent = `${index + 1} / ${photos.length}`;
    previousButton.disabled = index === 0;
    nextButton.disabled = index === photos.length - 1;
    preload(photos[index + 1]);
    preload(photos[index - 1]);
    onShowPhoto(photo.id);
  }

  function step(offset) {
    const targetIndex = currentIndex + offset;
    if (targetIndex >= 0 && targetIndex < photos.length) show(targetIndex);
  }

  function open(photoId) {
    const index = photos.findIndex((photo) => photo.id === photoId);
    if (index < 0) return;
    if (!dialog.open) dialog.showModal();
    show(index);
  }

  dialog.addEventListener('click', (event) => {
    const stepButton = event.target.closest('[data-lightbox-step]');
    if (stepButton) {
      step(Number(stepButton.dataset.lightboxStep));
    } else if (event.target.closest('[data-lightbox-close]') || event.target === dialog || event.target === figure) {
      dialog.close();
    }
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
  });
  image.addEventListener('pointerdown', (event) => {
    swipeStartX = event.clientX;
  });
  image.addEventListener('pointerup', (event) => {
    if (swipeStartX === null) return;
    const distance = event.clientX - swipeStartX;
    swipeStartX = null;
    if (Math.abs(distance) >= SWIPE_THRESHOLD_PX) step(distance < 0 ? 1 : -1);
  });
  dialog.addEventListener('close', () => {
    if (currentIndex >= 0) onClose(photos[currentIndex].id);
  });

  return { open, step };
}

function preload(photo) {
  if (photo) new Image().src = photo.full;
}
