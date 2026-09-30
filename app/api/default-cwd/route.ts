import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { allowFileRoot } from "@/lib/file-access";
import { validateEntryName } from "@/lib/file-mutations";
import {
  DEFAULT_CWD_TEMPLATE,
  readDefaultCwdPath,
  resolveDefaultCwdPath,
  resolveDefaultProjectBasePath,
  writeDefaultCwdPath,
} from "@/lib/default-cwd";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

function settingsResponse(path = readDefaultCwdPath()) {
  return {
    path,
    resolved: resolveDefaultCwdPath(path),
    placeholder: DEFAULT_CWD_TEMPLATE,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clientErrorStatus(message: string): number {
  return message.includes("absolute path") || message.includes("null bytes") ? 400 : 500;
}

// GET /api/default-cwd — configured template plus the path today's action would open.
export async function GET() {
  try {
    const path = readDefaultCwdPath();
    try {
      return NextResponse.json({
        ...settingsResponse(path),
        projectBase: resolveDefaultProjectBasePath(path),
      });
    } catch (error) {
      return NextResponse.json({
        path,
        resolved: "",
        placeholder: DEFAULT_CWD_TEMPLATE,
        projectBase: "",
        error: errorMessage(error),
      });
    }
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// PUT /api/default-cwd  body: { path: string }
// Empty path restores the built-in dated home folder. The directory is created on POST.
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
    const path = writeDefaultCwdPath(body.path);
    return NextResponse.json(settingsResponse(path));
  } catch (error) {
    const message = errorMessage(error);
    return NextResponse.json({ error: message }, { status: clientErrorStatus(message) });
  }
}

// POST /api/default-cwd
// Creates the configured (or built-in dated) directory if it doesn't exist and returns the path.
export async function POST(req: Request) {
  if (!isApiRequestAllowed(req)) {
    return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  }

  try {
    const configured = readDefaultCwdPath();
    const defaultCwd = resolveDefaultCwdPath(configured);

    // 可选 body { name }：在项目落点（默认目录以 {date} 结尾时取其父级，否则取默认
    // 目录本身）下新建或复用项目文件夹并返回它；没有 name 时维持原行为。
    const body = await req.json().catch(() => null) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      mkdirSync(defaultCwd, { recursive: true });
      allowFileRoot(defaultCwd);
      return NextResponse.json({ cwd: defaultCwd });
    }

    const nameError = validateEntryName(name);
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }
    const projectCwd = join(resolveDefaultProjectBasePath(configured), name);
    mkdirSync(projectCwd, { recursive: true });
    allowFileRoot(projectCwd);
    return NextResponse.json({ cwd: projectCwd });
  } catch (error) {
    const message = errorMessage(error);
    return NextResponse.json({ error: message }, { status: clientErrorStatus(message) });
  }
}
