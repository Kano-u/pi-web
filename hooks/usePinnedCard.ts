"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { collapseOffscreenPanes, foldPanes, scrollableAncestor, unfoldPanes } from "@/lib/fold-panes";

/**
 * The open/expanded state machine of a pinned card, shared by the tool call and
 * thinking cards. `PinnedCard` renders the chrome around it.
 *
 * `open` is the reader's intent and drives the chevron right away; `expanded`
 * trails it while the panes fold away, so a collapse still has content to
 * animate and unmounts it only once it has reached zero height.
 */
export interface UsePinnedCardOptions {
  /** Whether the card starts open. */
  initiallyOpen?: boolean | (() => boolean);
  /** Called with the next open state whenever the header is toggled. */
  onToggle?: (open: boolean) => void;
}

export interface UsePinnedCard {
  /** The reader's intent, which the chevron follows right away. */
  open: boolean;
  /** Whether the body is mounted; trails `open` during a fold. */
  expanded: boolean;
  /** Attach to the card's header, which is what pins and what the fold measures. */
  headerRef: RefObject<HTMLDivElement | null>;
  /** Toggle the card, folding its panes away when closing. */
  toggle: () => void;
  /** Set the open state without animating, for external preference changes. */
  setOpen: (open: boolean) => void;
}

export function usePinnedCard({ initiallyOpen = false, onToggle }: UsePinnedCardOptions = {}): UsePinnedCard {
  const [expanded, setExpanded] = useState(initiallyOpen);
  const [open, setOpenState] = useState(initiallyOpen);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const finishFoldRef = useRef<(() => void) | null>(null);
  // `expanded` as of the last committed render: a card whose body is already
  // mounted is the one case where a toggle can animate on the spot.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  // Set by a toggle that opened the card in a commit the unfold could not measure.
  const pendingOpenRef = useRef(false);

  // A card only auto-collapses after it has been on screen once, so a thinking
  // block below the initial scroll position keeps the expand-all preference.
  const seenRef = useRef(false);

  /** The panes the fold animates, looked up from the card that owns the header. */
  const panesIn = useCallback((): HTMLElement[] => {
    const card = headerRef.current?.parentElement ?? null;
    return card ? [...card.querySelectorAll<HTMLElement>("[data-pin-pane]")] : [];
  }, []);

  /** Opens the panes again, from zero back to the height they had before. */
  const startUnfold = useCallback(() => {
    const panes = panesIn();
    if (panes.length === 0) return;
    finishFoldRef.current = unfoldPanes({
      bar: headerRef.current,
      panes,
      onFinish: () => {
        finishFoldRef.current = null;
      },
    });
  }, [panesIn]);

  const toggle = useCallback(() => {
    // A click that lands mid-fold finishes it instead of stacking animations.
    finishFoldRef.current?.();
    finishFoldRef.current = null;
    const next = !open;
    setOpenState(next);
    onToggle?.(next);
    if (next) {
      // A card that is still closed has no body yet, so its panes are measured
      // after the commit, in the layout effect below, which zeroes them before
      // anything is painted. A click that interrupts a fold finds the panes already
      // mounted and can start the unfold on the spot — but the fold's finish above
      // queued a setExpanded(false) that would unmount them in the same batch, so
      // the reopen puts it back.
      setExpanded(true);
      if (expandedRef.current) {
        startUnfold();
        return;
      }
      pendingOpenRef.current = true;
      return;
    }
    finishFoldRef.current = foldPanes({
      bar: headerRef.current,
      panes: panesIn(),
      onFinish: () => {
        finishFoldRef.current = null;
        setExpanded(false);
      },
    });
  }, [open, onToggle, panesIn, startUnfold]);

  // Runs after the body mounts but before the browser paints it: measure the panes
  // and hand them to the unfold, which zeroes them and animates them back.
  useLayoutEffect(() => {
    if (!pendingOpenRef.current) return;
    pendingOpenRef.current = false;
    startUnfold();
  }, [expanded, startUnfold]);

  const setOpen = useCallback((next: boolean) => {
    finishFoldRef.current?.();
    finishFoldRef.current = null;
    for (const pane of panesIn()) pane.style.height = "";
    setOpenState(next);
    setExpanded(next);
  }, [panesIn]);

  // Leaving the card mid-fold must not leave a frame loop running.
  useEffect(() => () => finishFoldRef.current?.(), []);

  // A card that has scrolled above the list folds itself away, so a long
  // transcript does not carry expanded bodies no one can see. It has to have
  // been on screen at least once: a card the reader has not reached yet (a
  // thinking block opened by the expand-all preference) keeps its state.
  useEffect(() => {
    if (!open) return;
    const card = headerRef.current?.parentElement ?? null;
    const scroller = card ? scrollableAncestor(card) : null;
    if (!card || !scroller) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          seenRef.current = true;
          continue;
        }
        const rootTop = entry.rootBounds?.top ?? scroller.getBoundingClientRect().top;
        if (!seenRef.current || entry.boundingClientRect.bottom > rootTop) continue;
        finishFoldRef.current?.();
        finishFoldRef.current = null;
        collapseOffscreenPanes({ bar: headerRef.current, panes: panesIn() });
        setOpenState(false);
        setExpanded(false);
      }
    }, { root: scroller });
    observer.observe(card);
    return () => observer.disconnect();
  }, [open, panesIn]);

  return { open, expanded, headerRef, toggle, setOpen };
}
