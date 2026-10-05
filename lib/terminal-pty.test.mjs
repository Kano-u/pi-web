import assert from "node:assert/strict";
import test from "node:test";
import { PTY_BACKEND_ENV, isBunRuntime, loadPtyModule, ptyModuleName } from "./terminal-pty.ts";

test("auto picks bun-pty under Bun and node-pty everywhere else", () => {
  delete process.env[PTY_BACKEND_ENV];
  assert.equal(ptyModuleName(true), "bun-pty");
  assert.equal(ptyModuleName(false), "node-pty");
  assert.equal(ptyModuleName(true, "auto"), "bun-pty");
  assert.equal(ptyModuleName(false, "auto"), "node-pty");
});

test("an explicit backend override wins over runtime detection", () => {
  assert.equal(ptyModuleName(true, "node-pty"), "node-pty");
  assert.equal(ptyModuleName(false, "bun-pty"), "bun-pty");
});

test("an unknown or empty override falls back to the runtime default", () => {
  for (const value of ["", "ttyd", "pty", "BUN-PTY"]) {
    assert.equal(ptyModuleName(true, value), "bun-pty");
    assert.equal(ptyModuleName(false, value), "node-pty");
  }
});

test("isBunRuntime only trusts a defined Bun global", () => {
  assert.equal(isBunRuntime({}), false);
  assert.equal(isBunRuntime({ Bun: undefined }), false);
  assert.equal(isBunRuntime({ Bun: { version: "1.4.2" } }), true);
});

test("the override env var name stays stable", () => {
  assert.equal(PTY_BACKEND_ENV, "PI_WEB_TERMINAL_BACKEND");
});

test("bun-pty goes through the runtime's own require, never a static request", () => {
  const original = process.getBuiltinModule;
  const calls = [];
  const fakeModule = { spawn: () => {} };
  process.getBuiltinModule = (id) => {
    assert.equal(id, "module");
    return { createRequire: (base) => (name) => { calls.push({ base, name }); return fakeModule; } };
  };
  try {
    process.env[PTY_BACKEND_ENV] = "bun-pty";
    assert.equal(loadPtyModule(), fakeModule);
  } finally {
    delete process.env[PTY_BACKEND_ENV];
    process.getBuiltinModule = original;
  }
  // A bundler rewrites an `import`/`require` of node:module and would never see
  // this call, which is the whole point: `bun-pty` cannot be in the module graph.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "bun-pty");
  assert.ok(calls[0].base.endsWith(".js") || calls[0].base.endsWith(".cjs"), calls[0].base);
});

test("a runtime without process.getBuiltinModule reports the bun-pty fix", () => {
  const original = process.getBuiltinModule;
  process.getBuiltinModule = undefined;
  try {
    process.env[PTY_BACKEND_ENV] = "bun-pty";
    assert.throws(() => loadPtyModule(), /Cannot load the bun-pty terminal module/);
  } finally {
    delete process.env[PTY_BACKEND_ENV];
    process.getBuiltinModule = original;
  }
});
