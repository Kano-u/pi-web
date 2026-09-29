import { dirname } from "path";

/** Platform command that opens a folder in the OS file manager. */
export interface OpenFolderCommand {
  command: string;
  args: string[];
}

/**
 * Build the launch command for opening `target` in the platform's file
 * manager (Windows Explorer / macOS Finder / xdg-open). The target is passed
 * through untouched as a single argument — callers hand in an already
 * `resolve()`d absolute path, and spawning without a shell keeps spaces and
 * metacharacters inert.
 */
export function openFolderCommand(
  target: string,
  platform: NodeJS.Platform = process.platform,
): OpenFolderCommand {
  if (platform === "win32") return { command: "explorer.exe", args: [target] };
  if (platform === "darwin") return { command: "open", args: [target] };
  return { command: "xdg-open", args: [target] };
}

/**
 * Build the launch command that reveals a file inside its parent folder in the
 * platform's file manager. Windows Explorer selects the entry with
 * `/select,<path>` (a single argument — Explorer splits on the first comma),
 * Finder uses `open -R`. xdg-open has no portable "select this entry" flag, so
 * the containing folder is opened instead.
 */
export function revealFileCommand(
  target: string,
  platform: NodeJS.Platform = process.platform,
): OpenFolderCommand {
  if (platform === "win32") return { command: "explorer.exe", args: [`/select,${target}`] };
  if (platform === "darwin") return { command: "open", args: ["-R", target] };
  return { command: "xdg-open", args: [dirname(target)] };
}

export { isLoopbackHost } from "./loopback-host";
