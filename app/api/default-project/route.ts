import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import {
  DEFAULT_PROJECT_BASE_TEMPLATE,
  readDefaultProjectPath,
  resolveDefaultProjectBasePath,
  writeDefaultProjectPath,
} from "@/lib/default-project";
import { validateEntryName } from "@/lib/file-mutations";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

function settingsResponse(path = readDefaultProjectPath()) {
  return {
    path,
    resolved: resolveDefaultProjectBasePath(path),
    placeholder: DEFAULT_PROJECT_BASE_TEMPLATE,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clientErrorStatus(message: string): number {
  return message.includes("absolute path") || message.includes("null bytes") ? 400 : 500;
}

// GET /api/default-project — the configured project directory plus where a new
// project would land today. Empty means the built-in ~/pi-cwd.
export async function GET() {
  try {
    return NextResponse.json(settingsResponse());
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// PUT /api/default-project  body: { path: string }
// Empty path restores the built-in ~/pi-cwd. Directories are created on POST.
export async function PUT(req: Request) {
  if (!isApiRequestAllowed(req)) {
    return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  }
  if (!hasJsonContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  try {
    const body = await req.json() as { path?: unknown };
    if (typeof body.path !== "string") {
      return NextResponse.json({ error: "path must be a string" }, { status: 400 });
    }
    const path = writeDefaultProjectPath(body.path);
    return NextResponse.json(settingsResponse(path));
  } catch (error) {
    const message = errorMessage(error);
    return NextResponse.json({ error: message }, { status: clientErrorStatus(message) });
  }
}

// POST /api/default-project  body: { name: string }
// Creates (or reuses) <project directory>/<name> and returns it. The sidebar then
// selects it through /api/cwd/validate, which owns validation, project identity
// and the file allow-list.
export async function POST(req: Request) {
  if (!isApiRequestAllowed(req)) {
    return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const nameError = validateEntryName(name);
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }

    const projectCwd = join(resolveDefaultProjectBasePath(readDefaultProjectPath()), name);
    mkdirSync(projectCwd, { recursive: true });
    return NextResponse.json({ cwd: projectCwd });
  } catch (error) {
    const message = errorMessage(error);
    return NextResponse.json({ error: message }, { status: clientErrorStatus(message) });
  }
}
