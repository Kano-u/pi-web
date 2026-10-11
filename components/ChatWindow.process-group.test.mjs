import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// The process section of a turn collapses by default as soon as the turn has an
// answer (upstream re-keys `ProcessDetailsGroup` to make it remount collapsed),
// which hid a thinking block the reader had just opened while the turn streamed.
// The fork keeps it open from the reader's own choice, through a `rememberedOpen`
// prop and a layout effect of the group's own. `components/ChatWindow.tsx` is an
// upstream-synced file, so pin those lines here.
const source = readFileSync(new URL("./ChatWindow.tsx", import.meta.url), "utf8");

test("keeps a turn's process section open while the reader has a thinking block open", () => {
  assert.match(source, /import \{ hasOpenedThinking \} from "@\/lib\/thinking-expansion-state";/);
  // Upstream v0.11.1 computes the process view with `getFinalAnswerViews`, whose
  // `process.content` is the slice of the message the group renders (through
  // `messageOverride`), so its block indexes are the ones `MessageView` hands
  // `ThinkingBlock`.
  assert.match(source, /const openedProcess = hasOpenedThinking\(finalViews\.process\.content\);/);
  // Upstream keys the group's default on `collapsesProcessDetails(finalAnswerMessage)`
  // (`answered`), not on the answer's presence; the fork only adds the memory.
  assert.match(source, /defaultExpanded=\{!answered\} rememberedOpen=\{openedProcess\}/);
  assert.match(source, /if \(rememberedOpen\) setExpanded\(true\);/);
});
