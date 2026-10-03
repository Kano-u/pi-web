import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  NTFY_COMMAND_EXAMPLES,
  NTFY_COMPLETION_MESSAGE,
  NTFY_FALLBACK_TITLE,
  NTFY_TEST_MESSAGE,
  NTFY_VARIABLES,
  buildNtfyVariables,
  createNtfyNotifier,
  defaultNtfySettings,
  expandNtfyCommand,
  jsonEscapeNtfyValue,
  readNtfySettings,
  sendNtfyTest,
  writeNtfySettings,
} = await jiti.import("./ntfy.ts");

const ENABLED = { enabled: true, command: "curl -H 'Title: {{title}}' -d '{{message}}' https://ntfy.sh/my-topic" };

function okResult(overrides = {}) {
  return { ok: true, code: 0, signal: null, timedOut: false, stdout: "", stderr: "", ...overrides };
}

function makeEnvironment({ settings = ENABLED, session = {}, url = "", result = okResult() } = {}) {
  const runs = [];
  const env = {
    readSettings: () => settings,
    resolveSession: async () => session,
    resolveUrl: () => url,
    runCommand: async (argv) => {
      runs.push(argv);
      return result;
    },
  };
  return { notifier: createNtfyNotifier(env), runs };
}

async function captureErrors(callback) {
  const original = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args.join(" "));
  try {
    await callback();
  } finally {
    console.error = original;
  }
  return errors;
}

test("the placeholder list and the commands stay in step with the code", () => {
  const variables = buildNtfyVariables({ sessionId: "s" });
  for (const variable of NTFY_VARIABLES) {
    assert.ok(variable.name in variables, `missing variable ${variable.name}`);
  }
  for (const example of NTFY_COMMAND_EXAMPLES) {
    const result = expandNtfyCommand(example.command, variables);
    assert.ok(result.ok, `${example.labelKey}: ${result.ok ? "" : result.error}`);
  }
});

test("builds the session variables", () => {
  const variables = buildNtfyVariables({
    sessionId: "sess-1",
    sessionName: "修复登录",
    cwd: "/home/me/code/pi-web",
    url: "https://pi.example.com/?session=sess-1",
    now: new Date("2025-01-01T00:00:00.000Z"),
  });
  assert.equal(variables.title, "修复登录");
  assert.equal(variables.message, NTFY_COMPLETION_MESSAGE);
  assert.equal(variables.session, "sess-1");
  assert.equal(variables.project, "pi-web");
  assert.equal(variables.cwd, "/home/me/code/pi-web");
  assert.equal(variables.event, "complete");
  assert.equal(variables.url, "https://pi.example.com/?session=sess-1");
  assert.equal(variables.time, "2025-01-01T00:00:00.000Z");
});

test("falls back to the generic title and empty project", () => {
  const variables = buildNtfyVariables({ sessionId: "s", sessionName: "   " });
  assert.equal(variables.title, NTFY_FALLBACK_TITLE);
  assert.equal(variables.project, "");
  assert.equal(variables.cwd, "");
  assert.equal(variables.url, "");
});

test("jsonEscapeNtfyValue escapes what a JSON body needs", () => {
  assert.equal(jsonEscapeNtfyValue('a"b\\c\nd'), 'a\\"b\\\\c\\nd');
});

test("expands placeholders after splitting, so a value is one argv word", () => {
  const result = expandNtfyCommand(
    "curl -H 'Title: {{title}}' -d '{{message}}' https://ntfy.sh/my-topic",
    { title: "My session with 'quotes'", message: "Task finished." },
  );
  assert.deepEqual(result, {
    ok: true,
    argv: ["curl", "-H", "Title: My session with 'quotes'", "-d", "Task finished.", "https://ntfy.sh/my-topic"],
  });
});

test("keeps an unknown placeholder literal", () => {
  const result = expandNtfyCommand("curl -d '{{nope}}' https://x", {});
  assert.deepEqual(result, { ok: true, argv: ["curl", "-d", "{{nope}}", "https://x"] });
});

test("supports a multi-line command with a backslash continuation", () => {
  const result = expandNtfyCommand("curl \\\n  -d '{{message}}' \\\n  https://x", { message: "hi" });
  assert.deepEqual(result, { ok: true, argv: ["curl", "-d", "hi", "https://x"] });
});

