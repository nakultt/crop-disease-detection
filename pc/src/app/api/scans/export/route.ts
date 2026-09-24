import { toCsv } from "@/app/lib/csv";
import { scanFiltersSchema } from "@/app/lib/scan-contract";
import { withSession } from "@/server/api";
import { getEnv } from "@/server/env";
import { exportScanDocs } from "@/server/scans";

const HEADER = [
  "id",
  "created_at",
  "crop",
  "condition",
  "class",
  "healthy",
  "confidence",
  "severity",
  "severity_confidence",
  "label",
  "notes",
  "model_version",
];

/** GET /api/scans/export — the user's scans as CSV, honouring the history filters. */
export const GET = withSession(async (request, _context: unknown, session) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const {
    page: _page,
    sort: _sort,
    ...filters
  } = scanFiltersSchema.parse(params);

  const docs = await exportScanDocs(
    session.user.id,
    filters,
    getEnv().MAX_SCANS_PER_USER,
  );

  const csv = toCsv(
    HEADER,
    docs.map((doc) => [
      doc._id.toHexString(),
      doc.createdAt,
      doc.disease.crop,
      doc.disease.condition,
      doc.disease.className,
      doc.disease.healthy ? "yes" : "no",
      Number(doc.disease.probability.toFixed(4)),
      doc.disease.healthy ? "" : doc.severity.className,
      doc.disease.healthy ? "" : Number(doc.severity.probability.toFixed(4)),
      doc.label,
      doc.notes,
      doc.model.version,
    ]),
  );

  const date = new Date().toISOString().slice(0, 10);
  // A BOM makes Excel open the file as UTF-8, so non-Latin notes survive.
  return new Response(`﻿${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plantguard-scans-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
