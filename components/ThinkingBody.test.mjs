import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { ThinkingBody } = await jiti.import("./ThinkingBody.tsx");

test("renders the capped, scroll-styled thinking body around its text", () => {
  const html = renderToStaticMarkup(React.createElement(
    ThinkingBody,
    { follow: true, color: "var(--text-muted)" },
    "Independent reasoning",
  ));

  assert.match(html, /class="thinking-block-content"/);
  assert.match(html, /white-space:pre-wrap/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /Independent reasoning/);
});

// The follow itself is DOM wiring, which the repo asserts at the source for the
// same decision in ChatWindow; the predicate is lib/chat-lazy-load's tested one.
test("pins the tail follow to a streaming message that is still at the bottom", async () => {
  const source = await readFile(new URL("./ThinkingBody.tsx", import.meta.url), "utf8");

  assert.match(source, /import \{ isScrollAtTail \} from "@\/lib\/chat-lazy-load"/);
  assert.match(source, /atTail\.current = isScrollAtTail\(el\.scrollTop, el\.clientHeight, el\.scrollHeight\)/);
  assert.match(source, /if \(!el \|\| !follow \|\| !atTail\.current\) return;\s*el\.scrollTop = el\.scrollHeight;/);
  // No dependency list, so it runs on every streaming chunk.
  assert.match(source, /el\.scrollTop = el\.scrollHeight;\s*\}\);/);
});

test("is wired to the message's streaming flag", async () => {
  const source = await readFile(new URL("./MessageView.tsx", import.meta.url), "utf8");

  assert.match(source, /<ThinkingBody follow=\{isStreaming === true\} color=/);
  assert.match(source, /<ThinkingBlock block=\{block as ThinkingContent\}[\s\S]*?isStreaming=\{isStreaming\}/);
});
