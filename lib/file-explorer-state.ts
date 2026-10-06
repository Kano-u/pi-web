const EXPLORER_OPEN_STORAGE_KEY = "pi-web:file-explorer:open";
const EXPLORER_SHOW_IGNORED_STORAGE_KEY = "pi-web:file-explorer:show-ignored";

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

/**
 * Whether the tree lists `.gitignore`d and conventionally hidden entries.
 *
 * This is a Pi Web addition: upstream always filters them, but a missing key
 * means the new default, so a fresh browser shows everything.
 */
export function loadExplorerShowIgnored(storage: StorageLike | null = getBrowserStorage()): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(EXPLORER_SHOW_IGNORED_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveExplorerShowIgnored(
  show: boolean,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(EXPLORER_SHOW_IGNORED_STORAGE_KEY, String(show));
  } catch {
    // Persistence is best-effort; privacy mode and storage quotas must not break the explorer.
  }
}
