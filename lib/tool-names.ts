/**
 * Tool-name predicates shared by the chat views.
 *
 * Pi's built-in names are plain `write` / `edit`, but MCP servers expose the
 * same operations under prefixed or namespaced names, so each predicate also
 * accepts the common decorated forms.
 */

export function isWriteToolName(toolName: string): boolean {
  const name = toolName.toLowerCase();
  return name === "write" ||
    name.startsWith("write_") ||
    name.endsWith(".write") ||
    name.endsWith("_write");
}

export function isEditToolName(toolName: string): boolean {
  const name = toolName.toLowerCase();
  return name === "edit" ||
    name.startsWith("edit_") ||
    name.endsWith(".edit") ||
    name.endsWith("_edit") ||
    name.includes("str_replace") ||
    name.includes("replace_editor");
}

/** Codex-style patch tools (e.g. the pi-apply-patch extension). */
export function isApplyPatchToolName(toolName: string): boolean {
  const name = toolName.toLowerCase();
  return name === "apply_patch" ||
    name.startsWith("apply_patch_") ||
    name.endsWith(".apply_patch") ||
    name.endsWith("_apply_patch");
}

/**
 * Pi's two built-in shell tools. They are the only tools whose `timeout`
 * argument bounds how long the call may still run, so the chat views label a
 * running one with the limit it was given. Matched by exact name: a tool that
 * merely ends in `_bash` is not pi's shell tool and carries no such schema.
 */
export function isShellToolName(toolName: string): boolean {
  const name = toolName.toLowerCase();
  return name === "bash" || name === "powershell";
}

/**
 * The `timeout` argument (in seconds) a shell call was given, or null when
 * it has none. Pi rejects a non-positive or non-finite value before running
 * the command, so anything else is not a limit worth showing.
 */
export function getShellTimeout(input: unknown): number | null {
  if (!input || typeof input !== "object") return null;
  const timeout = (input as { timeout?: unknown }).timeout;
  return typeof timeout === "number" && Number.isFinite(timeout) && timeout > 0
    ? timeout
    : null;
}
