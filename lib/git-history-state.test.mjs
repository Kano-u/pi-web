import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { loadGitHistoryOpen, saveGitHistoryOpen } = await jiti.import("./git-history-state.ts");

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("starts collapsed until the Git history panel is opened once", () => {
  const storage = createStorage();

  assert.equal(loadGitHistoryOpen(storage), false);
  assert.equal(loadGitHistoryOpen(null), false);
});

test("saves and restores the Git history panel state", () => {
  const storage = createStorage();

  saveGitHistoryOpen(true, storage);
  assert.equal(loadGitHistoryOpen(storage), true);
  assert.equal(storage.values.get("pi-web:git-history:open"), "true");

  saveGitHistoryOpen(false, storage);
  assert.equal(loadGitHistoryOpen(storage), false);
});

test("falls back to collapsed when browser storage is unavailable", () => {
  const unavailable = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };

  assert.equal(loadGitHistoryOpen(unavailable), false);
  assert.doesNotThrow(() => saveGitHistoryOpen(true, unavailable));
});

test("an unrelated stored key leaves the panel collapsed", () => {
  const storage = createStorage({ "pi-web:file-explorer:open": "true" });

  assert.equal(loadGitHistoryOpen(storage), false);
});
