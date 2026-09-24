import { withSession } from "@/server/api";
import { getEnv } from "@/server/env";
import { exportScanDocs } from "@/server/scans";

/**
 * GET /api/account/export — everything stored about the signed-in user, as
 * JSON: profile, preferences and every scan result. Photos are not inlined
 * (they can run to gigabytes); each scan lists the URL to download its own.
 */
export const GET = withSession(async (_request, _context: unknown, session) => {
  const { user } = session;
  const docs = await exportScanDocs(
    user.id,
    { status: "all" },
    getEnv().MAX_SCANS_PER_USER,
  );

  const body = {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
    preferences: {
      autoSaveScans: user.autoSaveScans !== false,
      savePhotos: user.savePhotos !== false,
    },
    scans: docs.map((doc) => ({
      id: doc._id.toHexString(),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      label: doc.label,
      notes: doc.notes,
      fileName: doc.fileName,
      diagnosis: {
        className: doc.disease.className,
        crop: doc.disease.crop,
        condition: doc.disease.condition,
        healthy: doc.disease.healthy,
        confidence: doc.disease.probability,
        candidates: doc.topK,
      },
      severity: doc.disease.healthy
        ? null
        : {
            level: doc.severity.className,
            confidence: doc.severity.probability,
            range: doc.severity.range,
            distribution: doc.severity.distribution,
          },
      model: doc.model,
      inferenceMs: doc.inferenceMs,
      photo: doc.image
        ? `/api/scans/${doc._id.toHexString()}/image?download=1`
        : null,
    })),
  };

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="plantguard-account-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
