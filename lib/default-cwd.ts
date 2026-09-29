import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { writePrivateFileAtomicSync } from "./atomic-file";

// "Use default directory" opens a fresh folder per day, ~/pi-cwd/<YYYYMMDD>.
// The date keeps a first-time user from landing in a folder that already holds
// their own data, and doubles as a daily scratch cwd.
export const DEFAULT_CWD_PARENT = "pi-cwd";
/** The configured form of the same location; `{date}` is the local calendar date. */
export const DEFAULT_CWD_TEMPLATE = `~/${DEFAULT_CWD_PARENT}/{date}`;
export const PI_WEB_SETTINGS_FILE = "pi-web.json";

type StoredPiWebSettings = Record<string, unknown> & {
  defaultCwd?: unknown;
};

export interface ResolveDefaultCwdOptions {
  home?: string;
  now?: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

export function getDefaultCwdSettingsPath(agentDir = getAgentDir()): string {
  return join(agentDir, PI_WEB_SETTINGS_FILE);
}

/** Local calendar date as YYYYMMDD, so the folder matches the user's "today". */
export function localDateStamp(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/** The built-in default directory, ~/pi-cwd/<YYYYMMDD>. */
export function defaultCwdPath(now = new Date(), home = homedir()): string {
  return join(home, DEFAULT_CWD_PARENT, localDateStamp(now));
}

export function expandUserPath(input: string, home = homedir()): string {
  const trimmed = input.trim();
  if (trimmed === "~") return home;
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return join(home, trimmed.slice(2));
  }
  return trimmed;
}

export function resolveDefaultCwdPath(
  configured: string,
  options: ResolveDefaultCwdOptions = {},
): string {
  const home = options.home ?? homedir();
  const date = localDateStamp(options.now);
  const trimmed = configured.trim();
  if (trimmed.includes("\0")) throw new Error("Default directory must not contain null bytes");

  const withDate = (trimmed || DEFAULT_CWD_TEMPLATE).replaceAll("{date}", date);
  const expanded = expandUserPath(withDate, home);
  if (!isAbsolute(expanded)) {
    throw new Error("Default directory must be an absolute path");
  }
  return resolve(expanded);
}

/**
 * 新建项目的落点。默认目录若以日期模板结尾（如 `~/pi-cwd/{date}`），它是按天生成的
 * 临时目录，项目应当与它同级；否则直接把配置的默认目录本身当作项目落点。
 */
export function resolveDefaultProjectBasePath(
  configured: string,
  options: ResolveDefaultCwdOptions = {},
): string {
  const resolved = resolveDefaultCwdPath(configured, options);
  const template = configured.trim() || DEFAULT_CWD_TEMPLATE;
  const lastSegment = template.split(/[\\/]/).pop() ?? "";
  return lastSegment.includes("{date}") ? dirname(resolved) : resolved;
}

function readStoredSettings(settingsPath: string): StoredPiWebSettings {
  if (!existsSync(settingsPath)) return {};
  const parsed: unknown = JSON.parse(readFileSync(settingsPath, "utf8"));
  if (!isRecord(parsed)) throw new Error("Invalid pi-web.json: expected an object");
  return parsed as StoredPiWebSettings;
}

export function readDefaultCwdPath(settingsPath = getDefaultCwdSettingsPath()): string {
  const stored = readStoredSettings(settingsPath).defaultCwd;
  if (stored === undefined) return "";
  if (typeof stored !== "string") throw new Error("Invalid pi-web.json: defaultCwd must be a string");
  return stored.trim();
}

export function writeDefaultCwdPath(
  path: string,
  settingsPath = getDefaultCwdSettingsPath(),
  options: ResolveDefaultCwdOptions = {},
): string {
  const next = path.trim();
  resolveDefaultCwdPath(next, options);

  const stored = existsSync(settingsPath) ? readStoredSettings(settingsPath) : {};
  if (next) stored.defaultCwd = next;
  else delete stored.defaultCwd;

  if (!next && Object.keys(stored).length === 0 && !existsSync(settingsPath)) return "";

  mkdirSync(dirname(settingsPath), { recursive: true });
  writePrivateFileAtomicSync(settingsPath, `${JSON.stringify(stored, null, 2)}\n`);
  return next;
}
