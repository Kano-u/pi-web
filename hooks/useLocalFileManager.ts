"use client";

import { useSyncExternalStore } from "react";
import { isLoopbackHost } from "@/lib/loopback-host";

/**
 * Whether this browser may open a path in the OS file manager.
 *
 * The server gates `/api/open-folder` on the request's `Host` header, and a
 * same-origin browser sends exactly its own `window.location.host`, so the two
 * sides always agree. Controls that only work from the host machine (the
 * sidebar folder button, the reveal buttons) hide themselves when the page was
 * opened from another computer on the LAN instead of offering an action that
 * would end in a 403.
 *
 * The host cannot change during a page's life, so there is nothing to
 * subscribe to; `useSyncExternalStore` still gives a hydration-safe read.
 * The server snapshot assumes local because the server normally runs on this
 * machine, and the first client render re-checks the real host.
 */
export function useLocalFileManagerAvailable(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    getLocalFileManagerAvailability,
    getServerLocalFileManagerAvailability,
  );
}

function subscribeToNothing(): () => void {
  return () => {};
}

function getLocalFileManagerAvailability(): boolean {
  if (typeof window === "undefined") return false;
  return isLoopbackHost(window.location.host);
}

function getServerLocalFileManagerAvailability(): boolean {
  return true;
}
