const DIRECTION_BY_KEY = {
  ArrowDown: 'down',
  ArrowUp: 'up',
  ArrowRight: 'next',
  ArrowLeft: 'previous',
};

/**
 * Let the arrow keys move the photo selection instead of scrolling the page.
 * @param {{photoInDirection: function(?string, string): ?string, selectPhoto: function(string): void,
 *   selectedPhotoId: function(): ?string, isPaused: function(): boolean}} selection Finds the photo in a direction,
 *   selects a photo, reports the selected photo, and tells when another view handles the keys itself.
 */
export function enableArrowKeySelection({ photoInDirection, selectPhoto, selectedPhotoId, isPaused }) {
  document.addEventListener('keydown', (event) => {
    const direction = DIRECTION_BY_KEY[event.key];
    const hasModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    if (!direction || hasModifier || event.defaultPrevented || isPaused()) return;
    event.preventDefault();
    const targetPhotoId = photoInDirection(selectedPhotoId(), direction);
    if (targetPhotoId) selectPhoto(targetPhotoId);
  });
}
