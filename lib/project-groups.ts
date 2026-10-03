import type { SessionInfo } from "./types";
import { workspaceKeyOf } from "./workspace-memory";

export interface RecentProject {
  /** Stable server-provided identity used for comparison and Map keys. */
  key: string;
  /** Original project path used for display and filesystem operations. */
  root: string;
}

/** Projects sorted by most recent activity and deduplicated by stable key. */
export function getRecentProjects(sessions: readonly SessionInfo[]): RecentProject[] {
  const latestByProject = new Map<string, { root: string; modified: string }>();
  for (const session of sessions) {
    const root = session.projectRoot ?? session.cwd;
    if (!root) continue;
    const key = workspaceKeyOf(session);
    const previous = latestByProject.get(key);
    if (!previous || session.modified > previous.modified) {
      latestByProject.set(key, { root, modified: session.modified });
    }
  }
  return [...latestByProject.entries()]
    .sort((a, b) => b[1].modified.localeCompare(a[1].modified))
    .map(([key, { root }]) => ({ key, root }));
}

export function getProjectActivity(
  sessions: readonly SessionInfo[],
  runningSessionIds: ReadonlySet<string>,
  unreadSessionIds: ReadonlySet<string>,
): Map<string, { running: number; unread: number }> {
  const counts = new Map<string, { running: number; unread: number }>();
  for (const session of sessions) {
    const key = workspaceKeyOf(session);
    if (!key) continue;
    let entry = counts.get(key);
    if (!entry) {
      entry = { running: 0, unread: 0 };
      counts.set(key, entry);
    }
    if (runningSessionIds.has(session.id)) entry.running++;
    if (unreadSessionIds.has(session.id)) entry.unread++;
  }
  return counts;
}

/** How many top-bar project tabs the strip keeps even when nothing is running. */
export const MIN_PROJECT_TABS = 3;

/**
 * Projects for the top bar's tab strip, running ones first: a project with a
 * running agent outranks one with an unread completion, which outranks an idle
 * project. Each rank keeps `getRecentProjects` order (newest activity first), so
 * the strip matches the sidebar. Idle projects top the list up to `minimum`
 * tabs, so switching projects stays one click away even when nothing runs.
 */
export function getProjectTabs(
  sessions: readonly SessionInfo[],
  runningSessionIds: ReadonlySet<string>,
  unreadSessionIds: ReadonlySet<string>,
  minimum = MIN_PROJECT_TABS,
): RecentProject[] {
  const recent = getRecentProjects(sessions);
  const activity = getProjectActivity(sessions, runningSessionIds, unreadSessionIds);
  const rankOf = (project: RecentProject) => {
    const counts = activity.get(project.key);
    if (counts && counts.running > 0) return 0;
    if (counts && counts.unread > 0) return 1;
    return 2;
  };
  // Sorting the recency-ordered list by rank keeps recency order inside a rank
  // (Array.prototype.sort is stable) and keeps every busy project in the strip,
  // however long the list beyond the minimum.
  const ranked = [...recent].sort((a, b) => rankOf(a) - rankOf(b));
  const busy = ranked.filter((project) => rankOf(project) < 2).length;
  return ranked.slice(0, Math.max(minimum, busy));
}

export function sessionsForProject(
  sessions: readonly SessionInfo[],
  projectKey: string,
): SessionInfo[] {
  return sessions.filter((session) => workspaceKeyOf(session) === projectKey);
}
