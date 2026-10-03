import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { writePrivateFileAtomicSync } from "./atomic-file";
import { getPiWebSettingsPath } from "./default-project";
import { splitShellWords, type ShellWordsError } from "./shell-words";

/**
 * Server-side ntfy notifications, driven by a user-written `curl` command.
 *
 * Pi Web's two existing completion notifications both live in the browser
 * (`lib/web-push.ts` needs a registered push subscription, `lib/browser-notifications.ts`
 * needs the Notification permission and a hidden window). Here the user writes
 * one `curl` command with `{{…}}` placeholders; when a top-level session
 * finishes, Pi Web substitutes them and runs the command without a shell.
 * The setting is two fields (`enabled`, `command`) in `~/.pi/agent/pi-web.json`.
 */

/** Title used when a session has no name; also the test notification's title. */
export const NTFY_FALLBACK_TITLE = "Pi Web";
export const NTFY_COMPLETION_MESSAGE = "任务已完成。";
export const NTFY_TEST_MESSAGE = "这是一条来自 Pi Web 的测试通知。";

/** A hung command must not hold a finished session open. */
export const NTFY_TIMEOUT_MS = 15_000;

/** Refuse absurdly long commands before splitting them. */
const MAX_COMMAND_LENGTH = 8_000;
const MAX_OUTPUT_CHARS = 4_000;

export interface NtfySettings {
  enabled: boolean;
  /** A `curl …` command whose `{{…}}` placeholders are substituted at send time. */
  command: string;
}

export { NTFY_COMMAND_EXAMPLES, NTFY_VARIABLES } from "./ntfy-templates";
export type { NtfyCommandExample, NtfyVariable } from "./ntfy-templates";

export interface NtfyNotificationContext {
  sessionId: string;
  sessionName?: string;
  cwd?: string;
  event?: string;
  url?: string;
  /** Overrides the completion body; the test notification uses it. */
  message?: string;
  now?: Date;
}

