import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hookSource = await readFile(new URL("./useLocalFileManager.ts", import.meta.url), "utf8");
const revealButtonSource = await readFile(new URL("../components/RevealInFileManagerButton.tsx", import.meta.url), "utf8");
const markdownBodySource = await readFile(new URL("../components/MarkdownBody.tsx", import.meta.url), "utf8");
const sessionSidebarSource = await readFile(new URL("../components/SessionSidebar.tsx", import.meta.url), "utf8");
const openFolderSource = await readFile(new URL("../lib/open-folder.ts", import.meta.url), "utf8");

test("decides from the browser's own host through the shared loopback check", () => {
  // The server gates /api/open-folder on the request's Host header, and a
  // same-origin browser sends its own window.location.host, so reusing the same
  // predicate is what keeps the hidden control and the 403 in agreement.
  assert.match(hookSource, /import \{ isLoopbackHost \} from "@\/lib\/loopback-host"/);
  assert.match(hookSource, /isLoopbackHost\(window\.location\.host\)/);
});

test("assumes local for the server snapshot so a host browser keeps the control", () => {
  assert.match(hookSource, /function getServerLocalFileManagerAvailability\(\): boolean \{[\s\S]*?return true;/);
});

test("the server route and the client share one loopback implementation", () => {
  // lib/open-folder.ts must re-export rather than re-implement, or the two
  // sides can drift and the control can appear where the route would 403.
  assert.match(openFolderSource, /export \{ isLoopbackHost \} from "\.\/loopback-host"/);
  assert.doesNotMatch(openFolderSource, /function isLoopbackHost/);
});

test("hides the reveal button entirely when the browser is not on this machine", () => {
  assert.match(revealButtonSource, /useLocalFileManagerAvailable\(\)/);
  assert.match(revealButtonSource, /if \(!available\) return null;/);
});

test("hides the sidebar folder button on a LAN browser", () => {
  assert.match(sessionSidebarSource, /const localFileManagerAvailable = useLocalFileManagerAvailable\(\)/);
  assert.match(sessionSidebarSource, /\{localFileManagerAvailable && \(selectedCwd \?\? selectedCwdProp\) && \(/);
});

test("does not fall back to revealing a directory from a LAN browser", () => {
  assert.match(markdownBodySource, /const fileManagerAvailable = useLocalFileManagerAvailable\(\)/);
  assert.match(markdownBodySource, /if \(fileManagerAvailable\) setError\(await revealPathInFileManager\(filePath\)\)/);
});
