/**
 * Animates a card's panes between their natural height and zero.
 *
 * `foldPanes` runs the panes' heights down to zero while the message list scrolls
 * by the same amount, so a pinned header keeps the place it was pinned to and the
 * blocks below rise into the gap. `unfoldPanes` runs the same loop backwards, so
 * opening a card covers the ground the fold gave up. Both run from one frame loop,
 * because a pinned header only *looks* pinned: the list has to move exactly as the
 * content changes height.
 *
 * Either returns a function that finishes the run right away, for a toggle that
 * arrives while it is still running.
 */

/**
 * The pop the reader watches: one viewport's worth of the panes' edge, whichever
 * direction it goes. A card the reader clicked should pop rather than slide, so this
 * does not scale with the distance — the pixels beyond the viewport are the ones that
 * stretch, and only as far as HIDDEN_MAX_MS allows.
 */
const POP_DURATION_MS = 150;

/**
 * The most the pixels outside the viewport may add to a run, together. They are given
 * time in proportion to the stretch that is watched, so a card ten screens tall and a
 * card that just fills the viewport open at the same speed where it shows, and neither
 * spends that time moving nothing the reader can see.
 */
const HIDDEN_MAX_MS = 150;

/**
 * Ease-out quint: a sharp start and a short tail, so the panes pop to where they are
 * going and are simply there once they land.
 */
function easeOut(progress: number): number {
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
  // Only the stretch of the panes that crosses the viewport is watched: a pane that
  // fills the viewport is the longest motion the reader can see, and the pixels beyond
  // it — above the viewport or below it — only push content around off screen. So the
  // watched stretch keeps the pop and those pixels are given time in proportion to it,
  // capped, since a card several screens tall would otherwise spend a second moving
  // nothing anyone can watch.
  const total = heights.reduce((sum, height) => sum + height, 0);
  const scrollerTop = scroller ? scroller.getBoundingClientRect().top : 0;
  const paneTop = panes[0]?.getBoundingClientRect().top ?? scrollerTop;
  const bandStart = Math.min(total, Math.max(0, scrollerTop - paneTop));
  const bandEnd = Math.min(total, scroller ? scrollerTop + scroller.clientHeight - paneTop : total);
  const watched = bandEnd - bandStart;
  const hidden = total - watched;
  const hiddenMs = watched > 0
    ? Math.min(HIDDEN_MAX_MS, (POP_DURATION_MS * hidden) / watched)
    : POP_DURATION_MS;
  const popMs = watched > 0 ? POP_DURATION_MS : 0;
  // The fraction of the panes the reader can watch go by, for either direction: an
  // unfold pushes the edge down through the band, a fold lifts it back up past it.
  const popFrom = direction === 1 ? 1 - bandEnd / total : bandStart / total;
  const popTo = direction === 1 ? 1 - bandStart / total : bandEnd / total;
  const leadMs = hidden > 0 ? (hiddenMs * popFrom * total) / hidden : 0;
  const trailMs = hidden > 0 ? (hiddenMs * (1 - popTo) * total) / hidden : 0;
  const duration = leadMs + popMs + trailMs;
  /** How far the run has gone at `elapsed` ms, as a fraction of the panes' height. */
  const progressAt = (elapsed: number): number => {
    if (elapsed <= leadMs) {
      return leadMs > 0 ? popFrom * easeOut(elapsed / leadMs) : popFrom;
    }
    if (elapsed <= leadMs + popMs) {
      const within = popMs > 0 ? (elapsed - leadMs) / popMs : 1;
      return popFrom + (popTo - popFrom) * easeOut(within);
    }
    const within = trailMs > 0 ? (elapsed - leadMs - popMs) / trailMs : 1;
    return popTo + (1 - popTo) * easeOut(within);
  };

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
  if (panes.length === 0 || total <= 0 || prefersReducedMotion()) {
    settle();
    return settle;
  }

  listen();
  const started = performance.now();
  const frame = (now: number) => {
    if (finished) return;
    const elapsed = now - started;
    const progress = progressAt(elapsed);
    for (let index = 0; index < panes.length; index += 1) {
      panes[index].style.height = `${heights[index] * (direction === 1 ? 1 - progress : progress)}px`;
    }
    if (compensates && scroller && !wheeled) scroller.scrollTop = scrollFrom - shift * progress;
    if (elapsed < duration) {
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
