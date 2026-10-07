"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { getLiveFollowAttached } from "@/lib/chat-lazy-load";

/**
 * The expanded thinking body — the fork's own wrapper around it.
 *
 * The body is height-capped and scrolls on its own, so while the model is still
 * streaming, every new line lands below the fold instead of pushing the chat.
 * This pins the view to the tail, and because the element mounts on expand,
 * opening a running block jumps straight to the newest text. A reader who
 * scrolls up keeps their place.
 * The follow is `getLiveFollowAttached`, the same helper `ChatWindow` uses for
 * the chat scroller: only a real upward scroll detaches it, and coming back near
 * the tail re-attaches it. Tail distance alone is not enough — the browser
 * nudges `scrollTop` a few pixels when the growing content first overflows the
 * cap, and one fast chunk can land a paragraph below our own scroll to the tail,
 * either of which a bare tail test misreads as "the reader scrolled away" and
 * would silence the follow for the rest of the block.
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
  const followAttached = useRef(true);
  const previousScrollTop = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    previousScrollTop.current = el.scrollTop;
    const onScroll = () => {
      const scrollTop = el.scrollTop;
      followAttached.current = getLiveFollowAttached(
        followAttached.current,
        previousScrollTop.current,
        scrollTop,
        el.clientHeight,
        el.scrollHeight,
      );
      previousScrollTop.current = scrollTop;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // No dependency list on purpose: streaming re-renders this on every chunk and
  // the tail moves with the text, not with any value the effect could watch.
  useEffect(() => {
    const el = ref.current;
    if (!el || !follow || !followAttached.current) return;
    el.scrollTop = el.scrollHeight;
  });

  return (
    <div ref={ref} className="thinking-block-content" style={{ minWidth: 0, color, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {children}
    </div>
  );
}
