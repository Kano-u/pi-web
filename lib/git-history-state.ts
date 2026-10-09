/**
 * Fork-only: the reader's Git history panel state, kept per browser.
 *
 * Upstream's sidebar state lives in `lib/sidebar-prefs.ts`; this file exists so
 * the Git history pane's own keys stay out of it and survive a sync.
 */

const GIT_HISTORY_OPEN_STORAGE_KEY = "pi-web:git-history:open";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Git history starts collapsed until it is opened once. */
export function loadGitHistoryOpen(storage: StorageLike | null = getBrowserStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(GIT_HISTORY_OPEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveGitHistoryOpen(
  open: boolean,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(GIT_HISTORY_OPEN_STORAGE_KEY, String(open));
  } catch {
    // Persistence is best-effort; privacy mode and storage quotas must not break the panel.
  }
}
