import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { writePrivateFileAtomicSync } from "./atomic-file";

/**
 * Where the sidebar's "New project" action creates its folder.
 *
 * This is a Pi Web addition and deliberately separate from `lib/default-cwd.ts`:
 * "Use default directory" keeps upstream's dated `~/pi-cwd/<YYYYMMDD>` folder and
 * its `/api/cwd/validate` flow untouched, while this setting only decides where
 * project folders live. It is stored in `~/.pi/agent/pi-web.json`.
 */
export const PI_WEB_SETTINGS_FILE = "pi-web.json";

/** Display form of the built-in project base, used as the settings placeholder. */
export const DEFAULT_PROJECT_BASE_TEMPLATE = "~/pi-cwd";

type StoredPiWebSettings = Record<string, unknown> & {
  defaultProjectPath?: unknown;
};

export interface ResolveProjectBaseOptions {
  home?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

export function getPiWebSettingsPath(agentDir = getAgentDir()): string {
  return join(agentDir, PI_WEB_SETTINGS_FILE);
}

/**
 * The built-in project base, `~/pi-cwd`. It is upstream's scratch-folder parent,
 * so projects land next to the folder "Use default directory" opens; a unit test
 * keeps the two in step.
 */
export function defaultProjectBasePath(home = homedir()): string {
  return join(home, "pi-cwd");
}

export function expandUserPath(input: string, home = homedir()): string {
  const trimmed = input.trim();
  if (trimmed === "~") return home;
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return join(home, trimmed.slice(2));
  }
  return trimmed;
}

export function resolveDefaultProjectBasePath(
  configured: string,
  options: ResolveProjectBaseOptions = {},
): string {
  const home = options.home ?? homedir();
  const trimmed = configured.trim();
  if (trimmed.includes("\0")) throw new Error("Default project directory must not contain null bytes");
  if (!trimmed) return defaultProjectBasePath(home);

  const expanded = expandUserPath(trimmed, home);
  if (!isAbsolute(expanded)) {
    throw new Error("Default project directory must be an absolute path");
  }
  return resolve(expanded);
}

function readStoredSettings(settingsPath: string): StoredPiWebSettings {
  if (!existsSync(settingsPath)) return {};
  const parsed: unknown = JSON.parse(readFileSync(settingsPath, "utf8"));
  if (!isRecord(parsed)) throw new Error("Invalid pi-web.json: expected an object");
  return parsed as StoredPiWebSettings;
}

export function readDefaultProjectPath(settingsPath = getPiWebSettingsPath()): string {
  const stored = readStoredSettings(settingsPath).defaultProjectPath;
  if (stored === undefined) return "";
  if (typeof stored !== "string") throw new Error("Invalid pi-web.json: defaultProjectPath must be a string");
  return stored.trim();
}

/** Empty restores the built-in `~/pi-cwd`; unrelated pi-web.json fields survive. */
export function writeDefaultProjectPath(
  path: string,
  settingsPath = getPiWebSettingsPath(),
  options: ResolveProjectBaseOptions = {},
): string {
  const next = path.trim();
  resolveDefaultProjectBasePath(next, options);

  const stored = existsSync(settingsPath) ? readStoredSettings(settingsPath) : {};
  if (next) stored.defaultProjectPath = next;
  else delete stored.defaultProjectPath;

  if (!next && Object.keys(stored).length === 0 && !existsSync(settingsPath)) return "";

  mkdirSync(dirname(settingsPath), { recursive: true });
  writePrivateFileAtomicSync(settingsPath, `${JSON.stringify(stored, null, 2)}\n`);
  return next;
}
