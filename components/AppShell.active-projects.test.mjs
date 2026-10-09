import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");
const sidebarSource = await readFile(new URL("./SessionSidebar.tsx", import.meta.url), "utf8");

test("narrows the file-panel toggle so the project tabs get the width", () => {
  assert.match(source, /const FILE_PANEL_TOGGLE_SIZE = 28;/);
  assert.match(source, /width: FILE_PANEL_TOGGLE_SIZE, height: TOP_BAR_ICON_BUTTON_SIZE, padding: 0,/);
  // The auto margin moves with the strip: while tabs are rendered the toggle
  // must not push itself past them.
  assert.match(
    source,
    /marginLeft: !mobile && !sessionStats && !contextUsage && projectTabs\.length === 0 \? "auto" : 0,/,
  );
});

test("renders the active-project tabs ahead of the file-panel toggle in both top bars", () => {
  assert.match(source, /\{renderProjectTabs\(true\)\}\s+\{renderMainFileToggle\(true\)\}/);
  assert.match(source, /\{!isMobile && renderProjectTabs\(false\)\}\s+\{!isMobile && renderMainFileToggle\(false\)\}/);
});

test("lists running projects first and tops the strip up to three tabs", () => {
  assert.match(source, /import \{ getProjectTabs, getProjectActivity \} from "@\/lib\/project-groups";/);
  assert.match(
    source,
    /const projectTabs = useMemo\(\s+\(\) => getProjectTabs\(sessionsWithSelection, runningSessionIds, unreadSessionIds\),\s+\[sessionsWithSelection, runningSessionIds, unreadSessionIds\],\s+\);/,
  );
});

test("rounds the sidebar's unread markers into the top bar", () => {
  assert.match(sidebarSource, /onUnreadSessionIdsChange\?: \(ids: Set<string>\) => void;/);
  assert.match(
    sidebarSource,
    /useEffect\(\(\) => \{\s+onUnreadSessionIdsChange\?\.\(unreadSessionIds\);\s+\}, \[onUnreadSessionIdsChange, unreadSessionIds\]\);/,
  );
  assert.match(source, /onUnreadSessionIdsChange=\{handleUnreadSessionIdsChange\}/);
  assert.match(
    source,
    /const handleUnreadSessionIdsChange = useCallback\(\(ids: Set<string>\) => \{\s+setUnreadSessionIds\(\(previous\) => \{/,
  );
});

test("shows one initial per project on mobile and the name on desktop", () => {
  assert.match(source, /const name = getFileName\(project\.root\) \|\| project\.root;/);
  assert.match(source, /const label = mobile \? Array\.from\(name\)\[0\]\?\.toUpperCase\(\) \?\? "\?" : name;/);
  assert.match(source, /width: mobile \? 32 : undefined,/);
});

test("reuses the sidebar's project activity badge for the running ring", () => {
  assert.match(source, /import \{ SessionSidebar, showProjectActivity,[\s\S]*?\} from "\.\/SessionSidebar";/);
  assert.match(source, /import \{ getProjectTabs, getProjectActivity \} from "@\/lib\/project-groups";/);
  assert.match(
    source,
    /const projectActivity = useMemo\(\s+\(\) => getProjectActivity\(sessionsWithSelection, runningSessionIds, unreadSessionIds\),\s+\[sessionsWithSelection, runningSessionIds, unreadSessionIds\],\s+\);/,
  );
  // The third argument is the mobile flag: narrow chips keep the ring, drop the counts.
  assert.match(source, /\{showProjectActivity\(projectActivity\.get\(project\.key\), translate, mobile\)\}/);
  assert.match(sidebarSource, /export function showProjectActivity\(/);
  assert.match(sidebarSource, /  compact = false,/);
  assert.match(sidebarSource, /if \(compact && activity\.running === 0\) return null;/);
  assert.match(sidebarSource, /\{!compact && activity\.unread > 0 && \(/);
  assert.match(sidebarSource, /\{compact \? null : activity\.running\}/);
});

test("switching a project tab reuses handleCwdChange so the workspace's session returns", () => {
  assert.match(source, /if \(!isCurrent\) handleCwdChange\(project\.root, project\.root, project\.key\);/);
  assert.match(source, /aria-current=\{isCurrent \? "true" : undefined\}/);
  assert.match(source, /data-top-bar-project-tabs="true"/);
  assert.match(source, /data-project-tab=\{project\.key\}/);
});

test("hides the tab strip under the narrow-mobile action layer", () => {
  assert.match(
    source,
    /const covered = mobile && isNarrowMobile && mobileToolbarMoreOpen;\s+return \(\s+<div\s+role="group"/,
  );
  assert.match(
    source,
    /data-top-bar-project-tabs="true"[\s\S]*?pointerEvents: covered \? "none" : "auto",/,
  );
});
