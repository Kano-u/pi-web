import assert from "node:assert/strict";
import test from "node:test";

import {
  clearThinkingExpansions,
  getThinkingExpansion,
  hasOpenedThinking,
  setThinkingExpansion,
} from "./thinking-expansion-state.ts";

const OPENING = "先看一个多租户通知系统的投递架构，逐个比较轮询、长连接与 SSE 的边界情况，";

test("remembers the reader's choice across the remounts of one block", () => {
  clearThinkingExpansions();
  assert.equal(getThinkingExpansion(0, OPENING), undefined);

  setThinkingExpansion(0, OPENING, true);
  // The streaming block remounts with the text it has grown since the click.
  assert.equal(getThinkingExpansion(0, `${OPENING}再从百万级并发与离线补偿往下推。`), true);

  setThinkingExpansion(0, `${OPENING}再从百万级并发往下推。`, false);
  assert.equal(getThinkingExpansion(0, `${OPENING}后面还有更多文本`), false);
});

test("matches a block whose text was retrimmed on the way in", () => {
  clearThinkingExpansions();
  setThinkingExpansion(2, "\n  排空队列的顺序也要考虑", true);
  assert.equal(getThinkingExpansion(2, "排空队列的顺序也要考虑，先看幂等键"), true);
});

test("falls back to the preference for another block or another index", () => {
  clearThinkingExpansions();
  setThinkingExpansion(0, OPENING, true);
  assert.equal(getThinkingExpansion(0, "另一个消息里的思考块正文"), undefined);
  assert.equal(getThinkingExpansion(1, OPENING), undefined);
});

test("records nothing for a block that was still empty", () => {
  clearThinkingExpansions();
  setThinkingExpansion(0, "   ", true);
  assert.equal(getThinkingExpansion(0, "后来才出现的思考文本"), undefined);
});

test("reports the process blocks whose thinking the reader opened", () => {
  clearThinkingExpansions();
  const blocks = [
    { type: "thinking", thinking: OPENING },
    { type: "toolCall", toolCallId: "call_1" },
  ];
  assert.equal(hasOpenedThinking(blocks), false);

  setThinkingExpansion(0, OPENING, true);
  assert.equal(hasOpenedThinking(blocks), true);

  setThinkingExpansion(0, OPENING, false);
  assert.equal(hasOpenedThinking(blocks), false);
});

test("counts only the reader's own openings, at the block's own index", () => {
  clearThinkingExpansions();
  setThinkingExpansion(2, "别的消息里的思考", true);
  assert.equal(hasOpenedThinking([{ type: "thinking", thinking: "别的消息里的思考" }]), false);
  assert.equal(hasOpenedThinking([
    { type: "text", text: "不是思考块" },
    { type: "thinking", thinking: "排空队列的顺序也要考虑" },
    { type: "thinking", thinking: "别的消息里的思考" },
  ]), true);
});

test("survives the history preview that replaces a committed block's text", () => {
  clearThinkingExpansions();
  // The live text the reader clicked, and the first-line preview the session file
  // holds once the turn is committed (`lib/session-reader.ts`).
  const live = "先看多租户通知的投递架构\n再从百万级并发往下列出取舍";
  setThinkingExpansion(0, live, true);
  assert.equal(getThinkingExpansion(0, "先看多租户通知的投递架构"), true);
  // Another block at the same index still follows the preference instead.
  assert.equal(getThinkingExpansion(0, "另一段独立的推演"), undefined);
});
