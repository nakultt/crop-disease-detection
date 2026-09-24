import { NextResponse } from "next/server";
import { pingDatabase } from "@/server/db";
import { getServerManifest } from "@/server/model-manifest";

// Never serve a cached answer: a health check must reflect this moment.
export const dynamic = "force-dynamic";

const startedAt = Date.now();

/**
 * GET /api/health — for load balancers, Docker and uptime monitors.
 *
 * 200 when the database answers, 503 when it does not. Deliberately reveals
 * nothing beyond up/down.
 */
export async function GET() {
  const [database, manifest] = await Promise.all([
    pingDatabase(),
    getServerManifest(),
  ]);

  return NextResponse.json(
    {
      status: database ? "ok" : "degraded",
      database: database ? "up" : "down",
      model: manifest ? "ready" : "missing",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    },
    {
      status: database ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
