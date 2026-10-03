import { NextResponse } from "next/server";
import type { NtfySettingsResponse, NtfyTestResponse } from "@/lib/api-types";
import {
  expandNtfyCommand,
  normalizeNtfySettings,
  readNtfySettings,
  sendNtfyTest,
  writeNtfySettings,
  type NtfySettings,
} from "@/lib/ntfy";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

/** A command that cannot be parsed or does not start with curl is a client error. */
function commandError(settings: NtfySettings): string | null {
  if (!settings.enabled) return null;
  const expanded = expandNtfyCommand(settings.command, {});
  return expanded.ok ? null : expanded.error;
}

// GET /api/ntfy — the stored ntfy settings.
export async function GET(): Promise<Response> {
  try {
    return NextResponse.json(readNtfySettings() satisfies NtfySettingsResponse);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// PUT /api/ntfy  body: { enabled, command }
// An enabled command must parse and start with curl; only file IO can reach a 500.
export async function PUT(req: Request): Promise<Response> {
  if (!isApiRequestAllowed(req)) {
    return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  }
  if (!hasJsonContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
  }

  const settings = normalizeNtfySettings(body as Partial<NtfySettings>);
  const invalid = commandError(settings);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    return NextResponse.json(writeNtfySettings(settings) satisfies NtfySettingsResponse);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// POST /api/ntfy — run the stored command once with test values and report the exit status.
export async function POST(req: Request): Promise<Response> {
  if (!isApiRequestAllowed(req)) {
    return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  }

  try {
    // The settings panel sends the command it is showing, so Test works before Save.
    let command: string | undefined;
    if (hasJsonContentType(req)) {
      const body: unknown = await req.json().catch(() => null);
      if (isRecord(body) && typeof body.command === "string") command = body.command;
    }
    const stored = readNtfySettings();
    const settings = command === undefined ? stored : { ...stored, command };
    if (!settings.command.trim()) {
      return NextResponse.json({ ok: false, error: "command is empty" } satisfies NtfyTestResponse, { status: 400 });
    }
    const result = await sendNtfyTest(settings);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error } satisfies NtfyTestResponse, { status: 502 });
    }
    return NextResponse.json({ ok: true } satisfies NtfyTestResponse);
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) } satisfies NtfyTestResponse, { status: 500 });
  }
}
