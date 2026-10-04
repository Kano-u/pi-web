/**
 * Folds a card's panes into its header.
 *
 * The panes' heights run down to zero while the message list scrolls by the same
 * amount, so a pinned header keeps the place it was pinned to and the blocks
 * below rise into the gap. Both run from one frame loop, because a pinned header
 * only *looks* pinned: the list has to move exactly as the content shrinks.
 *
 * Returns a function that finishes the fold right away, for a toggle that
 * arrives while it is still running.
 */

/** The shortest a fold runs; the panes and the list share one reading of it. */
const MIN_DURATION_MS = 200;
/** The longest a fold runs, so a tall card never feels sluggish. */
const MAX_DURATION_MS = 400;
/** At or below this distance a fold stays at MIN; at LONG_FOLD_DISTANCE it reaches MAX. */
const SHORT_FOLD_DISTANCE = 150;
const LONG_FOLD_DISTANCE = 640;

/**
 * The fold's distance is the panes' height or the list's compensating scroll,
 * whichever is larger. Both grow with the card, so a fixed duration made a tall
 * card rush and a short one crawl. Scaling the duration keeps the motion roughly
 * constant in speed, while a short fold stays at MIN_DURATION_MS.
 */
function foldDuration(distance: number): number {
  const progress = Math.min(1, Math.max(0, (distance - SHORT_FOLD_DISTANCE) / (LONG_FOLD_DISTANCE - SHORT_FOLD_DISTANCE)));
  return MIN_DURATION_MS + (MAX_DURATION_MS - MIN_DURATION_MS) * progress;
}

/** Ease-out cubic: the fold starts fast and settles, like the height it drives. */
function easeOut(progress: number): number {
  const remaining = 1 - progress;
  return 1 - remaining * remaining * remaining;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** The box that actually scrolls the transcript, for the compensating scroll. */
export function scrollableAncestor(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return node;
  }
  return null;
}

export interface FoldOptions {
  /** The card's sticky header, which must stay where it is on screen. */
  bar: HTMLElement | null;
  /** The sections that fold away, each measured before the first frame. */
  panes: HTMLElement[];
  /** Called once, when the panes have reached zero height. */
  onFinish: () => void;
}

export function foldPanes({ bar, panes, onFinish }: FoldOptions): () => void {
  const card = bar?.parentElement ?? null;
  const scroller = bar ? scrollableAncestor(bar) : null;
  const heights = panes.map((pane) => pane.getBoundingClientRect().height);
  // How far the header is displaced below its own place in the layout. Moving the
  // list back by that much leaves the header on screen, at the position it was
  // pinned to. A header whose card has not been scrolled past is not displaced,
  // which is why folding a card at rest never scrolls anything.
  const shift = bar && card
    ? Math.max(0, bar.getBoundingClientRect().top - card.getBoundingClientRect().top)
    : 0;
  const scrollFrom = scroller ? scroller.scrollTop : 0;
  // The panes' combined height and the list's scroll-back both scale with the card.
  const distance = Math.max(shift, heights.reduce((sum, height) => sum + height, 0));
  const duration = foldDuration(distance);

  let finished = false;
  // A reader who wheels or taps mid-fold is scrolling on purpose: keep folding,
  // but leave the list where they put it.
  let wheeled = false;
  const onUserScroll = () => { wheeled = true; };
  const listen = () => {
    window.addEventListener("wheel", onUserScroll, { capture: true, passive: true });
    window.addEventListener("touchstart", onUserScroll, { capture: true, passive: true });
  };
  const stopListening = () => {
    window.removeEventListener("wheel", onUserScroll, { capture: true });
    window.removeEventListener("touchstart", onUserScroll, { capture: true });
  };

  const settle = () => {
    if (finished) return;
    finished = true;
    stopListening();
    for (const pane of panes) pane.style.height = "0px";
    if (scroller && !wheeled) scroller.scrollTop = scrollFrom - shift;
    onFinish();
  };

  // Reduced motion keeps the compensating scroll: it is layout, not animation.
  if (prefersReducedMotion()) {
    settle();
    return settle;
  }

  listen();
  const started = performance.now();
  const frame = (now: number) => {
    if (finished) return;
    const progress = Math.min(1, (now - started) / duration);
    const eased = easeOut(progress);
    for (let index = 0; index < panes.length; index += 1) {
      panes[index].style.height = `${heights[index] * (1 - eased)}px`;
    }
    if (scroller && !wheeled) scroller.scrollTop = scrollFrom - shift * eased;
    if (progress < 1) {
      window.requestAnimationFrame(frame);
      return;
    }
    settle();
  };
  window.requestAnimationFrame(frame);

  return settle;
}

/**
 * Collapses a card that has already left the viewport: the panes lose their
 * height at once and the list gives back exactly that much, so the content still
 * on screen keeps its place. `foldPanes` compensates by the header's
 * displacement, which is zero once a card has scrolled past; here the panes
 * themselves are what disappears.
 *
 * The list's position is read *before* the panes shrink and written back as an
 * absolute value, exactly as `foldPanes` does. Reading it afterwards would force
 * the pending layout first, in which the browser's own scroll anchoring has
 * already given the height back, and subtracting it a second time would scroll
 * the reader twice as far. Reading first keeps the write on the value anchoring
 * lands on, so it is a no-op where the browser does the job and the compensation
 * where it does not (Safari).
 */
export function collapseOffscreenPanes({ bar, panes }: { bar: HTMLElement | null; panes: HTMLElement[] }): void {
  const scroller = bar ? scrollableAncestor(bar) : null;
  const scrollFrom = scroller ? scroller.scrollTop : 0;
  const removed = panes.reduce((sum, pane) => sum + pane.getBoundingClientRect().height, 0);
  for (const pane of panes) pane.style.height = "0px";
  if (scroller) scroller.scrollTop = Math.max(0, scrollFrom - removed);
}
