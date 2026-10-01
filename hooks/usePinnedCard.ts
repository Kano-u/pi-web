"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { foldPanes } from "@/lib/fold-panes";

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

  /** The panes the fold animates, looked up from the card that owns the header. */
  const panesIn = (): HTMLElement[] => {
    const card = headerRef.current?.parentElement ?? null;
    return card ? [...card.querySelectorAll<HTMLElement>("[data-pin-pane]")] : [];
  };

  const toggle = useCallback(() => {
    // A click that lands mid-fold finishes it instead of stacking animations.
    finishFoldRef.current?.();
    const panes = panesIn();
    const next = !open;
    setOpenState(next);
    onToggle?.(next);
    if (next) {
      // A finished fold and a reopen batch into one render, so the panes are given
      // their own height back rather than the height the fold had reached.
      for (const pane of panes) pane.style.height = "";
      setExpanded(true);
      return;
    }
    finishFoldRef.current = foldPanes({
      bar: headerRef.current,
      panes,
      onFinish: () => {
        finishFoldRef.current = null;
        setExpanded(false);
      },
    });
  }, [open, onToggle]);

  const setOpen = useCallback((next: boolean) => {
    finishFoldRef.current?.();
    finishFoldRef.current = null;
    for (const pane of panesIn()) pane.style.height = "";
    setOpenState(next);
    setExpanded(next);
  }, []);

  // Leaving the card mid-fold must not leave a frame loop running.
  useEffect(() => () => finishFoldRef.current?.(), []);

  return { open, expanded, headerRef, toggle, setOpen };
}
