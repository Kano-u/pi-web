/**
 * Client-safe ntfy command metadata.
 *
 * Kept apart from `lib/ntfy.ts`, which imports `node:child_process`, `node:fs`
 * and the pi SDK, so the settings panel can render the placeholder chips and the
 * help without pulling server-only code into the browser bundle. `lib/ntfy.ts`
 * re-exports these for its own helpers and the unit test.
 */

/** One `{{name}}` placeholder; the settings help and the insert buttons share this list. */
export interface NtfyVariable {
  name: string;
  example: string;
}

export const NTFY_VARIABLES: readonly NtfyVariable[] = [
  { name: "title", example: "my-session" },
  { name: "message", example: "Task finished." },
  { name: "session", example: "a1b2c3d4" },
  { name: "project", example: "pi-web" },
  { name: "cwd", example: "/home/me/code/pi-web" },
  { name: "event", example: "complete" },
  { name: "url", example: "https://pi.example.com/?session=a1b2c3d4" },
  { name: "time", example: "2025-01-01T00:00:00.000Z" },
  { name: "title_json", example: "my-session" },
  { name: "message_json", example: "Task finished." },
];

/** Ready-made commands the settings help offers with a "fill" button. */
export interface NtfyCommandExample {
  /** i18n key for the example's label. */
  labelKey: string;
  command: string;
}

export const NTFY_COMMAND_EXAMPLES: readonly NtfyCommandExample[] = [
  {
    labelKey: "settings.ntfyExampleBasic",
    command: "curl -H 'Title: {{title}}' -d '{{message}}' https://ntfy.sh/my-topic",
  },
  {
    labelKey: "settings.ntfyExampleToken",
    command: "curl -H 'Authorization: Bearer tk_REPLACE_ME' -H 'Title: {{title}}' -d '{{message}}' https://ntfy.example.com/my-topic",
  },
  {
    labelKey: "settings.ntfyExampleJson",
    command: "curl -H 'Content-Type: application/json' -d '{\"topic\":\"my-topic\",\"title\":\"{{title_json}}\",\"message\":\"{{message_json}}\",\"priority\":4}' https://ntfy.sh/",
  },
  {
    labelKey: "settings.ntfyExampleClick",
    command: "curl -H 'Content-Type: application/json' -d '{\"topic\":\"my-topic\",\"title\":\"{{title_json}}\",\"message\":\"{{message_json}}\",\"click\":\"{{url}}\"}' https://ntfy.sh/",
  },
];
