"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { useI18n } from "@/hooks/useI18n";
/** The card's kind, which only changes its colour tint. */
export type PinnedCardKind = "tool" | "thinking";

export interface PinnedCardProps {
  kind: PinnedCardKind;
  /** The sticky header, and what the fold measures. */
  headerRef: RefObject<HTMLDivElement | null>;
  /** Whether the body is mounted; trails the reader's intent during a fold. */
  expanded: boolean;
  /** Whether there is anything below the header at all. */
  hasBody: boolean;
  /** Tool cards turn red when the call failed. */
  error?: boolean;
  /** The header row: the toggle button, plus any extra actions. */
  header: ReactNode;
  /** Everything below the header; only mounted while `hasBody`. */
  children: ReactNode;
  style?: CSSProperties;
}

/**
 * The pinned-card chrome shared by tool calls and thinking blocks: a title bar
 * that pins 8px below the top of the message list and a body that folds away
 * into it. The open/expanded state machine lives in `usePinnedCard`; this renders
 * the boxes around both.
 *
 * The card's own box clips nothing and paints nothing, so the header's sticky
 * containing block stays the message list (see `.pin-card` in app/globals.css).
 * The header draws the card's top edge and `.pin-card-body` the rest, which is
 * why they are two boxes rather than one bordered card.
 *
 * An expanded card also caps every pane at one screen and shows the rest behind a
 * "show all" row: a pane taller than that is cut short as a preview with a fade, so
 * a fold never crosses several screens while the reader watches. The cap lives on
 * the pane (see `[data-pin-pane]` in app/globals.css) rather than on the body,
 * because the pane's own height is what the fold animates and what the list
 * compensates for.
 */
export function PinnedCard({ kind, headerRef, expanded, hasBody, error, header, children, style }: PinnedCardProps) {
  const { t } = useI18n();
  const [full, setFull] = useState(false);
  const [preview, setPreview] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  /**
   * A pane taller than the cap is cut short, and `data-clipped` on it is what makes
   * the cut fade out with the row below it offering the rest. Measured rather than
   * assumed: a pane whose content fits carries no attribute and no row.
   */
  const measure = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    let clipped = false;
    for (const pane of body.querySelectorAll<HTMLElement>("[data-pin-pane]")) {
      if (pane.scrollHeight > pane.clientHeight + 1) {
        clipped = true;
        pane.dataset.clipped = "true";
        continue;
      }
      delete pane.dataset.clipped;
    }
    setPreview(clipped);
  }, []);

  // A collapse hands back the reader's "show all": the next expansion opens on the
  // preview again.
  useEffect(() => {
    if (!expanded) setFull(false);
  }, [expanded]);

  // Runs after every render while the body is mounted, so the fade and the row
  // arrive with the content that overflows instead of a frame later.
  useLayoutEffect(() => {
    if (expanded) measure();
  });

  // The one thing that can change how much of a pane fits without a render: the
  // viewport, which the cap is measured in.
  useEffect(() => {
    if (!expanded) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [expanded, measure]);

  return (
    <div
      className={`${kind}-card pin-card`}
      data-expanded={expanded}
      data-body={hasBody}
      data-error={error}
      data-full={full}
      style={style}
    >
      <div ref={headerRef} className="pin-card-header" style={{ display: "flex", alignItems: "stretch", minWidth: 0 }}>
        {header}
      </div>
      {hasBody && (
        <div ref={bodyRef} className="pin-card-body">
          {children}
          {preview && !full && (
            // A pane as far as the fold is concerned: the row is body the collapse
            // has to hand back with the rest, so it carries the attribute the fold
            // measures and animates.
            <button type="button" data-pin-pane="" className="pin-card-show-all" onClick={() => setFull(true)}>
              <span>{t("chat.showAll")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
