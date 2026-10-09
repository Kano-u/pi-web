import type { ReactNode } from "react";

/**
 * Small stroke icons for the session sidebar: rows, group headers, menus and
 * the files tab. One 24 grid, stroked with `currentColor`, so the parent's
 * color (muted, dim, accent, danger) decides how they look. Decorative by
 * default (`aria-hidden`); pass `label` when the icon is the only thing that
 * says what it means (the running spinner in a row's status slot).
 *
 * Fork-only exception: `NewSessionIcon` (the toolbar's New session cell) is
 * filled rather than stroked and keeps its own 16-unit box, because the glyph
 * is the reader's — see its own note at the end of the file.
 */
export interface SidebarIconProps {
  /** Rendered width and height in px. */
  size?: number;
  className?: string;
  /** Accessible name; makes the icon an image instead of decoration. */
  label?: string;
}

function SidebarIcon({ size = 13, className, label, strokeWidth = 2, children }: SidebarIconProps & { strokeWidth?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {children}
    </svg>
  );
}

export function PlusIcon(props: SidebarIconProps) {
  return <SidebarIcon {...props}><path d="M12 5v14M5 12h14" /></SidebarIcon>;
}

/** Horizontal dots: the "⋯" of a row or group. */
export function MoreIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </SidebarIcon>
  );
}

export function ArchiveIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </SidebarIcon>
  );
}

export function RestoreIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </SidebarIcon>
  );
}

export function PinIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M12 17v5" />
      <path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9a2 2 0 0 1-1.1-1.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </SidebarIcon>
  );
}

export function PinOffIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M12 17v5" />
      <path d="M15 9.3V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8.5" />
      <path d="m2 2 20 20" />
      <path d="M9 9v1.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h11" />
    </SidebarIcon>
  );
}

/** Points right; a class on it turns it down for an expanded section. */
export function ChevronIcon(props: SidebarIconProps) {
  return <SidebarIcon {...props}><path d="m9 6 6 6-6 6" /></SidebarIcon>;
}

export function BranchIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </SidebarIcon>
  );
}

/** Two branches from one stem: a row's "Fork" (BranchIcon stands for a worktree's branch). */
export function ForkIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="12" cy="19" r="2.5" />
      <path d="M6 7.5v1.5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7.5" />
      <path d="M12 12v4.5" />
    </SidebarIcon>
  );
}

export function TrashIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M3 6h18" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </SidebarIcon>
  );
}

export function PencilIcon(props: SidebarIconProps) {
  return <SidebarIcon {...props}><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></SidebarIcon>;
}

/** Filled dot: "mark as unread". */
export function DotIcon(props: SidebarIconProps) {
  return <SidebarIcon {...props}><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" /></SidebarIcon>;
}

/** Hollow dot: "mark as read". */
export function DotOutlineIcon(props: SidebarIconProps) {
  return <SidebarIcon {...props}><circle cx="12" cy="12" r="4.5" /></SidebarIcon>;
}

export function CheckIcon(props: SidebarIconProps) {
  return <SidebarIcon {...props}><path d="M20 6 9 17l-5-5" /></SidebarIcon>;
}

export function CloseIcon(props: SidebarIconProps) {
  return <SidebarIcon {...props}><path d="M18 6 6 18M6 6l12 12" /></SidebarIcon>;
}

export function FolderIcon(props: SidebarIconProps) {
  return <SidebarIcon {...props}><path d="M3 8a2 2 0 0 1 2-2h3.4l1.9 1.9H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></SidebarIcon>;
}

export function FolderPlusIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M3 8a2 2 0 0 1 2-2h3.4l1.9 1.9H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M12 11v5M9.5 13.5h5" />
    </SidebarIcon>
  );
}

/** Fork-only: the files tab's New file button (upstream has no file-plus icon). */
export function FilePlusIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M14 3v5h5" />
      <path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M12 11v6" />
      <path d="M9 14h6" />
    </SidebarIcon>
  );
}

export function TerminalIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </SidebarIcon>
  );
}

export function SearchIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </SidebarIcon>
  );
}

export function UploadIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </SidebarIcon>
  );
}

export function RefreshIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </SidebarIcon>
  );
}

/** Git changes: a commit on a line. */
export function ChangesIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M3 12h6M15 12h6" />
    </SidebarIcon>
  );
}

/** What the file tree lists: the files tab's ignored-files switch. */
export function EyeIcon(props: SidebarIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </SidebarIcon>
  );
}

export function MessageIcon(props: SidebarIconProps) {
  return <SidebarIcon {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></SidebarIcon>;
}

/**
 * The running-agent spinner. It turns through the `sidebar-spin` class
 * (app/sidebar-menu.css), which stands still under prefers-reduced-motion.
 */
export function SpinnerIcon({ className, ...props }: SidebarIconProps) {
  return (
    <SidebarIcon {...props} strokeWidth={2.8} className={className ? `sidebar-spin ${className}` : "sidebar-spin"}>
      <path d="M21 12a9 9 0 1 1-3.8-7.4" />
    </SidebarIcon>
  );
}

/**
 * Fork-only: the toolbar's New session cell. Unlike everything above it is
 * filled, not stroked, and keeps its own 16 unit box: the glyph is the shape
 * the fork's reader copied out of the developer tools — a ring with a plus in
 * it and a bubble's tail at its lower left — drawn from `currentColor`, so the
 * cell's muted/dim/accent state still decides how it looks. Hence it does not
 * go through `SidebarIcon`, whose 24 grid and `stroke="currentColor"` would
 * draw this same path as a hollow outline.
 */
export function NewSessionIcon({ size = 13, className, label }: SidebarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <path d="M8 0.599609C3.91309 0.599609 0.599609 3.91309 0.599609 8C0.599609 9.13376 0.855461 10.2098 1.3125 11.1719L1.5918 11.7588L2.76562 11.2012L2.48633 10.6143C2.11034 9.82278 1.90039 8.93675 1.90039 8C1.90039 4.63106 4.63106 1.90039 8 1.90039C11.3689 1.90039 14.0996 4.63106 14.0996 8C14.0996 11.3689 11.3689 14.0996 8 14.0996C7.31041 14.0996 6.80528 14.0514 6.35742 13.9277C5.91623 13.8059 5.49768 13.6021 4.99707 13.2529C4.26492 12.7422 3.21611 12.5616 2.35156 13.1074L2.33789 13.1162L2.32422 13.126L1.58789 13.6436L2.01953 14.9297L3.0459 14.207C3.36351 14.0065 3.83838 14.0294 4.25293 14.3184C4.84547 14.7317 5.39743 15.011 6.01172 15.1807C6.61947 15.3485 7.25549 15.4004 8 15.4004C12.0869 15.4004 15.4004 12.0869 15.4004 8C15.4004 3.91309 12.0869 0.599609 8 0.599609ZM7.34473 4.93945V7.34961H4.93945V8.65039H7.34473V11.0605H8.64551V8.65039H11.0605V7.34961H8.64551V4.93945H7.34473Z" />
    </svg>
  );
}
