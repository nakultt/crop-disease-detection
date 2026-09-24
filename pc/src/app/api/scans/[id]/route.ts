import { NextResponse } from "next/server";
import { scanUpdateSchema } from "@/app/lib/scan-contract";
import { apiError, withSession } from "@/server/api";
import { deleteScan, getScan, updateScan } from "@/server/scans";

type Context = { params: Promise<{ id: string }> };

const notFound = () => apiError(404, "not_found", "That scan does not exist.");

/** GET /api/scans/:id — one scan, including its activation maps. */
export const GET = withSession(async (_request, context: Context, session) => {
  const { id } = await context.params;
  const scan = await getScan(session.user.id, id);
  if (!scan) return notFound();
  return NextResponse.json(scan, { headers: { "Cache-Control": "no-store" } });
});

/** PATCH /api/scans/:id — edit the label and notes. */
export const PATCH = withSession(async (request, context: Context, session) => {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_body", "Expected a JSON body.");
  }

  const parsed = scanUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "invalid_update", parsed.error.issues[0].message);
  }

  const updated = await updateScan(session.user.id, id, parsed.data);
  if (!updated) return notFound();
  return NextResponse.json({ ok: true });
});

/** DELETE /api/scans/:id — remove the scan and its photo. */
export const DELETE = withSession(
  async (_request, context: Context, session) => {
    const { id } = await context.params;
    const deleted = await deleteScan(session.user.id, id);
    if (!deleted) return notFound();
    return new NextResponse(null, { status: 204 });
  },
);
