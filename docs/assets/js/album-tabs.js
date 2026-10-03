const STORAGE_KEY = 'album-order';

/**
 * Switch between the album orders with tab buttons and remember the choice in this browser.
 * @param {HTMLElement} tabList Element holding buttons with a data-album-order attribute.
 * @param {function(string): void} onChange Called with the chosen order, also once for the starting order.
 */
export function createAlbumTabs(tabList, onChange) {
  const tabs = [...tabList.querySelectorAll('[data-album-order]')];
  const orders = tabs.map((tab) => tab.dataset.albumOrder);

  function choose(order) {
    for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.albumOrder === order));
    rememberOrder(order);
    onChange(order);
  }

  tabList.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-album-order]');
    if (tab && tab.getAttribute('aria-selected') !== 'true') choose(tab.dataset.albumOrder);
  });

  const rememberedOrder = readRememberedOrder();
  choose(orders.includes(rememberedOrder) ? rememberedOrder : orders[0]);
}

function readRememberedOrder() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberOrder(order) {
  try {
    localStorage.setItem(STORAGE_KEY, order);
  } catch {
    return;
  }
}
