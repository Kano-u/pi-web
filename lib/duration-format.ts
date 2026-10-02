/**
 * Compact duration labels for the chat metrics (tool durations, shell timeouts,
 * thinking durations), plus the remaining-seconds helper behind a running shell
 * call's timeout countdown.
 *
 * The units are spelled with the same `h`/`m`/`s` suffixes the session-info
 * popover uses, and a value keeps at most two of them: a smaller unit is only
 * printed when it carries information, so 60s reads `1m` rather than `1m 0s`.
 */
export function formatDurationLabel(seconds: number): string {
  if (!Number.isFinite(seconds)) return "";
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  return `${secs}s`;
}

/**
 * The seconds a shell call still has before its `timeout`, clamped to
 * `[0, timeoutSeconds]`.
 *
 * The lower clamp is the automatic-termination point: pi kills the command when
 * the limit is reached, so a running call's countdown stops at `0s` instead of
 * going negative. The upper clamp guards a browser/server clock skew, which
 * would otherwise let the badge read more than the limit the call was given.
 */
export function remainingTimeoutSeconds(timeoutSeconds: number, startedAtMs: number, nowMs: number): number {
  if (!Number.isFinite(timeoutSeconds) || !Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) {
    return Math.max(0, timeoutSeconds);
  }
  const remaining = timeoutSeconds - (nowMs - startedAtMs) / 1000;
  return Math.min(timeoutSeconds, Math.max(0, remaining));
}
