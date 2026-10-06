const DIRECTION_BY_KEY = {
  ArrowDown: 'down',
  ArrowUp: 'up',
  ArrowRight: 'next',
  ArrowLeft: 'previous',
};
const WHEEL_DISTANCE_PER_STEP = 60;
const WHEEL_LINE_HEIGHT_PX = 16;
const WHEEL_PAUSE_THAT_RESETS_MS = 250;
const SHORTEST_TIME_BETWEEN_WHEEL_STEPS_MS = 160;

/**
 * Step the photo selection with the arrow keys and the mouse wheel instead of scrolling the page.
 * @param {{move: function(string): void, isViewerOpen: function(): boolean, stepViewer: function(number): void}}
 *   controls Selection mover, viewer state check and viewer stepper.
 */
export function enableSelectionControls({ move, isViewerOpen, stepViewer }) {
  followArrowKeys(move, isViewerOpen);
  followWheel(move, isViewerOpen, stepViewer);
}

function followArrowKeys(move, isViewerOpen) {
  document.addEventListener('keydown', (event) => {
    const direction = DIRECTION_BY_KEY[event.key];
    const hasModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    if (!direction || hasModifier || event.defaultPrevented || isViewerOpen()) return;
    event.preventDefault();
    move(direction);
  });
}

function followWheel(move, isViewerOpen, stepViewer) {
  let collectedDistance = 0;
  let lastWheelAt = 0;
  let lastStepAt = 0;
  window.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || event.target.closest?.('.leaflet-container')) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheelAt > WHEEL_PAUSE_THAT_RESETS_MS) collectedDistance = 0;
      lastWheelAt = now;
      collectedDistance +=
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * WHEEL_LINE_HEIGHT_PX : event.deltaY;
      if (Math.abs(collectedDistance) < WHEEL_DISTANCE_PER_STEP) return;
      if (now - lastStepAt < SHORTEST_TIME_BETWEEN_WHEEL_STEPS_MS) return;
      const downwards = collectedDistance > 0;
      collectedDistance = 0;
      lastStepAt = now;
      if (isViewerOpen()) {
        stepViewer(downwards ? 1 : -1);
      } else {
        move(downwards ? 'next' : 'previous');
      }
    },
    { passive: false },
  );
}
