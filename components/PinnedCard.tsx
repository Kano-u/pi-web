"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";

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
 */
export function PinnedCard({ kind, headerRef, expanded, hasBody, error, header, children, style }: PinnedCardProps) {
  return (
    <div
      className={`${kind}-card pin-card`}
      data-expanded={expanded}
      data-body={hasBody}
      data-error={error}
      style={style}
    >
      <div ref={headerRef} className="pin-card-header" style={{ display: "flex", alignItems: "stretch", minWidth: 0 }}>
        {header}
      </div>
      {hasBody && <div className="pin-card-body">{children}</div>}
    </div>
  );
}
