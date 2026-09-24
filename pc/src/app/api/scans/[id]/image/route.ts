import { apiError, withSession } from "@/server/api";
import { getScanImage } from "@/server/scans";

type Context = { params: Promise<{ id: string }> };

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * GET /api/scans/:id/image[?variant=thumb][&download=1]
 *
 * Photos are private: served only to their owner, never to shared caches.
 * A scan's photo never changes, so the owner's browser may keep it forever.
 */
export const GET = withSession(async (request, context: Context, session) => {
  const { id } = await context.params;
  const url = new URL(request.url);
  const variant =
    url.searchParams.get("variant") === "thumb" ? "thumb" : "full";

  const image = await getScanImage(session.user.id, id, variant);
  if (!image) {
    return apiError(404, "not_found", "No photo is stored for that scan.");
  }

  const headers: Record<string, string> = {
    "Content-Type": image.type,
    "Content-Length": String(image.data.length),
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  if (url.searchParams.get("download") === "1") {
    headers["Content-Disposition"] =
      `attachment; filename="plantguard-scan-${id}.${EXTENSIONS[image.type] ?? "img"}"`;
  }

  return new Response(new Uint8Array(image.data), { headers });
});
