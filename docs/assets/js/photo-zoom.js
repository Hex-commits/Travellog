const MAXIMUM_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const WHEEL_ZOOM_SPEED = 0.0015;
const DOUBLE_TAP_INTERVAL_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 30;
const ZOOMED_CLASS = 'is-zoomed';

/**
 * Let an image be zoomed with the wheel, pinching or a double tap, and panned by dragging.
 * @param {HTMLImageElement} image Image to zoom.
 * @returns {{reset: function(): void, isZoomed: function(): boolean, wasGesture: function(): boolean}} Zoom controls.
 */
export function enableZoom(image) {
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  const activePointers = new Map();
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let lastPanPoint = null;
  let lastTap = null;
  let gestureHappened = false;

  function apply() {
    const horizontalLimit = (image.offsetWidth * (scale - 1)) / 2;
    const verticalLimit = (image.offsetHeight * (scale - 1)) / 2;
    offsetX = clamp(offsetX, -horizontalLimit, horizontalLimit);
    offsetY = clamp(offsetY, -verticalLimit, verticalLimit);
    image.style.transform = scale === 1 ? '' : `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    image.classList.toggle(ZOOMED_CLASS, scale > 1);
  }

  function zoomTowards(targetScale, clientX, clientY) {
    const newScale = clamp(targetScale, 1, MAXIMUM_SCALE);
    const bounds = image.getBoundingClientRect();
    const baseCenterX = bounds.left + bounds.width / 2 - offsetX;
    const baseCenterY = bounds.top + bounds.height / 2 - offsetY;
    const pointX = clientX - baseCenterX;
    const pointY = clientY - baseCenterY;
    offsetX = pointX - ((pointX - offsetX) * newScale) / scale;
    offsetY = pointY - ((pointY - offsetY) * newScale) / scale;
    scale = newScale;
    if (scale === 1) {
      offsetX = 0;
      offsetY = 0;
    }
    apply();
  }

  function reset() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    activePointers.clear();
    lastPanPoint = null;
    lastTap = null;
    apply();
  }

  function pinchDistance() {
    const [first, second] = [...activePointers.values()];
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  function pinchCenter() {
    const [first, second] = [...activePointers.values()];
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }

  function handleTap(event) {
    const now = performance.now();
    const isDoubleTap =
      lastTap &&
      now - lastTap.time < DOUBLE_TAP_INTERVAL_MS &&
      Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < DOUBLE_TAP_DISTANCE_PX;
    if (isDoubleTap) {
      zoomTowards(scale > 1 ? 1 : DOUBLE_TAP_SCALE, event.clientX, event.clientY);
      gestureHappened = true;
      lastTap = null;
    } else {
      lastTap = { time: now, x: event.clientX, y: event.clientY };
    }
  }

  image.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomTowards(scale * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED), event.clientX, event.clientY);
  }, { passive: false });

  image.addEventListener('pointerdown', (event) => {
    if (activePointers.size === 0) gestureHappened = false;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    image.setPointerCapture(event.pointerId);
    if (activePointers.size === 2) {
      pinchStartDistance = pinchDistance();
      pinchStartScale = scale;
      gestureHappened = true;
      lastPanPoint = null;
    } else if (activePointers.size === 1 && scale > 1) {
      lastPanPoint = { x: event.clientX, y: event.clientY };
    }
  });

  image.addEventListener('pointermove', (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size === 2 && pinchStartDistance > 0) {
      const center = pinchCenter();
      zoomTowards(pinchStartScale * (pinchDistance() / pinchStartDistance), center.x, center.y);
    } else if (lastPanPoint) {
      offsetX += event.clientX - lastPanPoint.x;
      offsetY += event.clientY - lastPanPoint.y;
      lastPanPoint = { x: event.clientX, y: event.clientY };
      apply();
    }
  });

  function releasePointer(event) {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinchStartDistance = 0;
    if (activePointers.size === 1 && scale > 1) {
      const [remaining] = activePointers.values();
      lastPanPoint = { ...remaining };
    } else if (activePointers.size === 0) {
      lastPanPoint = null;
      if (event.type === 'pointerup' && !gestureHappened) handleTap(event);
    }
  }

  image.addEventListener('pointerup', releasePointer);
  image.addEventListener('pointercancel', releasePointer);
  image.addEventListener('dblclick', (event) => event.preventDefault());
  image.addEventListener('dragstart', (event) => event.preventDefault());

  return {
    reset,
    isZoomed: () => scale > 1,
    wasGesture: () => gestureHappened,
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}
