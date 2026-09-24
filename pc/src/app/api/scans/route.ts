import { NextResponse } from "next/server";
import {
  SCAN_LIMITS,
  scanFiltersSchema,
  scanMetaSchema,
} from "@/app/lib/scan-contract";
import { apiError, withSession } from "@/server/api";
import { getEnv } from "@/server/env";
import { getServerManifest } from "@/server/model-manifest";
import { consumeRateLimit } from "@/server/rate-limit";
import {
  countScans,
  createScan,
  listScans,
  ScanValidationError,
  validateAgainstManifest,
} from "@/server/scans";
import {
  MalformedUploadError,
  PayloadTooLargeError,
  parseMultipart,
  readFilePart,
  sniffImageType,
} from "@/server/uploads";

/** GET /api/scans — the signed-in user's scans, filtered and paginated. */
export const GET = withSession(async (request, _context: unknown, session) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filters = scanFiltersSchema.parse(params);
  const page = await listScans(session.user.id, filters);
  return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
});

/**
 * POST /api/scans — save an analysis.
 *
 * Multipart fields: `meta` (JSON, see `scanMetaSchema`), `diseaseCam` and
 * `severityCam` (raw little-endian float32), and optionally `image` plus
 * `thumb` (JPEG, PNG or WebP). Inference already happened in the browser;
 * this validates the result against the deployed model and stores it.
 */
export const POST = withSession(async (request, _context: unknown, session) => {
  const env = getEnv();
  const userId = session.user.id;

  const limit = await consumeRateLimit(
    `scan-upload:${userId}`,
    env.SCAN_UPLOADS_PER_MINUTE,
    60,
  );
  if (!limit.allowed) {
    return apiError(
      429,
      "rate_limited",
      "You are saving scans faster than allowed. Wait a minute and try again.",
      { headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  if ((await countScans(userId)) >= env.MAX_SCANS_PER_USER) {
    return apiError(
      409,
      "quota_exceeded",
      `Your history is full (${env.MAX_SCANS_PER_USER} scans). Delete older scans to save new ones.`,
    );
  }

  let form: FormData;
  try {
    form = await parseMultipart(request, SCAN_LIMITS.requestMaxBytes);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return apiError(413, "too_large", "The upload is too large.");
    }
    if (error instanceof MalformedUploadError) {
      return apiError(400, "invalid_body", error.message);
    }
    throw error;
  }

  const rawMeta = form.get("meta");
  if (typeof rawMeta !== "string") {
    return apiError(400, "invalid_body", 'Missing the "meta" field.');
  }
  let metaJson: unknown;
  try {
    metaJson = JSON.parse(rawMeta);
  } catch {
    return apiError(400, "invalid_body", '"meta" is not valid JSON.');
  }
  const parsed = scanMetaSchema.safeParse(metaJson);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return apiError(
      422,
      "invalid_scan",
      `Invalid scan data at "${issue.path.join(".")}": ${issue.message}`,
    );
  }
  const meta = parsed.data;

  let diseaseCam: Buffer | null;
  let severityCam: Buffer | null;
  let image: Buffer | null;
  let thumb: Buffer | null;
  try {
    diseaseCam = await readFilePart(
      form.get("diseaseCam"),
      SCAN_LIMITS.camMaxBytes,
      "diseaseCam",
    );
    severityCam = await readFilePart(
      form.get("severityCam"),
      SCAN_LIMITS.camMaxBytes,
      "severityCam",
    );
    image = await readFilePart(
      form.get("image"),
      SCAN_LIMITS.imageMaxBytes,
      "image",
    );
    thumb = await readFilePart(
      form.get("thumb"),
      SCAN_LIMITS.thumbMaxBytes,
      "thumb",
    );
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return apiError(413, "too_large", error.message);
    }
    if (error instanceof MalformedUploadError) {
      return apiError(400, "invalid_body", error.message);
    }
    throw error;
  }

  if (!diseaseCam || !severityCam) {
    return apiError(422, "invalid_scan", "Both activation maps are required.");
  }
  if ((image === null) !== (thumb === null)) {
    return apiError(
      422,
      "invalid_scan",
      "Send the photo and its thumbnail together, or neither.",
    );
  }

  const imageType = image ? sniffImageType(image) : null;
  const thumbType = thumb ? sniffImageType(thumb) : null;
  if ((image && !imageType) || (thumb && !thumbType)) {
    return apiError(
      415,
      "unsupported_image",
      "Photos must be JPEG, PNG or WebP.",
    );
  }
  if (image && !meta.image) {
    return apiError(422, "invalid_scan", "Photo dimensions are missing.");
  }

  const manifest = await getServerManifest();
  if (!manifest) {
    return apiError(
      503,
      "model_unavailable",
      "The model is not available on the server.",
    );
  }

  try {
    validateAgainstManifest(meta, manifest, { diseaseCam, severityCam });
  } catch (error) {
    if (error instanceof ScanValidationError) {
      return apiError(422, error.code, error.message);
    }
    throw error;
  }

  // The preference is enforced here too, not only in the browser.
  const keepPhoto = session.user.savePhotos !== false;

  const id = await createScan(userId, meta, {
    diseaseCam,
    severityCam,
    image:
      keepPhoto && image && imageType ? { data: image, type: imageType } : null,
    thumb:
      keepPhoto && thumb && thumbType ? { data: thumb, type: thumbType } : null,
  });

  return NextResponse.json(
    { id },
    { status: 201, headers: { Location: `/api/scans/${id}` } },
  );
});
