# Pi Web - Development Notes

## Project Purpose & Upstream Sync

This checkout is a thin fork of upstream Pi Web. Its purpose is to **stay as close to upstream as possible while making small additions or removals of features**. Keep changes minimal and localized: do not restructure upstream code, and follow upstream conventions so future syncs stay trivial. The `demo/` directory is a synced copy of the UI and is intentionally left untouched until a sync brings changes over.

Upstream PR decisions live in `PRS.md`, written by `scripts/prs.sh` (`sync` / `list` / `show` / `take` / `drop` / `mark`). It is a divergence ledger, not a history: it lists only the PRs where we differ from upstream, so a PR that is merged upstream and already synced with us loses its row instead of being kept as a record.

The reasoning behind the fork-only entries below lives in [docs/agents/fork.md](docs/agents/fork.md), a file upstream never touches. Upstream's own topic notes live in `docs/agents/` and are listed at the end of this file.

### Known failing test (intentionally kept)

`npm test` comes out at 2489 tests / 2487 pass / 1 fail / 1 skipped in ~20s (upstream's count plus the fork-only `lib/terminal-pty.test.mjs`). The single failure is environment-induced rather than a regression, and is deliberately left alone to keep the fork aligned with upstream: `lib/skill-lock.test.mjs`'s "uses the CLI global lock location" passes `xdgStateHome: undefined` to mean "no XDG variable", but a default parameter re-reads `process.env.XDG_STATE_HOME`, which this shell exports. `env -u XDG_STATE_HOME node --experimental-strip-types --test lib/skill-lock.test.mjs` passes 4/4. The one skip is upstream's Windows-only `lib/linked-directory.test.mjs` "allows a Windows junction after its target is explicitly allowed"; the `lib/file-archives.test.mjs` archive tests add two more skips when `bsdtar` is missing (`sudo apt install libarchive-tools`). Anything else that fails is a real regression.

### Fork-only additions (not in upstream)

Unlike `demo/`, these exist only in this fork. A sync can never bring them in, but it can conflict with them, and `PRS.md` records the PR-level reason where a PR is behind one. Keep this list current: a fork-only file that is not named here is one a future sync cannot reason about.

- **Explorer file management (`#899`)** — create, rename, delete, touch, mkdir, download, in-place edit, extract and compress. `lib/file-mutations.ts` (name validation, real-parent resolution, the allow-root-checked create/rename/delete/write paths), `lib/file-archives.ts` + `lib/archive-names.ts` (bsdtar extract and zip), the mutation branch of `POST /api/files/[...path]`, and the context menu, inline rename and inline create rows of `components/FileExplorer.tsx`, the editor in `components/FileViewer.tsx`, and the `onFileMutated` refresh wiring in `components/AppShell.tsx`. Upstream closed the PR as out of a thin frontend's scope, so `PRS.md` keeps its row.
- **New project directory setting (`#892`)** — `lib/default-project.ts` and `GET`/`PUT`/`POST /api/default-project` own `defaultProjectPath` in `~/.pi/agent/pi-web.json`; the sidebar's "New project" entry, `components/NewProjectDialog.tsx` and the *Default project directory* field in `components/SettingsPanel.tsx` (with `app/settings.css`) drive it. It layers on upstream's dated `/api/default-cwd` and never touches that route.
- **Directory picker sorting** — `mtimeMs` on `BrowsableDirectoryEntry` in `lib/directory-browser.ts`, the sort buttons in `components/DirectoryPicker.tsx`, and the custom-path entry point in `components/SessionSidebar.tsx`.
- **Explorer "show ignored files" toggle** — `FileTreeVisibilityOptions.includeIgnored` in `lib/file-tree-visibility.ts` (returns everything but `.git` / `.DS_Store` before any Git call), the `includeIgnored=1` parameter of `GET /api/files/[...path]?type=list`, `loadExplorerShowIgnored` / `saveExplorerShowIgnored` + the `pi-web:file-explorer:show-ignored` key in `lib/file-explorer-state.ts`, the toolbar button and the `includeIgnored` plumbing in `components/FileExplorer.tsx`, and the `files.showIgnoredFiles` / `files.hideIgnoredFiles` keys in the three locales. Upstream hides ignored entries unconditionally; `/api/file-index` and the access allow-list are unchanged.
- **Active project tabs** — `getProjectTabs()` + `MIN_PROJECT_TABS = 3` in `lib/project-groups.ts` (running projects first, then unread, then the most recent, at least three), the top-bar strip in `components/AppShell.tsx` (with `FILE_PANEL_TOGGLE_SIZE = 28` on the file-panel toggle), `onUnreadSessionIdsChange` and the exported `showProjectActivity` badge (with its `compact` ring-only mode) on `components/SessionSidebar.tsx`, the `projects.active` / `projects.switchTo` keys in the three locales, and `components/AppShell.active-projects.test.mjs`.
- **Shell call timeout badge** — `lib/duration-format.ts` (labels a whole number of seconds as `57s` / `1m 30s` / `2m` / `1h 5m`, plus `remainingTimeoutSeconds` clamped to `[0, timeout]`) and `isShellToolName` + `getShellTimeout` in `lib/tool-names.ts`; `components/ShellTimeoutBadge.tsx` counts the time a running `bash` / `powershell` call has left before its `timeout`, in the slot that later holds the elapsed duration, and `ToolCallBlock` in the upstream-synced `components/MessageView.tsx` only passes it that call's start time (the assistant message's `timestamp`, via `BlockView`) and keeps the elapsed-duration rendering. The badge is fork-only and lives in its own file so `MessageView.tsx` gains no state, effect or interval — the countdown's 1s tick is there, stopped once it reaches 0. Pi streams a running shell tool's output as a partial result that carries no timestamp, and the elapsed duration is derived from that timestamp, so `!result?.timestamp` is what marks the call unfinished (upstream renders that duration as a plain `{duration}s`). The countdown starts from the message timestamp rather than the tool's real start, so it can reach 0 a few seconds before pi kills the command, which is why the zero state is the `chat.toolTimeoutEnding` key (`terminating soon` / `即将终止` / `即將終止`) in all three locales instead of a `0s`; the running value itself carries no words — `chat.toolTimeout` is gone. Badge text is the card's warning red (`#f87171`, the same colour an erroring tool name gets) in every state: the countdown, the full limit shown while the message still streams, and the zero state.
- **Thinking block title, click target, tail follow, expansion memory and height cap** — the fork's tweaks to upstream's `ThinkingBlock`: a handful of style objects and one prop in the upstream-synced `components/MessageView.tsx`, one class in `app/globals.css`, and the fork-only `components/ThinkingBody.tsx` that owns the expanded body plus `lib/thinking-expansion-state.ts`, which remembers the reader's own expansion. A bold `{t("i18n.thinking")}` title beside the bulb; the duration label moved inside the toggle button so the whole header line is one click target (upstream's button is icon-width when expanded, `width: expanded ? 14 : "100%"`, so only the bulb collapsed it), held at the right edge by the preview's `flex: 1` when collapsed and by the title's `flexGrow: expanded ? 1 : 0` when expanded; the expanded body moved below the header row (`flexDirection: "column"` card) instead of beside the icon, where it left a blank strip under the icon and title on every wrapped line; the expansion survives the remounts that recreate the block (the streaming message is re-rendered from `messages` after `message_end` and re-keyed twice, so upstream's plain `useState` collapsed a block the reader had just opened) by recording the reader's choice outside React and seeding the state from it, keyed by the block's index inside its message and guarded by the block's own text opening — its first line, the shape `getThinkingPreview` gives a committed block, since `lib/session-reader.ts` replaces a saved block's text with that preview — because a thinking block has no `toolCallId` to key on; the turn's process section is kept open for that reader too (`openedProcess = hasOpenedThinking(finalProcessBlocks)` feeds the group's own `rememberedOpen` prop in `components/ChatWindow.tsx`, which opens it from a layout effect so upstream's `defaultExpanded` and re-key expressions stay untouched), because it re-keys on answer availability and otherwise remounts collapsed, hiding the card outright; and that body pinned to the tail while the message streams — `components/ThinkingBody.tsx` sets `scrollTop = scrollHeight` on every streaming render, but only while the reader is still following, per upstream's tested `getLiveFollowAttached` (the call `ChatWindow` already makes for the chat scroller), which detaches on a real upward scroll and re-attaches near the tail — a bare `isScrollAtTail` test came first and silently killed the follow once the growing content first overflowed. `.thinking-block-content` caps that body at `calc(50dvh - 14px)`, or `calc(33.3333dvh - 14px)` under the `(max-width: 640px)` breakpoint (`hooks/useIsMobile.ts`), with `overflow-y: auto` and the same scroll conventions as `.extension-widget-panels`; the 14px is the card's 6px vertical padding plus its 1px borders, so the whole card stays within the fraction. `MessageView.tsx` gains no `useIsMobile`, state or effect beyond seeding that memory and recording the reader's own toggle (the follow lives in the fork-only component), and `components/ThinkingBody.test.mjs` pins the class, the follow call and the `isStreaming` wiring, while `lib/thinking-expansion-state.test.mjs` pins the memory and `components/ChatWindow.process-group.test.mjs` the process-section wiring; the title, the click target and the body placement are pinned by nothing, so a sync that restores upstream's `ThinkingBlock` drops them silently — re-apply from `docs/agents/fork.md`.
- **ntfy notifications** — `lib/ntfy.ts` + client-safe `lib/ntfy-templates.ts` (a two-field setting, `enabled` + a user-written `curl` command with `{{…}}` placeholders, stored in `~/.pi/agent/pi-web.json` with the same read-modify-write as `defaultProjectPath`; the command is parsed by upstream's `splitShellWords`, substituted after the split, and run with no shell) plus `app/api/ntfy/route.ts` (GET/PUT settings, POST test run), the command box / `{{…}}` chips / collapsible help in `components/SettingsPanel.tsx` (with `app/settings.css`), `lib/api-types.ts`'s `NtfySettingsResponse`/`NtfyTestResponse`, and the `settings.ntfy*` keys in the three locales. `lib/rpc-manager.ts` gains one import and one call beside upstream's push call in `onAgentRunComplete`. Running server-side keeps it independent of the completion sound and the browser Notification permission.
- **Slash-command favorites** — `lib/slash-command-favorites.ts` owns `normalizeSlashCommandFavorites` / `readSlashCommandFavorites` / `writeSlashCommandFavorites` and `MAX_SLASH_COMMAND_FAVORITES = 100`, storing a name-keyed `string[]` under `slashCommandFavorites` in `~/.pi/agent/pi-web.json`; `GET`/`PUT app/api/slash-command-favorites/route.ts` guard with `isApiRequestAllowed` / `hasJsonContentType`; `lib/api-types.ts` adds `SlashCommandFavoritesResponse`; `lib/slash-command-favorites.test.mjs` pins it. In `components/ChatInput.tsx` each `/` palette card gets a top-right ★/☆ toggle (the card sits in a `position: relative` wrapper, since a `<button>` cannot nest), a `+` button between the image and model controls opens a names-only quick-pick panel whose rows send `handleSend("/name")` immediately, and the `chat.slashFavorite*` keys are in all three locales. Fork-only: upstream has no per-card marking and no quick-pick.
- **Bun terminal backend (bun-pty)** — `lib/terminal-pty.ts` (`isBunRuntime`, `ptyModuleName`, `loadPtyModule`, and the `PI_WEB_TERMINAL_BACKEND` override) swaps node-pty for the optional `bun-pty` module under Bun; `lib/terminal-manager.ts` only calls `loadPtyModule()`, `package.json` carries `bun-pty` in `optionalDependencies` (resolved at runtime through `process.getBuiltinModule("module")`'s `createRequire`, since the bundler can neither externalize nor bundle it), `lib/terminal-pty.test.mjs` pins the selector, and `e2e/terminal-bun.mjs` runs the terminal end-to-end on a Bun dev server.
- **Fork docs, ledger and checkout hygiene** — `PRS.md` + `scripts/prs.sh` (the divergence ledger introduced above), `README.YouMustRead.md`, the `#899` file tools the four `README*.md` files advertise, and `.gitattributes` (`* text=auto eol=lf`), which pins the working copy to LF so newline-sensitive comparisons stay stable in every checkout.

---

## Quick Start

```bash
npm run dev   # port 30141
```

Typecheck: `node_modules/.bin/tsc --noEmit` · Lint: `npm run lint`

**Never run `next build` during dev**: it pollutes `.next/` and breaks `npm run dev`.

### Running on Bun (fork)

`npm run dev:bun` / `npm run build:bun` / `npm run start:bun` run the Next CLI on Bun (`bun node_modules/next/dist/bin/next …`). Everything a normal session does works — pages, sessions, SSE, model lists, extension loading — and both halves of the production path were measured: `build:bun` finished in 50s (webpack 26s, TypeScript 11.4s) with only the `sessions/[id]/export` critical-dependency warning webpack also reports under Node, and `bun bin/pi-web.js -p 30145` then served every route with `/` in 88ms. Three Bun-runtime notes are worth keeping in mind:

- **Never add Bun flags to those scripts (`--no-install` especially).** Bun puts its own startup flags into `process.execArgv`, and Next forwards execArgv to the `node` processes Turbopack spawns for CSS and webpack loaders as `NODE_OPTIONS`. A flag Node does not know stops that child from starting (`node: --no-install is not allowed in NODE_OPTIONS`), Turbopack panics inside `evaluate_webpack_loader`, and `GET /` answers 500 after a multi-minute stall while every API route keeps working. Disabling auto-install is not worth that; see below for why it is not needed.
- **The terminal runs on bun-pty, not node-pty.** Bun cannot use node-pty: the PTY exits immediately with code 1 and emits zero bytes (measured through `lib/terminal-manager.ts`: Node delivered 569 bytes and echoed the marker command, Bun delivered 0 bytes and `{"type":"exit","exitCode":1}`; the same node-pty binary is fine under Node). `lib/terminal-pty.ts` picks the module — `bun-pty` under Bun, `node-pty` under Node — and `PI_WEB_TERMINAL_BACKEND=node-pty|bun-pty` overrides that guess. `bun-pty` is an optional dependency whose prebuilt `librust_pty` library ships inside its tarball (point `BUN_PTY_LIB` at it when a platform build is missing), and it is resolved at runtime: a plain `require` makes the bundler resolve and then fail on the package's `.ts` entry (which 500s every route), and a `createRequire` imported from `node:module` is emulated with a module-map stub that throws `Cannot find module 'bun-pty'` in a production `bin/pi-web.js` run, so `lib/terminal-pty.ts` takes the real `createRequire` from `process.getBuiltinModule("module")` and resolves from `__filename`, falling back to `process.cwd()`. `e2e/terminal-bun.mjs` exercises the shell against a Bun dev server.
- Bun's auto-install can pull a package into `~/.bun/install/cache` when an installed extension resolves a host package (`@earendil-works/pi-coding-agent`) natively instead of through the SDK's jiti aliases; that copy then fails on its own `@earendil-works/pi-ai/compat` import. Observed once: a 2.1-minute `/api/models` and an `unhandledRejection`, with every extension still loading. Ordinary toggles were 3.6s on a cold start, so it is left alone until it repeats.

### Dev server troubleshooting

- First run `lsof -nP -iTCP:30141 -sTCP:LISTEN` and reuse a healthy Pi Web process. A second `next dev` on another port is no workaround: both contend for `.next/dev/lock`.
- A browser-only `Module ... factory is not available` overlay usually means that tab has a stale Turbopack/HMR graph, not a broken server or source. Use the browser's explicit reload, then compare the server log and a direct HTTP/API request.
- Restart only when the failure reproduces from a fresh page and the server-side checks fail too: stop that exact dev process gracefully, move `.next` into a `mktemp -d` backup, restart with `npm run dev`.
- Never fall back to `next dev --webpack`: the dev graph can fail on `undici` imports such as `node:console`. Development uses Turbopack.
- `next dev` may append a generated `BEGIN:nextjs-agent-rules` block to `AGENTS.md`. It is tooling output: check `git status` and keep it out of unrelated commits.

---

## Architecture

- **Browsing** (read-only, no AgentSession): `GET /api/sessions` lists `~/.pi/agent/sessions/`; `GET /api/sessions/[id]` reads the `.jsonl` through SDK `SessionManager` helpers and `lib/session-reader.ts`, or an open wrapper's in-memory `SessionManager`. `GET /api/agent/running` snapshots the running ids.
- **Sending**: `POST /api/agent/[id]` → `startRpcSession()` (`lib/rpc-manager.ts`) creates the AgentSession in-process (`createAgentSessionFromServices()`); `session.send(cmd)` → `session.prompt()`.
- **Events**: `GET /api/agent/[id]/events` streams SSE `data: {...}` from `session.onEvent()`, fed by `session.subscribe()`.
- **Extension compatibility (principle)**: extensions written for the pi CLI must behave the same here. Fix display problems in the web client; never add pi-web-only options or fields to the extension API (`ctx.ui.*` options, `extension_ui_request`). pi's TUI (`node_modules/@earendil-works/pi-tui`) is the reference for what an extension asking for something means.

---

## File Map

```
app/api/
  sessions/route.ts                GET list all sessions
  sessions/[id]/route.ts           GET/PATCH/DELETE a session
  sessions/[id]/context/route.ts   GET ?leafId=&tail=&before= a page of a leaf's context (tail defaults to 50; before pages upward)
  sessions/[id]/export/route.ts    GET exported HTML
  sessions/[id]/state/route.ts     GET live wrapper state while running
  sessions/[id]/auto-name/route.ts POST generate a session title
  sessions/search/route.ts         GET session search
  agent/new/route.ts               POST { cwd, type: prompt|ensure_session (start only), message?, toolNames?, provider?, modelId?, thinkingLevel? }
  agent/[id]/route.ts              GET state | POST any command
  agent/[id]/events/route.ts       GET SSE stream
  agent/running/route.ts           GET running session ids
  auth/api-key/[provider]/route.ts POST/DELETE stored provider API key
  auth/login/[provider]/route.ts   GET OAuth/device-code SSE | POST manual code
  auth/logout/[provider]/route.ts  POST OAuth logout
  auth/providers/route.ts          GET OAuth and API-key provider lists
  cwd/validate/route.ts            POST validate/select a cwd
  cwd/browse/route.ts              GET browse any readable directory for the cwd picker | POST create child directory
  default-cwd/route.ts             POST create ~/pi-cwd/YYYYMMDD (local date)
  home/route.ts                    GET user home directory
  open-in-explorer/route.ts        GET availability | POST open a cwd in the OS file manager (loopback only)
  files/[...path]/route.ts         GET ?type=list|read|download|meta|preview|watch | POST ?type=upload|upload-check|allow-link
  file-index/route.ts              GET file list for @-mentions
  git/status/route.ts              GET changed files for a cwd
  git/diff/route.ts                GET diff of one changed file
  worktrees/route.ts               GET/POST/DELETE git worktrees
  terminal/route.ts                POST create a terminal session
  terminal/[id]/route.ts           GET { id, cwd } (404 once closed; stream at [id]/events) | POST input/resize | DELETE kill
  mcp/route.ts                     GET [?cwd=] Settings › MCP overview, files only | POST add/enable/disable/remove/undo/set-enabled/set-exposure/sign-out
  mcp/test/route.ts                POST { scope, name, cwd? } test one server once (entry read from its file)
  mcp/sign-in/route.ts             POST { scope, name, cwd? } start or join an OAuth sign-in
  mcp/sign-in/[flowId]/route.ts    GET flow state (polled) | POST { redirectUrl } | DELETE cancel
  project-trust/route.ts           GET trust status + project .pi/mcp.json servers (files only) | POST trust, rebuild the cwd's wrappers
  tools/settings/route.ts          GET/PUT defaultTools switches: PowerShell (Windows), Code mode automatic/always; codemode.mode, codemode.inlineBudget
  models/route.ts                  GET ?cwd= { models, modelList, defaultModel, … }
  models/enabled/route.ts          GET/PUT enabledModels switches
  models/default/route.ts          PUT default model / reasoning level for new sessions
  models/refresh/route.ts          POST fetch provider catalogs from pi.dev on demand
  models-config/route.ts           GET/PUT ~/.pi/agent/models.json
  models-config/catalog/route.ts   GET models.dev pricing presets
  models-config/discover/route.ts  POST fetch a configured provider's upstream model list
  models-config/test/route.ts      POST test a configured model/provider
  plugins/route.ts                 GET/POST package plugin management
  plugins/check/route.ts           POST check plugin package updates
  skills/route.ts                  GET/PATCH loaded skills, disable-model-invocation
  skills/install/route.ts          POST install skills via npx skills add
  skills/search/route.ts           POST skills.sh search
  subagents/settings/route.ts      GET/PUT built-in subagent switch and maxConcurrent
  web-auth/route.ts                GET status | POST login | DELETE logout (browser password)
  provider-usage/query/route.ts    POST provider usage quotas
  push/config/route.ts             GET VAPID public key
  push/subscribe/route.ts          POST register a push subscription
  app-update/route.ts              GET current vs latest published pi-web version

lib/
  agent-client.ts           typed fetch helper for /api/agent commands
  rpc-manager.ts            AgentSessionWrapper, registry, startRpcSession
  session-reader.ts         SessionManager wrappers, path cache, buildSessionContext adapter
  normalize.ts              normalizeToolCalls(): file-format vs our toolCall field names
  types.ts                  shared TypeScript types
  pi-types.ts               local structural types for pi SDK objects
  pi-sdk-internals.ts       loader for SDK modules the package does not export (MCP connection, config, OAuth)
  tool-presets.ts           PRESET_NONE/READ_ONLY/DEFAULT/FULL + getPresetFromTools()
  tool-preset-preference.ts browser-persisted default preset for fresh sessions
  builtin-extensions.ts     codemode / tool-search / mcp built-ins, sandbox self-test, -builtin: switches
  codemode-settings.ts      Code mode automatic/always (+codemode in global defaultTools), codemode.mode and inlineBudget; project overrides
  codemode-view.ts          display helpers for codemode cards
  global-settings-file.ts   locked read-modify-write of global settings.json (SettingsManager's lock)
  regular-file.ts           readRegularFileText(): non-blocking read of a regular file only, optional size cap
  default-preferences.ts    write defaultModel/defaultThinkingLevel; detect project shadowing
  deferred-provider-models.ts models of providers an extension registers only at session_start, re-added to listings
  enabled-models.ts         pure minimal-edit engine for the enabledModels pattern list
  enabled-models-runtime.ts SDK adapter for enabledModels: pattern resolution, provider kinds, settings IO
  subagent-settings.ts      read/write ~/.pi/agent/agents/settings.json
  subagent-skills.ts        a profile's skills: list preloaded into the child's prompt, and its exact system prompt
  file-access.ts            allowed file roots for /api/files and worktrees
  file-upload-client.ts     browser upload to /api/files ?type=upload, shared by the explorer and chat drops
  file-upload.ts            upload conflict strategies and the pre-upload check of an upload target (server)
  linked-directory.ts       directory links leading outside the allowed roots + the allow-link check
  file-paths.ts             client/server path encoding helpers
  file-tree-visibility.ts   which entries the file tree lists (git check-ignore, name-list fallback)
  display-path.ts           display-only ~ / ./ path shortening for settings panels
  default-cwd.ts            dated ~/pi-cwd/YYYYMMDD path for "Use default directory"
  worktree.ts               project/worktree resolution and git worktree operations
  draft-store.ts            local draft persistence
  extension-ui-queue.ts     FIFO queues for extension dialogs and custom panels, by request id
  extension-dialog-fit.ts   width an extension dialog needs so its code blocks and tables do not scroll sideways
  markdown.ts               shared markdown helpers
  gfm-autolink-email-loader.cjs  bundler loader: remark-gfm's email regex without a lookbehind literal
  node-cli.ts               locate bundled npm-cli.js / npx-cli.js to spawn npm/npx without a shell (Windows)
  npx.ts                    npx runner for skill install
  plugin-updates.ts         npm view update checks for /api/plugins/check
  jsonc.ts                  JSON with comments and trailing commas (models.json is read through it)
  shell-words.ts            split a pasted command line into words without a shell; refuses | && ; redirects $(…)
  key-serializer.ts         serializeByKey(): one globalThis promise chain per key
  stacked-dialog.ts         Escape and focus handling for Settings and dialogs stacked above it
  project-trust.ts          project trust status and decisions; fresh-folder trust-and-write
  mcp-host.ts               per-session MCP host: registers mcp.json servers before prompts, reports status
  mcp-transport.ts          MCP transport factory; stdio gets a sanitized env, never PI_WEB_PASSWORD
  mcp-command.ts            client-safe: who owns /mcp (built-in or another extension)
  mcp-read-only-policy.ts   read-only sessions block MCP tools without readOnlyHint (nested calls too)
  mcp-config-key.ts         canonicalJson() and mcpConfigKey(), the per-process HMAC statuses are keyed by
  mcp-config-values.ts      client-safe: the values pi resolves and the PI_WEB_PASSWORD rule
  mcp-config-read.ts        Settings › MCP reads of both mcp.json files; nothing resolved or run
  mcp-config-file.ts        the mcp.json writer: SDK editor's bytes, lock, atomic write, typed refusals
  mcp-json-error.ts         JSON.parse error messages that never quote the source
  mcp-undo.ts               removed mcp.json entries kept 60 s for undo; only a token reaches the browser
  mcp-status.ts             last known connection state per mcp.json entry (tests and sessions)
  mcp-test.ts               Settings › MCP Test: one bounded, masked SDK connection (sign-in reuses its steps)
  mcp-entry-request.ts      route checks before connecting one mcp.json entry (Test, sign-in); guards /api/mcp and /api/project-trust share
  mcp-sign-in.ts            Settings › MCP OAuth sign-in flows (as pi mcp login), polled by id
  mcp-sign-out.ts           OAuth store keys (name + URL); guard barring token writes by runs started before a sign-out
  mcp-secrets.ts            pure secret classification and masking for MCP config values
  mcp-add.ts                POST /api/mcp add's checks before it writes
  mcp-import.ts             pure paste importer (+ mcp-import-core/json/cli/links.ts)
  mcp-server-display.ts     client-safe display helpers for McpServerInfo (hidden-character escapes, labels)
  mcp-tool-display.ts       server/tool label of an mcp__ call from its result details, never the name

components/
  AppShell.tsx             layout, URL state, tab management
  SessionSidebar.tsx       session tree + FileExplorer
  ChatWindow.tsx           chat composition + completion sound
  ChatInput.tsx            input bar + model/thinking/tools/compact controls
  MessageView.tsx          one message (user/assistant/toolCall/toolResult)
  CodemodeToolView.tsx     codemode card: the tool calls its script made
  BranchNavigator.tsx      in-session branch switcher
  ChatMinimap.tsx          scroll minimap beside the message list
  MarkdownBody.tsx         markdown renderer
  ModelsConfig.tsx         Settings › Models: models.json editor
  EnabledModelsSection.tsx model switches inside ModelsConfig (enabledModels)
  OAuthPastePanel.tsx      paste box for a sign-in's redirected address or code (Models, MCP)
  ProjectTrustDialog.tsx   trust confirmation listing the project's MCP servers
  AgentsConfig.tsx         built-in subagent toggle + agent profile editor
  PluginsConfig.tsx        Settings › Plugins: installed package plugins
  SkillsConfig.tsx         Settings › Skills: loaded, search, install
  McpConfig.tsx            Settings › MCP: servers, switches, exposure, remove/undo, Test, sign-in, Code mode, trust
  mcp-config-helpers.ts    pure helpers and requests for McpConfig
  McpSignIn.tsx            a server's Sign-in row in Settings › MCP
  mcp-sign-in-helpers.ts   pure helpers and requests for McpSignIn
  McpAddServer.tsx         Settings › MCP add pane: paste, preview, values, name, scope
  mcp-add-helpers.ts       pure helpers and the add request for McpAddServer
  FileExplorer.tsx         file tree in the sidebar
  FileIcons.tsx            file icon helpers
  FileViewer.tsx           file content in a tab
  TabBar.tsx               file panel tab bar (file and terminal tabs)

hooks/
  useAgentSession.ts       messages, streaming, SSE, fork/navigate, reconciliation; built-in slash commands (/session, bare /mcp)
  useAudio.ts              completion sound + AudioContext unlock
  useDragDrop.ts           chat drop zone: dropped files, folders marked
  useIsMobile.ts           responsive breakpoint
  useKeyboardShortcuts.ts  Esc stops the running agent unless a field or nearer handler took it; Ctrl+Alt+N
  useTheme.ts              theme state
```

---

## Topic Notes

Design decisions and traps live in `docs/agents/`, one note per area. Read every note whose files a change touches before making it. Add new notes to the area's file, not here.

- [sessions.md](docs/agents/sessions.md): AgentSession lifecycle and shutdown, fork vs in-session branching, session file rewrites, toolCall normalization, SSE reconnect and tool events, transcript system / usage / context-edit entries, running-state polling, exported HTML, the extension status bar and its `command:` buttons. Files: `lib/rpc-manager.ts`, `lib/session-reader.ts`, `lib/normalize.ts`, `hooks/useAgentSession.ts`, `app/api/agent/**`, `app/api/sessions/**`, `components/AppShell.tsx`, `components/BranchNavigator.tsx`, `components/MessageView.tsx`, `components/CodemodeToolView.tsx`, `components/ExtensionStatusBar.tsx`, `components/ExtensionWidgets.tsx`.
- [tools.md](docs/agents/tools.md): tool presets and Chat only, exact system prompts, tool exposure, the codemode / tool-search / mcp built-ins, the read-only MCP policy, the Code mode and PowerShell `defaultTools` switches. Files: `lib/tool-presets.ts`, `lib/tool-preset-preference.ts`, `lib/chat-only.ts`, `lib/exact-system-prompt.ts`, `lib/builtin-extensions.ts`, `lib/mcp-read-only-policy.ts`, `lib/codemode-settings.ts`, `lib/powershell-settings.ts`, `lib/global-settings-file.ts`, `app/api/agent/new/route.ts`, `app/api/tools/settings/route.ts`, tool selection in `lib/rpc-manager.ts`.
- [mcp-runtime.md](docs/agents/mcp-runtime.md): the per-session MCP host (when servers register and connect, reported states, trust read on every sync, idle release); `/mcp` in the composer. Files: `lib/mcp-host.ts`, `lib/mcp-transport.ts`, `lib/mcp-status.ts`, `lib/mcp-command.ts`, `lib/mcp-config-key.ts`, MCP wiring in `lib/rpc-manager.ts` and `lib/builtin-extensions.ts`, `/mcp` handling in `hooks/useAgentSession.ts`.
- [mcp-settings.md](docs/agents/mcp-settings.md): Settings › MCP reads without running anything, masking, the trust dialog's server list, row states, notices, Code mode choice, trust from Settings, Escape stacking, every `mcp.json` write and undo. Files: `app/api/mcp/route.ts`, `app/api/project-trust/route.ts`, `lib/mcp-config-read.ts`, `lib/mcp-config-file.ts`, `lib/mcp-undo.ts`, `lib/mcp-secrets.ts`, `lib/mcp-server-display.ts`, `lib/mcp-json-error.ts`, `lib/project-trust.ts`, `lib/regular-file.ts`, `lib/stacked-dialog.ts`, `lib/settings-navigation.ts`, `components/McpConfig.tsx`, `components/mcp-config-helpers.ts`, `components/ProjectTrustDialog.tsx`, `components/SettingsPanel.tsx`.
- [mcp-test-sign-in.md](docs/agents/mcp-test-sign-in.md): Settings › MCP Test (route checks, bounded connection, `!command` queue, redaction, status store) and OAuth sign-in / sign-out. Files: `app/api/mcp/test/**`, `app/api/mcp/sign-in/**`, `lib/mcp-test.ts`, `lib/mcp-entry-request.ts`, `lib/mcp-status.ts`, `lib/mcp-sign-in.ts`, `lib/mcp-sign-out.ts`, `components/McpSignIn.tsx`, `components/mcp-sign-in-helpers.ts`, `components/OAuthPastePanel.tsx`.
- [mcp-add.md](docs/agents/mcp-add.md): Settings › MCP add (paste re-parsed on the server, host-variable confirmation, literal secrets kept global, fresh-folder trust, the add pane) and the paste importer's escaping and grammars. Files: `lib/mcp-add.ts`, `lib/mcp-import*.ts`, `lib/shell-words.ts`, fresh-folder trust in `lib/project-trust.ts`, `components/McpAddServer.tsx`, `components/mcp-add-helpers.ts`, the `add` action of `app/api/mcp/route.ts`.
- [models.md](docs/agents/models.md): default model and reasoning level, providers registered at session_start, mid-run reasoning changes, remote provider catalogs, `enabledModels` scoping and minimal edits, provider auth listing and credentials. Files: `app/api/models/**`, `app/api/models-config/**`, `app/api/auth/**`, `lib/default-preferences.ts`, `lib/model-scope.ts`, `lib/enabled-models*.ts`, `lib/model-catalog-refresh.ts`, `lib/deferred-provider-models.ts`, `lib/provider-listing*.ts`, `components/ModelsConfig.tsx`, `components/EnabledModelsSection.tsx`, `components/ModelSelector.tsx`, `components/SelectorRow.tsx`.
- [files-and-access.md](docs/agents/files-and-access.md): worktrees and project grouping, the file access allow-list (the `/api/files` security boundary), file tree visibility, uploads and chat file drops, web password throttling. Files: `app/api/files/**`, `app/api/cwd/**`, `app/api/worktrees/**`, `app/api/file-index/**`, `app/api/web-auth/**`, `proxy.ts`, `lib/path-security.ts`, `lib/file-access.ts`, `lib/linked-directory.ts`, `lib/session-file-references*.ts`, `lib/file-tree-visibility.ts`, `lib/file-upload-client.ts`, `lib/worktree.ts`, `lib/paths.ts`, `lib/auth-throttle.ts`, `components/FileExplorer.tsx`, `hooks/useDragDrop.ts`.
- [settings-ui.md](docs/agents/settings-ui.md): Plugins and Skills routes, sidebar group switches, the shared `SettingsUi` blocks every settings panel and add pane uses. Files: `app/api/plugins/**`, `app/api/skills/**`, `components/SettingsUi.tsx`, `components/settings-ui-helpers.ts`, `components/SkillsConfig.tsx`, `components/PluginsConfig.tsx`; also before adding a settings section or add pane.
- [subagents.md](docs/agents/subagents.md): the built-in subagent setting, profiles and their files, run status, completion notifications. Files: `lib/subagent*.ts`, `app/api/subagents/**`, `components/AgentsConfig.tsx`.
- [client-platform.md](docs/agents/client-platform.md): mobile software keyboard and viewport height, completion sound. Files: `hooks/useViewportHeight.ts`, `hooks/useAudio.ts`, the keyboard-open CSS.
- [fork.md](docs/agents/fork.md): fork-only design notes — the shell timeout badge, the thinking block's title / click target / tail follow / expansion memory / height cap, the New project layer, the directory picker's sort, the explorer's file management, the Bun terminal backend, and one sync-log entry per upstream sync with the conflicts it hit. Files: the fork-only ones named in `AGENTS.md`.

---

## Old Safari (iOS 16.2)

- `/` renders entirely on the client, so one script chunk the browser cannot parse is a blank page. Next 16 targets Safari 16.4+; the `browserslist` in `package.json` lowers Safari and iOS to 16.2 so SWC turns class `static {}` blocks into private static fields. That covers Next's client runtime; other node_modules keep their syntax unless listed in `transpilePackages` (mermaid and `@mermaid-js/parser` are, for their lazy diagram chunks). Keep the other browserslist entries at Next's defaults.
- Never write a RegExp lookbehind (`(?<=`, `(?<!`) in client code: SWC cannot downlevel it and Safari parses it only from 16.4. `lib/markdown.ts` emulates its leading lookbehinds with `replaceNotPrecededBy()`. A lookbehind built at runtime (`new RegExp("(?<=…)")` in `try`) fails only when run; that is how `lib/gfm-autolink-email-loader.cjs` fixes `mdast-util-gfm-autolink-literal`'s email regex. The loader is registered for webpack and Turbopack in `next.config.ts` and fails the build if that regex changes upstream.

## Pi Session File Format

Location: `~/.pi/agent/sessions/<encoded-cwd>/<timestamp>_<uuid>.jsonl`

```jsonl
{"type":"session","version":3,"id":"<uuid>","timestamp":"...","cwd":"/path","parentSession":"/abs/path/to/parent.jsonl"}
{"type":"model_change","id":"<8hex>","parentId":null,"provider":"zenmux","modelId":"claude-sonnet-4-6","timestamp":"..."}
{"type":"message","id":"<8hex>","parentId":"<8hex>","message":{"role":"user","content":"..."}}
{"type":"message","id":"<8hex>","parentId":"<8hex>","message":{"role":"assistant","content":[...],...}}
{"type":"message","id":"<8hex>","parentId":"<8hex>","message":{"role":"toolResult","toolCallId":"...","content":[...]}}
{"type":"compaction","id":"<8hex>","parentId":"<8hex>","summary":"...","firstKeptEntryId":"<8hex>","tokensBefore":N}
{"type":"session_info","id":"...","parentId":"...","name":"user-defined name"}
```

`SessionContext.entryIds[]` parallels `messages[]`: each displayed message's `.jsonl` entry id, used for fork and navigate_tree.

## CSS Variables (`app/globals.css`)

```
--bg --bg-panel --bg-hover --bg-selected --border
--text --text-muted --text-dim
--accent --user-bg --tool-bg
--font-mono
```
