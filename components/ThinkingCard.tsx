"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ThinkingIcon } from "./ThinkingIcon";
import { PinnedCard } from "./PinnedCard";
import { useI18n } from "@/hooks/useI18n";
import { usePinnedCard } from "@/hooks/usePinnedCard";
import { getThinkingPreview } from "@/lib/message-display";
import { formatDurationLabel } from "@/lib/duration-format";
import { isThinkingExpandedByDefault, THINKING_EXPANDED_EVENT } from "@/lib/thinking-expansion-preference";
import { loadThinkingContent } from "@/lib/thinking-content";
import type { ThinkingContent } from "@/lib/types";

export interface ThinkingCardProps {
  block: ThinkingContent;
  duration?: number;
  sessionId?: string;
  entryId?: string;
  blockIndex: number;
}

/**
 * Cap the reasoning body so a long chain scrolls inside the card rather than
 * growing the card without bound, matching a tool result's pane. The cap also
 * stays within the card's own per-pane one (see `[data-pin-pane]` in
 * app/globals.css), so on a short viewport this body is the thing that scrolls
 * rather than a box cut in half inside it.
 */
const THINKING_BODY_MAX_HEIGHT = "min(560px, 70vh)";

/**
 * A thinking block rendered with the shared `PinnedCard`: the title bar pins to
 * the top of the message list while the reasoning body scrolls inside and folds
 * away. It lives in its own file so the sticky-card work stays out of
 * MessageView's frequently-synced upstream code.
 */
export function ThinkingCard({ block, duration, sessionId, entryId, blockIndex }: ThinkingCardProps) {
  const { t } = useI18n();
  const { open, expanded, headerRef, toggle, setOpen } = usePinnedCard({ initiallyOpen: isThinkingExpandedByDefault });
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const preview = getThinkingPreview(block.thinking);

  // Keep already-mounted cards in sync when the preference changes.
  useEffect(() => {
    const onChange = () => setOpen(isThinkingExpandedByDefault());
    window.addEventListener(THINKING_EXPANDED_EVENT, onChange);
    return () => window.removeEventListener(THINKING_EXPANDED_EVENT, onChange);
  }, [setOpen]);

  // Load deferred history content whenever the block is expanded.
  // loadThinkingContent() memoizes in-flight promises and drops failed ones
  // from its cache, so re-running this effect is cheap and a failed load can
  // be retried by collapsing and expanding the block again.
  useEffect(() => {
    if (!open || !block.deferred || content !== null) return;
    if (!sessionId || !entryId) {
      setError(tRef.current("i18n.thinkingUnavailable"));
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadThinkingContent(sessionId, entryId, blockIndex)
      .then((value) => {
        if (!cancelled) {
          setContent(value);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, block.deferred, content, sessionId, entryId, blockIndex]);

  const body = loading ? t("i18n.loadingThinking") : error ?? (block.deferred ? content : block.thinking);

  return (
    <PinnedCard
      kind="thinking"
      headerRef={headerRef}
      expanded={expanded}
      hasBody={expanded}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "calc(11px + var(--chat-font-size-offset, 0px))",
        lineHeight: 1.5,
        minWidth: 0,
      }}
      header={
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${t("i18n.thinking")}${preview ? `: ${preview}` : ""}`}
          title={t("i18n.thinking")}
          onClick={toggle}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            flex: 1,
            minWidth: 0,
            padding: "6px 10px",
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            font: "inherit",
            textAlign: "left",
          }}
        >
          <ThinkingIcon active={open} />
          <span style={{ flexShrink: 0, fontWeight: 600 }}>{t("i18n.thinking")}</span>
          {/* The preview keeps the row's flexible middle, so it is in the same
              place whether the card is open or closed. */}
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-dim)" }}>
            {!open && (preview ? <ReactMarkdown allowedElements={[]} unwrapDisallowed skipHtml>{preview}</ReactMarkdown> : "...")}
          </span>
          {duration !== undefined && (
            <span style={{ flexShrink: 0, color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>{formatDurationLabel(duration)}</span>
          )}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--text-dim)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            <polyline points="2 3.5 5 6.5 8 3.5" />
          </svg>
        </button>
      }
    >
      <div data-pin-pane="">
        <div
          style={{
            maxHeight: THINKING_BODY_MAX_HEIGHT,
            overflowY: "auto",
            padding: "8px 10px",
            color: error ? "#f87171" : "var(--text-muted)",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {body}
        </div>
      </div>
    </PinnedCard>
  );
}
