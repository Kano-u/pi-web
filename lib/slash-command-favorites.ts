import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { writePrivateFileAtomicSync } from "./atomic-file";
import { getPiWebSettingsPath } from "./default-project";

/**
 * Marked slash commands ("favorites"), stored in `~/.pi/agent/pi-web.json`.
 *
 * The composer's `+` quick-pick button lists these; a command's palette card
 * toggles one. A mark is keyed by command name only (not by source), so the
 * stored value is a plain list of names. This module never runs a command and
 * never touches the command registry — it only owns the stored list.
 */

/** A damaged file must not be able to bloat the composer with an endless list. */
export const MAX_SLASH_COMMAND_FAVORITES = 100;


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

/**
 * Keep only usable names: strings, trimmed, non-empty, deduped in first-seen
 * order, and capped. Anything malformed is dropped rather than throwing, so a
 * hand-edited `pi-web.json` cannot break the composer.
 */
export function normalizeSlashCommandFavorites(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const entry of input) {
    if (typeof entry !== "string") continue;
    const name = entry.trim().replace(/^\/+/, "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= MAX_SLASH_COMMAND_FAVORITES) break;
  }
  return names;
}

function readRawSettings(settingsPath: string): Record<string, unknown> {
  if (!existsSync(settingsPath)) return {};
  const parsed: unknown = JSON.parse(readFileSync(settingsPath, "utf8"));
  if (!isRecord(parsed)) throw new Error("Invalid pi-web.json: expected an object");
  return parsed;
}

/** Read the stored marks; a missing or damaged field falls back to an empty list. */
export function readSlashCommandFavorites(
  settingsPath = getPiWebSettingsPath(),
): string[] {
  const raw = readRawSettings(settingsPath);
  return normalizeSlashCommandFavorites(raw.slashCommandFavorites);
}

/** Write the marks, keeping every unrelated `pi-web.json` field intact. */
export function writeSlashCommandFavorites(
  input: unknown,
  settingsPath = getPiWebSettingsPath(),
): string[] {
  const favorites = normalizeSlashCommandFavorites(input);
  const stored = readRawSettings(settingsPath);
  if (favorites.length > 0) stored.slashCommandFavorites = favorites;
  else delete stored.slashCommandFavorites;

  if (favorites.length === 0 && Object.keys(stored).length === 0 && !existsSync(settingsPath)) {
    return favorites;
  }

  mkdirSync(dirname(settingsPath), { recursive: true });
  writePrivateFileAtomicSync(settingsPath, `${JSON.stringify(stored, null, 2)}\n`);
  return favorites;
}
