/**
 * True when a host points at this machine's loopback interface.
 *
 * Shared by the server (which reads the request's `Host` header) and the
 * browser (which reads `window.location.host`), so both agree on whether the
 * OS file manager can be opened. Opening a window is a desktop action, so a
 * phone or another computer on the LAN must not raise windows on the host.
 * `Host` is client-controlled, which makes this a usability guard rather than
 * access control — the real boundaries stay the loopback bind and the
 * file-access allow-list.
 */
export function isLoopbackHost(host: string | null | undefined): boolean {
  if (!host) return false;
  let hostname = host.trim().toLowerCase();

  // An IPv6 literal keeps its brackets while a port is present: [::1]:30141.
  if (hostname.startsWith("[")) {
    const end = hostname.indexOf("]");
    if (end === -1) return false;
    hostname = hostname.slice(1, end);
  } else if ((hostname.match(/:/g) ?? []).length === 1) {
    // One colon means host:port. An unbracketed IPv6 literal has more, and its
    // last group must not be mistaken for a port.
    hostname = hostname.replace(/:\d+$/, "");
  }

  return hostname === "localhost"
    || hostname === "::1"
    || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}