test("refuses an empty command", () => {
  assert.deepEqual(expandNtfyCommand("   ", {}), { ok: false, error: "command is empty" });
});

test("requires the command to start with curl", () => {
  const result = expandNtfyCommand("wget https://x", {});
  assert.equal(result.ok, false);
  assert.match(result.error, /must start with curl/);
  assert.equal(expandNtfyCommand("/usr/bin/curl https://x", {}).ok, true);
});

test("refuses shell features", () => {
  const cases = [
    "curl https://x | sh",
    "curl https://x && echo hi",
    "curl https://x; echo hi",
    "curl -d \"$(whoami)\" https://x",
    "curl -d $TITLE https://x",
  ];
  for (const command of cases) {
    const result = expandNtfyCommand(command, { TITLE: "x" });
    assert.equal(result.ok, false, command);
  }
});

test("notifySessionComplete runs the expanded command", async () => {
  const { notifier, runs } = makeEnvironment({
    session: { sessionName: "My session", cwd: "/home/me/code/pi-web" },
    url: "https://pi.example.com/?session=sess-1",
  });

  await notifier.notifySessionComplete("sess-1");

  assert.deepEqual(runs, [
    ["curl", "-H", "Title: My session", "-d", NTFY_COMPLETION_MESSAGE, "https://ntfy.sh/my-topic"],
  ]);
});

test("does nothing when ntfy is disabled or the command is blank", async () => {
  const disabled = makeEnvironment({ settings: { ...ENABLED, enabled: false } });
  await disabled.notifier.notifySessionComplete("s");
  assert.equal(disabled.runs.length, 0);

  const blank = makeEnvironment({ settings: { ...ENABLED, command: "   " } });
  await blank.notifier.notifySessionComplete("s");
  assert.equal(blank.runs.length, 0);
});

test("a failing or invalid command never throws out of a completion", async () => {
  const errors = await captureErrors(async () => {
    const failing = makeEnvironment({ result: okResult({ ok: false, code: 7, stderr: "connect failed" }) });
    await failing.notifier.notifySessionComplete("s");

    const invalid = makeEnvironment({ settings: { enabled: true, command: "rm -rf /" } });
    await invalid.notifier.notifySessionComplete("s");
    assert.equal(invalid.runs.length, 0);
  });

  assert.equal(errors.length, 2);
  assert.match(errors[0], /exit 7/);
  assert.match(errors[1], /must start with curl/);
});

test("sendNtfyTest uses the test message and reports the failure", async () => {
  const runs = [];
  const ok = await sendNtfyTest(ENABLED, async (argv) => {
    runs.push(argv);
    return okResult();
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(runs[0], [
    "curl",
    "-H",
    `Title: ${NTFY_FALLBACK_TITLE}`,
    "-d",
    NTFY_TEST_MESSAGE,
    "https://ntfy.sh/my-topic",
  ]);

  const failed = await sendNtfyTest(ENABLED, async () =>
    okResult({ ok: false, code: 7, stderr: "couldn't connect" }));
  assert.equal(failed.ok, false);
  assert.match(failed.error, /exit 7/);
  assert.match(failed.error, /couldn't connect/);

  const invalid = await sendNtfyTest({ enabled: true, command: "not-curl" }, async () => {
    throw new Error("should not run");
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /must start with curl/);
});

test("persists ntfy settings and preserves other pi-web.json fields", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-ntfy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const settingsPath = join(root, "agent", "pi-web.json");
  await mkdir(join(root, "agent"), { recursive: true });
  await writeFile(settingsPath, JSON.stringify({ defaultProjectPath: "~/code" }));

  assert.deepEqual(readNtfySettings(settingsPath), defaultNtfySettings());

  writeNtfySettings(ENABLED, settingsPath);
  assert.deepEqual(readNtfySettings(settingsPath), ENABLED);
  assert.deepEqual(JSON.parse(await readFile(settingsPath, "utf8")), {
    defaultProjectPath: "~/code",
    ntfy: ENABLED,
  });
});

test("rejects a damaged pi-web.json", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-ntfy-bad-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const settingsPath = join(root, "pi-web.json");
  await writeFile(settingsPath, "{");
  assert.throws(() => readNtfySettings(settingsPath));
});
