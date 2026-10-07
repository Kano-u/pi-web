"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { isScrollAtTail } from "@/lib/chat-lazy-load";

/**
 * The expanded thinking body — the fork's own wrapper around it.
 *
 * The body is height-capped and scrolls on its own, so while the model is still
 * streaming, every new line lands below the fold instead of pushing the chat.
 * This pins the view to the tail, and because the element mounts on expand,
 * opening a running block jumps straight to the newest text. A reader who
 * scrolls up detaches the follow (`isScrollAtTail`, the helper `ChatWindow`
 * already uses for the same decision); scrolling back to the bottom re-attaches
 * it.
 *
 * `follow` is the message's streaming flag, so a finished or historical block
 * opens at its first line, where reading starts, and never re-scrolls under the
 * reader.
 *
 * The class carries the cap and the scroll conventions (`app/globals.css`); the
 * inline styles below are the ones upstream's body used.
 */
export function ThinkingBody({ follow, color, children }: { follow: boolean; color: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const atTail = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      atTail.current = isScrollAtTail(el.scrollTop, el.clientHeight, el.scrollHeight);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // No dependency list on purpose: streaming re-renders this on every chunk and
  // the tail moves with the text, not with any value the effect could watch.
  useEffect(() => {
    const el = ref.current;
    if (!el || !follow || !atTail.current) return;
    el.scrollTop = el.scrollHeight;
  });

  return (
    <div ref={ref} className="thinking-block-content" style={{ minWidth: 0, color, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {children}
    </div>
  );
}
