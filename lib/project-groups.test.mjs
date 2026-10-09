import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { projectIdentityKey } = await jiti.import("./project-identity.ts");
const {
  getProjectActivity,
  getProjectTabs,
  getRecentProjects,
} = await jiti.import("./project-groups.ts");

function session(id, projectRoot, modified) {
  return {
    id,
    path: `${id}.jsonl`,
    cwd: projectRoot,
    projectRoot,
    projectKey: projectIdentityKey(projectRoot, "win32"),
    created: modified,
    modified,
    messageCount: 1,
    firstMessage: id,
  };
}

test("Windows path variants form one recent project using the newest display path", () => {
  const older = session("older", "C:\\Users\\Alex\\Project\\Study\\ELM", "2026-08-12T00:00:00.000Z");
  const newer = session("newer", "c:/users/ALEX/project/study/elm", "2026-08-13T00:00:00.000Z");

  assert.deepEqual(getRecentProjects([older, newer]), [{
    key: older.projectKey,
    root: newer.projectRoot,
  }]);
});

test("running and unread counts aggregate under the stable project identity", () => {
  const first = session("first", "C:\\Users\\Alex\\Project", "2026-08-12T00:00:00.000Z");
  const second = session("second", "c:/users/alex/project/", "2026-08-13T00:00:00.000Z");

  const activity = getProjectActivity(
    [first, second],
    new Set(["first", "second"]),
    new Set(["second"]),
  );

  assert.deepEqual(activity.get(first.projectKey), { running: 2, unread: 1 });
  assert.equal(activity.size, 1);
});

test("project tabs list running projects newest activity first", () => {
  const older = session("older", "C:\\Users\\Alex\\Blog", "2026-08-12T00:00:00.000Z");
  const newer = session("newer", "D:\\Work\\Api", "2026-08-13T00:00:00.000Z");
  const idle = session("idle", "D:\\Work\\Idle", "2026-08-14T00:00:00.000Z");

  assert.deepEqual(
    getProjectTabs([older, newer, idle], new Set(["older", "newer"]), new Set()),
    [
      { key: newer.projectKey, root: newer.projectRoot },
      { key: older.projectKey, root: older.projectRoot },
      { key: idle.projectKey, root: idle.projectRoot },
    ],
  );
});

test("an unread completion ranks below a running project and above an idle one", () => {
  const idleOlder = session("idle", "D:\\Work\\Idle", "2026-08-11T00:00:00.000Z");
  const unreadMiddle = session("unread", "D:\\Work\\Api", "2026-08-12T00:00:00.000Z");
  const runningNewer = session("running", "D:\\Work\\Other", "2026-08-13T00:00:00.000Z");

  assert.deepEqual(
    getProjectTabs([idleOlder, unreadMiddle, runningNewer], new Set(["running"]), new Set(["unread"])),
    [
      { key: runningNewer.projectKey, root: runningNewer.projectRoot },
      { key: unreadMiddle.projectKey, root: unreadMiddle.projectRoot },
      { key: idleOlder.projectKey, root: idleOlder.projectRoot },
    ],
  );
});

test("idle projects top the tab strip up to the minimum", () => {
  const oldest = session("oldest", "D:\\Work\\A", "2026-08-11T00:00:00.000Z");
  const older = session("older", "D:\\Work\\B", "2026-08-12T00:00:00.000Z");
  const newer = session("newer", "D:\\Work\\C", "2026-08-13T00:00:00.000Z");
  const newest = session("newest", "D:\\Work\\D", "2026-08-14T00:00:00.000Z");

  assert.deepEqual(getProjectTabs([oldest, older, newer, newest], new Set(), new Set()), [
    { key: newest.projectKey, root: newest.projectRoot },
    { key: newer.projectKey, root: newer.projectRoot },
    { key: older.projectKey, root: older.projectRoot },
  ]);
});

test("every busy project stays in the strip past the minimum", () => {
  const running = ["one", "two", "three", "four"].map((name, index) =>
    session(name, `D:\\Work\\${name}`, `2026-08-1${index + 1}T00:00:00.000Z`));
  const idle = session("idle", "D:\\Work\\Idle", "2026-08-14T00:00:00.000Z");

  assert.deepEqual(
    getProjectTabs([...running, idle], new Set(running.map((item) => item.id)), new Set()),
    [...running].reverse().map((item) => ({ key: item.projectKey, root: item.projectRoot })),
  );
});

test("Windows path variants of one running project collapse into one entry", () => {
  const older = session("older", "C:\\Users\\Alex\\Project", "2026-08-12T00:00:00.000Z");
  const newer = session("newer", "c:/users/ALEX/project/", "2026-08-13T00:00:00.000Z");

  assert.deepEqual(getProjectTabs([older, newer], new Set(["older"]), new Set()), [
    { key: older.projectKey, root: newer.projectRoot },
  ]);
});
