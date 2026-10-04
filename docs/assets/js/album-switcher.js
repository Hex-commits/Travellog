import { formatCount, formatShortDateRangeWithYear } from './formatting.js';

/**
 * Show the album's name as the page title and open a menu of all albums when it is clicked.
 * @param {HTMLElement} switcher Element holding the title button, the name and the menu.
 * @param {object[]} albums Albums from albums.json, most recent first.
 * @param {?object} currentAlbum The album shown on this page.
 */
export function createAlbumSwitcher(switcher, albums, currentAlbum) {
  const button = switcher.querySelector('[data-album-button]');
  const menu = switcher.querySelector('[data-album-menu]');
  switcher.querySelector('[data-album-name]').textContent = currentAlbum?.name ?? 'No albums yet';
  menu.replaceChildren(...albums.map((album) => renderAlbumOption(album, album === currentAlbum)));
  button.disabled = albums.length === 0;

  const setOpen = (open) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('click', (event) => {
    if (!switcher.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || menu.hidden) return;
    setOpen(false);
    button.focus();
  });
}

function renderAlbumOption(album, isCurrent) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'album-option';
  link.href = `?album=${encodeURIComponent(album.slug)}`;
  if (isCurrent) link.setAttribute('aria-current', 'page');
  const name = document.createElement('span');
  name.className = 'album-option-name';
  name.textContent = album.name;
  const details = document.createElement('span');
  details.className = 'album-option-details';
  details.textContent = [
    formatShortDateRangeWithYear(album.firstDay, album.lastDay),
    formatCount(album.photoCount, 'photo', 'photos'),
  ]
    .filter(Boolean)
    .join(' · ');
  link.append(name, details);
  item.append(link);
  return item;
}
