import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  MAX_SLASH_COMMAND_FAVORITES,
  normalizeSlashCommandFavorites,
  readSlashCommandFavorites,
  writeSlashCommandFavorites,
} = await jiti.import("./slash-command-favorites.ts");

test("normalizes names: trims, strips a leading slash, drops blanks and duplicates", () => {
  assert.deepEqual(
    normalizeSlashCommandFavorites(["  compact ", "/review", "compact", "", "   ", 42, null, "review"]),
    ["compact", "review"],
  );
});

test("normalizes a non-array to an empty list", () => {
  assert.deepEqual(normalizeSlashCommandFavorites(undefined), []);
  assert.deepEqual(normalizeSlashCommandFavorites("compact"), []);
  assert.deepEqual(normalizeSlashCommandFavorites({ 0: "compact" }), []);
});

test("caps the list so a damaged file cannot bloat the composer", () => {
  const many = Array.from({ length: MAX_SLASH_COMMAND_FAVORITES + 25 }, (_, i) => `cmd-${i}`);
  const normalized = normalizeSlashCommandFavorites(many);
  assert.equal(normalized.length, MAX_SLASH_COMMAND_FAVORITES);
  assert.equal(normalized[0], "cmd-0");
  assert.equal(normalized.at(-1), `cmd-${MAX_SLASH_COMMAND_FAVORITES - 1}`);
});

test("a missing file reads as empty", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-favorites-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(readSlashCommandFavorites(join(root, "agent", "pi-web.json")), []);
});

test("persists marks and keeps unrelated pi-web.json fields", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-favorites-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const settingsPath = join(root, "agent", "pi-web.json");
  await mkdir(join(root, "agent"), { recursive: true });
  await writeFile(settingsPath, JSON.stringify({ defaultProjectPath: "~/code" }));

  assert.deepEqual(readSlashCommandFavorites(settingsPath), []);

  writeSlashCommandFavorites(["/compact", "review", "compact"], settingsPath);
  assert.deepEqual(readSlashCommandFavorites(settingsPath), ["compact", "review"]);
  assert.deepEqual(JSON.parse(await readFile(settingsPath, "utf8")), {
    defaultProjectPath: "~/code",
    slashCommandFavorites: ["compact", "review"],
  });

  // Clearing the list removes the key instead of leaving an empty array.
  writeSlashCommandFavorites([], settingsPath);
  assert.deepEqual(readSlashCommandFavorites(settingsPath), []);
  assert.deepEqual(JSON.parse(await readFile(settingsPath, "utf8")), { defaultProjectPath: "~/code" });
});

test("writing an empty list to a missing file creates nothing", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-favorites-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const settingsPath = join(root, "agent", "pi-web.json");
  assert.deepEqual(writeSlashCommandFavorites([], settingsPath), []);
  await assert.rejects(readFile(settingsPath, "utf8"));
});

test("a damaged pi-web.json is refused", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-favorites-bad-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const settingsPath = join(root, "pi-web.json");
  await writeFile(settingsPath, "{");
  assert.throws(() => readSlashCommandFavorites(settingsPath));

  await writeFile(settingsPath, JSON.stringify(["not", "an", "object"]));
  assert.throws(() => readSlashCommandFavorites(settingsPath), /expected an object/);
});
