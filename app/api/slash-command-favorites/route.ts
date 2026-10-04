import { NextResponse } from "next/server";
import type { SlashCommandFavoritesResponse } from "@/lib/api-types";
import {
  readSlashCommandFavorites,
  writeSlashCommandFavorites,
} from "@/lib/slash-command-favorites";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

// GET /api/slash-command-favorites — the marked command names.
export async function GET(): Promise<Response> {
  try {
    const favorites = readSlashCommandFavorites();
    return NextResponse.json({ favorites } satisfies SlashCommandFavoritesResponse);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// PUT /api/slash-command-favorites  body: { favorites: string[] }
// Names are normalized (trimmed, deduped, capped); only file IO can reach a 500.
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

  try {
    const favorites = writeSlashCommandFavorites(body.favorites);
    return NextResponse.json({ favorites } satisfies SlashCommandFavoritesResponse);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
