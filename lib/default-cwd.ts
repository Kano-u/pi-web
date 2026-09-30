import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { writePrivateFileAtomicSync } from "./atomic-file";

export const DEFAULT_CWD_TEMPLATE = "~/pi-cwd-{date}";
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

export function defaultCwdDateStamp(now = new Date()): string {
  return now.toISOString().slice(0, 10).replace(/-/g, "");
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
  const date = defaultCwdDateStamp(options.now);
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
 * 新建项目的落点。默认目录若以日期模板结尾（如 `~/pi-cwd-{date}`），它是按天生成的
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
