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
const SHORTEST_SWIPE_PX = 24;
const SWIPE_DISTANCE_PER_STEP_PX = 50;

/**
 * Move the photo selection instead of scrolling the page: the arrow keys move to the photo beside, above or below,
 * while the mouse wheel and vertical swipes step to the next or previous photo.
 * @param {{move: function(string): void, isViewerOpen: function(): boolean, stepViewer: function(number): void,
 *   swipeArea: HTMLElement}} controls Moves the selection up, down, to the next or previous photo; tells whether the
 *   photo viewer is open; steps the viewer; and names the element that reacts to swipes.
 */
export function enableSelectionControls({ move, isViewerOpen, stepViewer, swipeArea }) {
  followArrowKeys(move, isViewerOpen);
  followWheel(move, isViewerOpen, stepViewer);
  followSwipes(move, swipeArea);
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

function followSwipes(move, swipeArea) {
  let swipeStartY = null;
  let ignoreNextClick = false;
  swipeArea.addEventListener('pointerdown', (event) => {
    ignoreNextClick = false;
    swipeStartY = event.pointerType === 'mouse' ? null : event.clientY;
  });
  swipeArea.addEventListener('pointercancel', () => {
    swipeStartY = null;
  });
  swipeArea.addEventListener('pointerup', (event) => {
    if (swipeStartY === null) return;
    const swipedUpBy = swipeStartY - event.clientY;
    swipeStartY = null;
    if (Math.abs(swipedUpBy) < SHORTEST_SWIPE_PX) return;
    ignoreNextClick = true;
    const steps = Math.max(1, Math.round(Math.abs(swipedUpBy) / SWIPE_DISTANCE_PER_STEP_PX));
    for (let step = 0; step < steps; step += 1) move(swipedUpBy > 0 ? 'next' : 'previous');
  });
  swipeArea.addEventListener(
    'click',
    (event) => {
      if (!ignoreNextClick) return;
      ignoreNextClick = false;
      event.stopPropagation();
      event.preventDefault();
    },
    { capture: true },
  );
}
