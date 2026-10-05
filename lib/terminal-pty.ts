import type { IPty } from "node-pty";

// The PTY module depends on the runtime. node-pty's native addon does not work
// under Bun (the shell exits immediately and prints nothing), while bun-pty is
// Bun-only: its entry loads bun:ffi and dlopen()s its library as soon as the
// module is imported, so it can never be loaded under Node. Keep the choice in
// this one file so the rest of the terminal stack stays runtime-agnostic.

export const PTY_BACKEND_ENV = "PI_WEB_TERMINAL_BACKEND";

export type PtyModuleName = "node-pty" | "bun-pty";

export interface PtySpawnOptions {
  name: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface PtyModule {
  spawn(file: string, args: string[], options: PtySpawnOptions): IPty;
}

export function isBunRuntime(globalObject: unknown = globalThis): boolean {
  return typeof (globalObject as { Bun?: unknown }).Bun !== "undefined";
}

/** `auto` (the default) picks bun-pty under Bun and node-pty everywhere else. */
export function ptyModuleName(inBun: boolean, override = process.env[PTY_BACKEND_ENV]): PtyModuleName {
  if (override === "node-pty" || override === "bun-pty") return override;
  return inBun ? "bun-pty" : "node-pty";
}

function loadErrorMessage(name: PtyModuleName, error: unknown): string {
  const original = error instanceof Error ? error.message : String(error);
  if (name === "bun-pty") {
    return "Cannot load the bun-pty terminal module. Pi Web is running on Bun, which needs the optional " +
      "bun-pty package. In the pi-web installation directory (the npx cache directory when using npx), run: " +
      "bun add bun-pty (or npm install bun-pty). If the prebuilt library is missing for this platform, set " +
      "BUN_PTY_LIB to the path of librust_pty.so / librust_pty.dylib / rust_pty.dll. " +
      `Then restart pi-web. Original error: ${original}`;
  }
  return `Cannot load the node-pty native terminal module for ${process.platform}-${process.arch}. ` +
    "The binary may be missing or incompatible. In the pi-web installation directory " +
    "(the npx cache directory when using npx), run: npm rebuild node-pty --build-from-source --ignore-scripts=false --foreground-scripts. " +
    "On Debian/Ubuntu, install build tools first: sudo apt-get install -y python3 build-essential. " +
    `Then restart pi-web. Original error: ${original}`;
}

type BuiltinModuleAccess = {
  getBuiltinModule?: (id: "module") => { createRequire?: (path: string) => NodeRequire } | undefined;
};

/**
 * Resolves `bun-pty` through the runtime's own require. A bundler replaces an
 * `import`/`require` of `node:module` with an emulation that only sees modules
 * already in the graph, and `bun-pty` can never be one: its package entry is a
 * `.ts` file (`serverExternalPackages` refuses it for exactly that reason) and
 * it loads `bun:ffi` plus a native library that is `dlopen`ed at runtime.
 * `process.getBuiltinModule` is an ordinary property read, so nothing rewrites
 * it and the name it is given never reaches a bundler either.
 */
function loadBunPty(): PtyModule {
  const requireFrom = (process as unknown as BuiltinModuleAccess).getBuiltinModule?.("module")?.createRequire;
  if (typeof requireFrom !== "function") {
    throw new Error("process.getBuiltinModule('module').createRequire is unavailable");
  }
  // `__filename` is the emitted server chunk and `process.cwd()` covers a start
  // from elsewhere; both walk up to the pi-web install's node_modules.
  const bases = [typeof __filename === "string" ? __filename : undefined, `${process.cwd()}/pi-web-terminal.cjs`];
  let lastError: unknown;
  for (const base of bases) {
    if (!base) continue;
    try {
      return requireFrom(base)("bun-pty") as PtyModule;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Cannot find module 'bun-pty'");
}

/**
 * Loads the runtime's PTY module. Called inside terminal creation so native
 * module failures reach the API's JSON error handler instead of crashing.
 */
export function loadPtyModule(): PtyModule {
  const name = ptyModuleName(isBunRuntime());
  try {
    if (name === "bun-pty") return loadBunPty();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("node-pty") as PtyModule;
  } catch (error) {
    throw new Error(loadErrorMessage(name, error), { cause: error });
  }
}
