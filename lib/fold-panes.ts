/**
 * Animates a card's panes between their natural height and zero.
 *
 * `foldPanes` runs the panes' heights down to zero while the message list scrolls
 * by the same amount, so a pinned header keeps the place it was pinned to and the
 * blocks below rise into the gap. `unfoldPanes` runs the same loop backwards, so
 * opening a card covers the ground the fold gave up — over a fixed short pop of its
 * own instead of the fold's distance-scaled time. Both run from one frame loop,
 * because a pinned header only *looks* pinned: the list has to move exactly as the
 * content changes height.
 *
 * Either returns a function that finishes the run right away, for a toggle that
 * arrives while it is still running.
 */

/** The shortest a fold runs; the panes and the list share one reading of it. */
const MIN_DURATION_MS = 200;
/** The longest a fold runs, so a tall card never feels sluggish. */
const MAX_DURATION_MS = 400;
/** At or below this distance a fold stays at MIN; at LONG_FOLD_DISTANCE it reaches MAX. */
const SHORT_FOLD_DISTANCE = 150;
const LONG_FOLD_DISTANCE = 640;

/** The unfold's own duration: a pop the reader asked for, not a slide to watch. */
const UNFOLD_DURATION_MS = 150;

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

/** How much of the fold runs at a constant speed, underneath the ease-out. */
const FOLD_LINEAR_FLOOR = 0.3;

/**
 * The fold's easing: a share of the run held at a constant speed under the ease-out,
 * so the last stretch keeps moving instead of creeping to a halt. Cubic ease-out
 * alone spends 46% of the run on its final tenth of the distance; holding a third of
 * the run at the average speed cuts that to 28%, and the creep the reader actually
 * feels — the last hundredth — from 22% of the run to 3%. The fold lands at that
 * speed instead of fading out at the end.
 */
function foldEasing(progress: number): number {
  return FOLD_LINEAR_FLOOR * progress + (1 - FOLD_LINEAR_FLOOR) * easeOut(progress);
}

/**
 * Ease-out quint, for the unfold: a sharper start than the fold's cubic and a far
 * shorter tail, so the card pops open and is simply there once it lands.
 */
function easeOutQuint(progress: number): number {
  const remaining = 1 - progress;
  const squared = remaining * remaining;
  return 1 - squared * squared * remaining;
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
  /** Called once, when the panes have reached their end height. */
  onFinish: () => void;
}

/** One loop for both directions: `1` folds the panes away, `-1` opens them again. */
type FoldDirection = 1 | -1;

interface FoldRun extends FoldOptions {
  direction: FoldDirection;
}

function runFold({ bar, panes, onFinish, direction }: FoldRun): () => void {
  const card = bar?.parentElement ?? null;
  const scroller = bar ? scrollableAncestor(bar) : null;
  // Measured before the first frame on panes that carry no height from an earlier
  // run, so both directions start from the panes' natural height.
  const heights = panes.map((pane) => {
    pane.style.height = "";
    return pane.getBoundingClientRect().height;
  });
  // Opening has to start from zero: the body mounts in the commit that opens the
  // card, and without this the first frame would paint it at its full height.
  if (direction === -1) for (const pane of panes) pane.style.height = "0px";
  // How far the header is displaced below its own place in the layout. Moving the
  // list back by that much leaves the header on screen, at the position it was
  // pinned to. A header whose card has not been scrolled past is not displaced,
  // which is why folding a card at rest never scrolls anything.
  const shift = bar && card
    ? Math.max(0, bar.getBoundingClientRect().top - card.getBoundingClientRect().top)
    : 0;
  const scrollFrom = scroller ? scroller.scrollTop : 0;
  // Only a fold moves the list back: the panes it clears sit above the content
  // below them, and the header would slide out of its pinned place. An unfold grows
  // the panes back below the header, where nothing above it moves, so it leaves the
  // list alone — and a scroll offset written there would overwrite whoever else is
  // moving the list, an off-screen card handing its height back included.
  const compensates = direction === 1;
  // The panes' combined height and the list's scroll-back both scale with the card.
  const distance = Math.max(shift, heights.reduce((sum, height) => sum + height, 0));
  // A fold scales with the card so a tall one does not rush; an unfold is the pop the
  // reader is waiting on, and keeps one short duration however tall the card is.
  const duration = direction === 1 ? foldDuration(distance) : UNFOLD_DURATION_MS;

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
    // A fold leaves the panes at zero; an unfold hands them back to the layout, so
    // content that arrives later (a deferred body, streaming output) still fits.
    for (const pane of panes) pane.style.height = direction === 1 ? "0px" : "";
    if (compensates && scroller && !wheeled) scroller.scrollTop = scrollFrom - shift;
    onFinish();
  };

  // Reduced motion keeps the compensating scroll: it is layout, not animation.
  // A card whose body renders no pane has nothing to animate either.
  if (panes.length === 0 || prefersReducedMotion()) {
    settle();
    return settle;
  }

  listen();
  const started = performance.now();
  const frame = (now: number) => {
    if (finished) return;
    const progress = Math.min(1, (now - started) / duration);
    const eased = direction === 1 ? foldEasing(progress) : easeOutQuint(progress);
    for (let index = 0; index < panes.length; index += 1) {
      panes[index].style.height = `${heights[index] * (direction === 1 ? 1 - eased : eased)}px`;
    }
    if (compensates && scroller && !wheeled) scroller.scrollTop = scrollFrom - shift * eased;
    if (progress < 1) {
      window.requestAnimationFrame(frame);
      return;
    }
    settle();
  };
  window.requestAnimationFrame(frame);

  return settle;
}

/** Folds the panes away, taking the list back by the height they gave up. */
export function foldPanes(options: FoldOptions): () => void {
  return runFold({ ...options, direction: 1 });
}

/** Opens the panes again: the same loop, backwards. */
export function unfoldPanes(options: FoldOptions): () => void {
  return runFold({ ...options, direction: -1 });
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
