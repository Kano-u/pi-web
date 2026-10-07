const EXPLORER_OPEN_STORAGE_KEY = "pi-web:file-explorer:open";

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

export function loadExplorerOpen(storage: StorageLike | null = getBrowserStorage()): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(EXPLORER_OPEN_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveExplorerOpen(
  open: boolean,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(EXPLORER_OPEN_STORAGE_KEY, String(open));
  } catch {
    // Persistence is best-effort; privacy mode and storage quotas must not break the explorer.
  }
}

const GIT_HISTORY_OPEN_STORAGE_KEY = "pi-web:git-history:open";

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
    // Best-effort, as for the explorer.
  }
}
