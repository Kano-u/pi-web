import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { isShellToolName, getShellTimeout } = await jiti.import("./tool-names.ts");

test("recognizes only pi's two built-in shell tools", () => {
  assert.equal(isShellToolName("bash"), true);
  assert.equal(isShellToolName("Bash"), true);
  assert.equal(isShellToolName("powershell"), true);
  assert.equal(isShellToolName("PowerShell"), true);
  assert.equal(isShellToolName("read"), false);
  assert.equal(isShellToolName("mcp__server__bash"), false);
  assert.equal(isShellToolName("apply_patch"), false);
});

test("reads a positive finite timeout argument and ignores everything else", () => {
  assert.equal(getShellTimeout({ command: "npm run dev", timeout: 30 }), 30);
  assert.equal(getShellTimeout({ command: "npm run dev", timeout: 90.5 }), 90.5);
  assert.equal(getShellTimeout({ command: "npm run dev" }), null);
  assert.equal(getShellTimeout({ command: "npm run dev", timeout: 0 }), null);
  assert.equal(getShellTimeout({ command: "npm run dev", timeout: -1 }), null);
  assert.equal(getShellTimeout({ command: "npm run dev", timeout: "30" }), null);
  assert.equal(getShellTimeout({ command: "npm run dev", timeout: Number.NaN }), null);
  assert.equal(getShellTimeout(null), null);
  assert.equal(getShellTimeout("bash"), null);
});
