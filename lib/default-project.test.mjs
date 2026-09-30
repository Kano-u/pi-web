import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const {
  DEFAULT_PROJECT_BASE_TEMPLATE,
  defaultProjectBasePath,
  readDefaultProjectPath,
  resolveDefaultProjectBasePath,
  writeDefaultProjectPath,
} = await jiti.import("./default-project.ts");
const { defaultCwdPath } = await jiti.import("./default-cwd.ts");

const home = join(tmpdir(), "pi-web-home");

test("keeps the built-in project base next to upstream's dated default directory", () => {
  assert.equal(DEFAULT_PROJECT_BASE_TEMPLATE, "~/pi-cwd");
  assert.equal(
    defaultProjectBasePath(home),
    dirname(defaultCwdPath(new Date(2026, 8, 29, 7), home)),
  );
});

test("empty config resolves to the built-in project base", () => {
  assert.equal(resolveDefaultProjectBasePath("", { home }), join(home, "pi-cwd"));
  assert.equal(resolveDefaultProjectBasePath("   ", { home }), join(home, "pi-cwd"));
});

test("expands ~ and absolute project paths", () => {
  assert.equal(resolveDefaultProjectBasePath("~/code", { home }), join(home, "code"));
  assert.equal(
    resolveDefaultProjectBasePath(join(home, "fixed"), { home }),
    join(home, "fixed"),
  );
});

test("rejects relative paths and null bytes", () => {
  assert.throws(() => resolveDefaultProjectBasePath("relative/dir", { home }), /absolute path/);
  assert.throws(() => resolveDefaultProjectBasePath("~/bad\0path", { home }), /null bytes/);
});

test("persists a project path and preserves unrelated pi-web.json fields", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-default-project-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const settingsPath = join(root, "agent", "pi-web.json");
  await mkdir(join(root, "agent"), { recursive: true });
  await writeFile(settingsPath, JSON.stringify({ futureSetting: true }));

  assert.equal(readDefaultProjectPath(settingsPath), "");
  assert.equal(writeDefaultProjectPath("~/code", settingsPath, { home }), "~/code");
  assert.equal(readDefaultProjectPath(settingsPath), "~/code");
  assert.deepEqual(JSON.parse(await readFile(settingsPath, "utf8")), {
    futureSetting: true,
    defaultProjectPath: "~/code",
  });

  // Clearing it restores the built-in base without dropping other settings.
  assert.equal(writeDefaultProjectPath("  ", settingsPath, { home }), "");
  assert.equal(readDefaultProjectPath(settingsPath), "");
  assert.deepEqual(JSON.parse(await readFile(settingsPath, "utf8")), {
    futureSetting: true,
  });
});

test("does not create a settings file when clearing an unset path", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-default-project-empty-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const settingsPath = join(root, "missing", "pi-web.json");

  assert.equal(writeDefaultProjectPath("", settingsPath, { home }), "");
  await assert.rejects(readFile(settingsPath), { code: "ENOENT" });
});

test("rejects a damaged settings file without overwriting it", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-default-project-bad-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const settingsPath = join(root, "pi-web.json");
  await writeFile(settingsPath, "{");

  assert.throws(() => readDefaultProjectPath(settingsPath));
  assert.throws(() => writeDefaultProjectPath("~/code", settingsPath, { home }));
  assert.equal(await readFile(settingsPath, "utf8"), "{");
});
