/**
 * Compact duration labels for the chat metrics (tool durations, shell timeouts,
 * thinking durations).
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
