import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// The Bun terminal e2e: the same stack as e2e/terminal.mjs, but the dev server
// runs on Bun so node-pty is replaced by bun-pty. Asserting real shell output is
// what proves the PTY works: SSE connects either way, but a broken PTY prints
// nothing.
if (spawnSync("bun", ["--version"], { stdio: "ignore" }).status !== 0) {
  console.log("SKIP: bun is not installed");
  process.exit(0);
}

const root = fileURLToPath(new URL("../", import.meta.url));
assert.ok(!existsSync(join(root, ".next/dev/lock")), "Run in a checkout without an active dev server");
const artifacts = mkdtempSync(join(tmpdir(), "pi-web-terminal-bun-e2e-"));
console.log(`Artifacts: ${artifacts}`);
const agentDir = join(artifacts, "agent");
const workspace = join(artifacts, "workspace");
mkdirSync(join(agentDir, "sessions", "test"), { recursive: true });
mkdirSync(workspace);
const timestamp = "2026-09-05T00:00:00.000Z";
writeFileSync(join(agentDir, "sessions", "test", "terminal-bun.jsonl"), [
  { type: "session", version: 3, id: "terminal-bun", timestamp, cwd: workspace },
  { type: "session_info", id: "name", parentId: null, timestamp, name: "Bun terminal session" },
  { type: "message", id: "message", parentId: "name", timestamp, message: { role: "user", content: "Bun terminal message" } },
].map((entry) => JSON.stringify(entry)).join("\n") + "\n");

const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PI_CODING_AGENT_DIR: agentDir,
  PI_WEB_PASSWORD: "",
  NEXT_TELEMETRY_DISABLED: "1",
  HISTFILE: process.platform === "win32" ? "NUL" : "/dev/null",
  BASH_SILENCE_DEPRECATION_WARNING: "1",
  SHELL: process.platform === "win32" ? process.env.SHELL : "/bin/bash",
};
delete env.PI_WEB_TERMINAL_BACKEND;
const log = createWriteStream(join(artifacts, "server.log"));
const server = spawn("bun", [join(root, "node_modules/next/dist/bin/next"), "dev", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: root,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.pipe(log, { end: false });
server.stderr.pipe(log, { end: false });
const serverExit = once(server, "exit");
let browser;
try {
  for (let i = 0; ; i++) {
    const response = await fetch(`${base}/api/sessions`).catch(() => null);
    if (response?.ok) break;
    assert.ok(i < 120 && server.exitCode === null, "Server did not become ready");
    await delay(500);
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const errors = [];
  const created = new Set();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/terminal" && request.method() === "POST") created.add(request.postDataJSON().id);
  });
  const ready = () => page.locator(".terminal-panel:visible .is-ready").waitFor();
  const waitOutput = (pattern) => page.waitForFunction((source) => {
    const panel = [...document.querySelectorAll(".terminal-panel")].find((element) => element.getBoundingClientRect().width > 0);
    return new RegExp(source).test(panel?.querySelector(".xterm-rows")?.textContent ?? "");
  }, pattern);
  const run = async (command) => {
    await page.locator(".terminal-panel:visible .xterm-helper-textarea").focus();
    await page.keyboard.type(command);
    await page.keyboard.press("Enter");
  };
  try {
    await page.goto(`${base}/?session=terminal-bun`);
    await page.getByText("Bun terminal message", { exact: true }).waitFor();
    const showSidebar = page.getByRole("button", { name: "Show sidebar", exact: true });
    if (await showSidebar.count()) await showSidebar.click();
    await page.getByRole("button", { name: "Open workspace terminal", exact: true }).click();
    await ready();
    assert.equal(created.size, 1);
    const [id] = created;

    await run("export E2E_BUN_TOKEN=alive; printf '\\nTOKEN:%s:%s\\n' \"$E2E_BUN_TOKEN\" \"$$\"");
    await waitOutput("TOKEN:alive:[0-9]+");
    const pid = (await page.locator(".terminal-panel:visible .xterm-rows").innerText()).match(/TOKEN:alive:(\d+)/)[1];

    await run("printf '\\nBUN:%s\\n' \"$(uname -s)\"");
    await waitOutput("BUN:");

    await run("exit 7");
    await page.getByText("Process exited with code 7", { exact: true }).waitFor();

    await page.getByRole("button", { name: "Terminate terminal workspace", exact: true }).click();
    await page.locator(".terminal-panel").waitFor({ state: "detached" });
    assert.equal((await fetch(`${base}/api/terminal/${id}`)).status, 404);

    await page.screenshot({ path: join(artifacts, "terminal-bun.png"), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(`PASS: bun-pty shell (pid ${pid}), output, exit code, close`);
  } catch (error) {
    await page.screenshot({ path: join(artifacts, "failure.png"), fullPage: true });
    console.error(await page.locator("body").innerText());
    throw error;
  } finally {
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await serverExit;
  log.end();
}