export interface NtfyCommandResult {
  ok: boolean;
  /** Exit code when the process exited, else null (spawn error or timeout). */
  code: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

export type NtfyCommandRunner = (argv: string[]) => Promise<NtfyCommandResult>;

export interface NtfyEnvironment {
  readSettings: () => NtfySettings;
  resolveSession: (sessionId: string) => Promise<{ sessionName?: string; cwd?: string }>;
  resolveUrl: (sessionId: string) => string;
  runCommand: NtfyCommandRunner;
}

export interface NtfyNotifier {
  notifySessionComplete: (sessionId: string) => Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

export function defaultNtfySettings(): NtfySettings {
  return { enabled: false, command: "" };
}

function readRawSettings(settingsPath: string): Record<string, unknown> {
  if (!existsSync(settingsPath)) return {};
  const parsed: unknown = JSON.parse(readFileSync(settingsPath, "utf8"));
  if (!isRecord(parsed)) throw new Error("Invalid pi-web.json: expected an object");
  return parsed;
}

export function normalizeNtfySettings(input: Partial<NtfySettings>): NtfySettings {
  return {
    enabled: input.enabled === true,
    command: typeof input.command === "string" ? input.command : "",
  };
}

/** Read the stored ntfy block; a missing or damaged block falls back to the defaults. */
export function readNtfySettings(settingsPath = getPiWebSettingsPath()): NtfySettings {
  const raw = readRawSettings(settingsPath).ntfy;
  if (!isRecord(raw)) return defaultNtfySettings();
  return { enabled: raw.enabled === true, command: typeof raw.command === "string" ? raw.command : "" };
}

/** Write the ntfy block, keeping every unrelated `pi-web.json` field intact. */
export function writeNtfySettings(
  input: Partial<NtfySettings>,
  settingsPath = getPiWebSettingsPath(),
): NtfySettings {
  const settings = normalizeNtfySettings(input);
  const stored = readRawSettings(settingsPath);
  stored.ntfy = settings;
  mkdirSync(dirname(settingsPath), { recursive: true });
  writePrivateFileAtomicSync(settingsPath, `${JSON.stringify(stored, null, 2)}\n`);
  return settings;
}

/** Escape a value for the inside of a JSON string (`{{title_json}}`). */
export function jsonEscapeNtfyValue(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

export function buildNtfyVariables(context: NtfyNotificationContext): Record<string, string> {
  const title = context.sessionName?.trim() || NTFY_FALLBACK_TITLE;
  const message = context.message ?? NTFY_COMPLETION_MESSAGE;
  const cwd = context.cwd ?? "";
  return {
    title,
    message,
    session: context.sessionId,
    project: cwd ? basename(cwd) : "",
    cwd,
    event: context.event ?? "complete",
    url: context.url ?? "",
    time: (context.now ?? new Date()).toISOString(),
    title_json: jsonEscapeNtfyValue(title),
    message_json: jsonEscapeNtfyValue(message),
  };
}

function describeShellWordsError(error: ShellWordsError): string {
  switch (error.code) {
    case "shell-operator":
      return `shell operator "${error.operator}" is not supported`;
    case "command-substitution":
      return `command substitution "${error.syntax}" is not supported`;
    case "multiple-commands":
      return "only one command is allowed";
    case "shell-parameter":
      return `shell parameter "${error.parameter}" is not supported`;
    case "unsupported-expansion":
      return `parameter expansion "${error.expansion}" is not supported`;
    case "unterminated-quote":
      return `unterminated ${error.quote === "'" ? "single" : "double"} quote`;
  }
}

const VARIABLE_PATTERN = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

/**
 * Turn the user's command into an argv list, substituting `{{name}}` after the
 * split so an inserted value can never be re-parsed as shell syntax. Refuses a
 * command that is empty, not `curl`, uses shell features, or uses `$VARIABLE`
 * (only `{{…}}` is expanded).
 */
export function expandNtfyCommand(
  command: string,
  variables: Record<string, string>,
): { ok: true; argv: string[] } | { ok: false; error: string } {
  const trimmed = command.trim();
  if (!trimmed) return { ok: false, error: "command is empty" };
  if (trimmed.length > MAX_COMMAND_LENGTH) return { ok: false, error: "command is too long" };

  const split = splitShellWords(trimmed);
  if (!split.ok) return { ok: false, error: describeShellWordsError(split.error) };

  const argv: string[] = [];
  for (const word of split.words) {
    if (word.parts.some((part) => part.type === "variable")) {
      return { ok: false, error: "shell variables are not supported; use {{…}} placeholders" };
    }
    argv.push(word.text.replace(VARIABLE_PATTERN, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : match));
  }
  if (argv.length === 0) return { ok: false, error: "command is empty" };

  const executable = argv[0].split(/[\\/]/).pop() ?? argv[0];
  if (!/^curl(\.exe)?$/i.test(executable)) {
    return { ok: false, error: `command must start with curl, got "${executable}"` };
  }
  return { ok: true, argv };
}

function truncateOutput(value: string): string {
  return value.length > MAX_OUTPUT_CHARS ? `${value.slice(0, MAX_OUTPUT_CHARS)}…` : value;
}

/**
 * Run the parsed argv without a shell. Never rejects; the caller decides what a
 * non-zero exit means. The returned fields never contain the command line, so a
 * token in the command does not leak into a log.
 */
export function runNtfyCommand(argv: string[]): Promise<NtfyCommandResult> {
  return new Promise((resolve) => {
    execFile(
      argv[0],
      argv.slice(1),
      { timeout: NTFY_TIMEOUT_MS, maxBuffer: 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        const out = truncateOutput(stdout ?? "");
        const err = truncateOutput(stderr ?? "");
        if (!error) {
          resolve({ ok: true, code: 0, signal: null, timedOut: false, stdout: out, stderr: err });
          return;
        }
        const killed = (error as { killed?: unknown }).killed === true;
        const signal = typeof (error as { signal?: unknown }).signal === "string"
          ? (error as { signal: string }).signal
          : null;
        const code = typeof (error as { code?: unknown }).code === "number"
          ? (error as { code: number }).code
          : null;
        resolve({ ok: false, code, signal, timedOut: killed && code === null, stdout: out, stderr: err });
      },
    );
  });
}

export function createNtfyNotifier(environment: NtfyEnvironment): NtfyNotifier {
  return {
    async notifySessionComplete(sessionId) {
      let settings: NtfySettings;
      try {
        settings = environment.readSettings();
      } catch (error) {
        console.error(`[pi-web] failed to read ntfy settings: ${error instanceof Error ? error.message : error}`);
        return;
      }
      if (!settings.enabled || !settings.command.trim()) return;

      let session: { sessionName?: string; cwd?: string } = {};
      try {
        session = await environment.resolveSession(sessionId);
      } catch {
        // Session metadata is best-effort; the command can fall back to {{session}}.
      }

      const expanded = expandNtfyCommand(settings.command, buildNtfyVariables({
        sessionId,
        sessionName: session.sessionName,
        cwd: session.cwd,
        url: environment.resolveUrl(sessionId),
      }));
      if (!expanded.ok) {
        console.error(`[pi-web] ntfy command is invalid: ${expanded.error}`);
        return;
      }

      const result = await environment.runCommand(expanded.argv);
      if (!result.ok) {
        const reason = result.timedOut ? "timed out" : `exit ${result.code ?? result.signal ?? "unknown"}`;
        console.error(`[pi-web] ntfy command failed: ${reason}`);
      }
    },
  };
}

/**
 * Run the stored command once with test values so the settings panel can report
 * the exit status. The expanded argv is never returned (it may hold a token).
 */
export async function sendNtfyTest(
  settings: NtfySettings,
  runCommand: NtfyCommandRunner = runNtfyCommand,
): Promise<{ ok: boolean; error?: string }> {
  const expanded = expandNtfyCommand(settings.command, buildNtfyVariables({
    sessionId: "test",
    sessionName: NTFY_FALLBACK_TITLE,
    event: "test",
    message: NTFY_TEST_MESSAGE,
  }));
  if (!expanded.ok) return { ok: false, error: expanded.error };

  const result = await runCommand(expanded.argv);
  if (result.ok) return { ok: true };
  const reason = result.timedOut ? "timed out" : `exit ${result.code ?? result.signal ?? "unknown"}`;
  const detail = result.stderr.trim();
  return { ok: false, error: detail ? `${reason}: ${detail}` : reason };
}

async function resolveSession(sessionId: string): Promise<{ sessionName?: string; cwd?: string }> {
  try {
    for (const session of await SessionManager.listAll()) {
      if (session.id === sessionId) return { sessionName: session.name, cwd: session.cwd };
    }
  } catch {
    // Session list is best-effort.
  }
  return {};
}

/** `<PI_WEB_PUBLIC_URL>/?session=<id>`, or an empty string when the variable is unset. */
function resolveSessionUrl(sessionId: string): string {
  const base = process.env.PI_WEB_PUBLIC_URL?.trim();
  if (!base) return "";
  return `${base.replace(/\/+$/, "")}/?session=${encodeURIComponent(sessionId)}`;
}

function getDefaultEnvironment(): NtfyEnvironment {
  return {
    readSettings: () => readNtfySettings(),
    resolveSession,
    resolveUrl: resolveSessionUrl,
    runCommand: runNtfyCommand,
  };
}

declare global {
  var __piWebNtfyNotifier: NtfyNotifier | undefined;
}

function getNotifier(): NtfyNotifier {
  if (!globalThis.__piWebNtfyNotifier) {
    globalThis.__piWebNtfyNotifier = createNtfyNotifier(getDefaultEnvironment());
  }
  return globalThis.__piWebNtfyNotifier;
}

export async function notifyNtfySessionComplete(sessionId: string): Promise<void> {
  await getNotifier().notifySessionComplete(sessionId);
}
