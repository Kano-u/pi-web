"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { formatDurationLabel, remainingTimeoutSeconds } from "@/lib/duration-format";

/**
 * The deadline badge of a running shell call, in the tool card's duration slot.
 *
 * It ticks once a second and reads as the time the command still has left, so
 * reaching zero is the moment pi's `timeout` fires and kills the command — the
 * label then says so rather than counting below zero. The elapsed duration takes
 * the slot back as soon as the call reports a result.
 *
 * `startedAt` is the assistant message's timestamp, the same basis the elapsed
 * duration uses, and therefore a few seconds earlier than the command itself
 * (the turn's model generation time). It is undefined for a message that has not
 * started running or for an old session file without a timestamp; both cases
 * show the full `timeout` without ticking.
 */
export function ShellTimeoutBadge({ timeout, startedAt }: { timeout: number; startedAt?: number }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const remaining = startedAt === undefined ? null : remainingTimeoutSeconds(timeout, startedAt, now);
  const running = remaining !== null && remaining > 0;

  useEffect(() => {
    if (!running) return;
    // Read the clock on each tick instead of counting ticks: a background tab
    // throttles intervals, and the countdown must not drift behind them.
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const label = remaining === null || remaining > 0
    ? formatDurationLabel(remaining ?? timeout)
    : t("chat.toolTimeoutEnding");

  // The card paints an erroring tool name in the same red, so a deadline the
  // command can run into reads as a warning in that header.
  return (
    <span style={{ fontSize: 11, color: "#f87171", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
      {label}
    </span>
  );
}
