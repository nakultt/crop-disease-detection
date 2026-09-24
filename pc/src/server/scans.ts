import "server-only";
import { Binary, type Filter, ObjectId } from "mongodb";
import {
  conditionOf,
  cropOf,
  isHealthy,
  type ModelManifest,
} from "@/app/lib/manifest";
import {
  type ImageType,
  SCAN_LIMITS,
  type ScanDetail,
  type ScanFilters,
  type ScanMeta,
  type ScanPage,
  type ScanSummary,
  type ScanUpdate,
  type UserScanStats,
} from "@/app/lib/scan-contract";
import { COLLECTIONS, getDb } from "./db";

/**
 * Storage for saved scans.
 *
 * Every read and write here is scoped by `userId`, taken from the verified
 * session by the caller — never from the request body. A scan id alone is
 * never enough to reach a document; `{ _id, userId }` must both match.
 *
 * Photos live in a separate collection so that listing and aggregating scans
 * never drags image bytes off disk.
 */

interface ScoreDoc {
  className: string;
  index: number;
  probability: number;
}

export interface ScanDoc {
  _id: ObjectId;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  fileName: string | null;
  label: string;
  notes: string;
  disease: ScoreDoc & { healthy: boolean; crop: string; condition: string };
  topK: ScoreDoc[];
  severity: ScoreDoc & { range: string; distribution: ScoreDoc[] };
  cam: {
    gridH: number;
    gridW: number;
    classes: number;
    disease: Binary;
    severity: Binary;
  };
  model: { version: string; backbone: string; trained: boolean };
  inferenceMs: number;
  image: {
    width: number;
    height: number;
    type: string;
    bytes: number;
    thumbType: string;
    thumbBytes: number;
  } | null;
}

interface ScanImageDoc {
  _id: ObjectId;
  userId: string;
  createdAt: Date;
  image: Binary;
  imageType: string;
  thumb: Binary;
  thumbType: string;
}

export interface ScanFiles {
  diseaseCam: Buffer;
  severityCam: Buffer;
  image: { data: Buffer; type: ImageType } | null;
  thumb: { data: Buffer; type: ImageType } | null;
}

export class ScanValidationError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_scan" | "model_mismatch" = "invalid_scan",
  ) {
    super(message);
    this.name = "ScanValidationError";
  }
}

function scans() {
  return getDb().collection<ScanDoc>(COLLECTIONS.scans);
}

function scanImages() {
  return getDb().collection<ScanImageDoc>(COLLECTIONS.scanImages);
}

function toObjectId(id: string): ObjectId | null {
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

/**
 * A result is only stored if it could have come from the deployed model:
 * every class name must sit at the index it claims, and the CAM buffers must
 * be exactly the size the grid implies. A mismatch usually means the page
 * was loaded before a model update — the client is told to reload.
 */
export function validateAgainstManifest(
  meta: ScanMeta,
  manifest: ModelManifest,
  files: Pick<ScanFiles, "diseaseCam" | "severityCam">,
): void {
  const diseaseNames = manifest.classes.disease;
  const severityNames = manifest.classes.severity;

  const expect = (score: ScoreDoc, names: string[], what: string) => {
    if (names[score.index] !== score.className) {
      throw new ScanValidationError(
        `${what} "${score.className}" is not class ${score.index} of the deployed model. Reload the page to pick up the current model.`,
        "model_mismatch",
      );
    }
  };

  expect(meta.disease, diseaseNames, "Diagnosis");
  for (const candidate of meta.topK)
    expect(candidate, diseaseNames, "Candidate");
  expect(meta.severity, severityNames, "Severity");

  if (meta.severity.distribution.length !== severityNames.length) {
    throw new ScanValidationError(
      "The severity distribution does not match the model's severity levels.",
      "model_mismatch",
    );
  }
  for (const level of meta.severity.distribution) {
    expect(level, severityNames, "Severity level");
  }

  if (meta.cam.classes !== diseaseNames.length) {
    throw new ScanValidationError(
      "The activation map does not match the model's class count.",
      "model_mismatch",
    );
  }

  const plane = meta.cam.gridH * meta.cam.gridW;
  if (files.diseaseCam.length !== meta.cam.classes * plane * 4) {
    throw new ScanValidationError(
      "The disease activation map is the wrong size.",
    );
  }
  if (files.severityCam.length !== plane * 4) {
    throw new ScanValidationError(
      "The severity activation map is the wrong size.",
    );
  }

  for (const buffer of [files.diseaseCam, files.severityCam]) {
    const floats = new Float32Array(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length),
    );
    if (!floats.every(Number.isFinite)) {
      throw new ScanValidationError(
        "The activation map contains invalid values.",
      );
    }
  }
}

export async function countScans(userId: string): Promise<number> {
  return scans().countDocuments({ userId });
}

export async function createScan(
  userId: string,
  meta: ScanMeta,
  files: ScanFiles,
): Promise<string> {
  const _id = new ObjectId();
  const now = new Date();
  const withImage = files.image !== null && files.thumb !== null;

  const doc: ScanDoc = {
    _id,
    userId,
    createdAt: now,
    updatedAt: now,
    fileName: meta.fileName ?? null,
    label: meta.label,
    notes: meta.notes,
    disease: {
      className: meta.disease.className,
      index: meta.disease.index,
      probability: meta.disease.probability,
      healthy: isHealthy(meta.disease.className),
      crop: cropOf(meta.disease.className),
      condition: conditionOf(meta.disease.className),
    },
    topK: meta.topK,
    severity: {
      className: meta.severity.className,
      index: meta.severity.index,
      probability: meta.severity.probability,
      range: meta.severity.range,
      distribution: meta.severity.distribution,
    },
    cam: {
      gridH: meta.cam.gridH,
      gridW: meta.cam.gridW,
      classes: meta.cam.classes,
      disease: new Binary(files.diseaseCam),
      severity: new Binary(files.severityCam),
    },
    model: meta.model,
    inferenceMs: meta.inferenceMs,
    image:
      withImage && files.image && files.thumb && meta.image
        ? {
            width: meta.image.width,
            height: meta.image.height,
            type: files.image.type,
            bytes: files.image.data.length,
            thumbType: files.thumb.type,
            thumbBytes: files.thumb.data.length,
          }
        : null,
  };

  await scans().insertOne(doc);

  if (doc.image && files.image && files.thumb) {
    try {
      await scanImages().insertOne({
        _id,
        userId,
        createdAt: now,
        image: new Binary(files.image.data),
        imageType: files.image.type,
        thumb: new Binary(files.thumb.data),
        thumbType: files.thumb.type,
      });
    } catch (error) {
      // Without a transaction, undo by hand rather than leave a scan that
      // claims a photo it does not have.
      await scans().deleteOne({ _id });
      throw error;
    }
  }

  return _id.toHexString();
}

const SUMMARY_PROJECTION = {
  createdAt: 1,
  label: 1,
  "disease.className": 1,
  "disease.crop": 1,
  "disease.condition": 1,
  "disease.healthy": 1,
  "disease.probability": 1,
  "severity.className": 1,
  "severity.probability": 1,
  image: 1,
} as const;

type SummaryDoc = Pick<ScanDoc, "_id" | "createdAt" | "label" | "image"> & {
  disease: Pick<
    ScanDoc["disease"],
    "className" | "crop" | "condition" | "healthy" | "probability"
  >;
  severity: Pick<ScanDoc["severity"], "className" | "probability">;
};

function toSummary(doc: SummaryDoc): ScanSummary {
  return {
    id: doc._id.toHexString(),
    createdAt: doc.createdAt.toISOString(),
    className: doc.disease.className,
    crop: doc.disease.crop,
    condition: doc.disease.condition,
    healthy: doc.disease.healthy,
    confidence: doc.disease.probability,
    severity: doc.disease.healthy
      ? null
      : {
          level: doc.severity.className,
          probability: doc.severity.probability,
        },
    label: doc.label ?? "",
    hasImage: doc.image !== null,
  };
}

function binaryToBase64(binary: Binary): string {
  return Buffer.from(binary.buffer).toString("base64");
}

function toDetail(doc: ScanDoc): ScanDetail {
  return {
    ...toSummary(doc),
    updatedAt: doc.updatedAt.toISOString(),
    notes: doc.notes ?? "",
    fileName: doc.fileName,
    diseaseIndex: doc.disease.index,
    topK: doc.topK,
    severityDetail: {
      className: doc.severity.className,
      index: doc.severity.index,
      probability: doc.severity.probability,
      range: doc.severity.range,
      distribution: doc.severity.distribution,
    },
    cam: {
      gridH: doc.cam.gridH,
      gridW: doc.cam.gridW,
      classes: doc.cam.classes,
      disease: binaryToBase64(doc.cam.disease),
      severity: binaryToBase64(doc.cam.severity),
    },
    model: doc.model,
    inferenceMs: doc.inferenceMs,
    image: doc.image
      ? { width: doc.image.width, height: doc.image.height }
      : null,
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildScanQuery(
  userId: string,
  filters: Omit<ScanFilters, "page" | "sort">,
): Filter<ScanDoc> {
  const query: Filter<ScanDoc> = { userId };

  if (filters.crop) query["disease.crop"] = filters.crop;
  if (filters.status === "healthy") query["disease.healthy"] = true;
  if (filters.status === "diseased") query["disease.healthy"] = false;
  if (filters.severity) {
    query["severity.className"] = filters.severity;
    query["disease.healthy"] = false;
  }
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [
      { label: pattern },
      { notes: pattern },
      { "disease.condition": pattern },
      { "disease.crop": pattern },
    ];
  }
  return query;
}

export async function listScans(
  userId: string,
  filters: ScanFilters,
  pageSize: number = SCAN_LIMITS.pageSize,
): Promise<ScanPage> {
  const query = buildScanQuery(userId, filters);
  const total = await scans().countDocuments(query);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(filters.page, pageCount);

  const docs = await scans()
    .find(query, { projection: SUMMARY_PROJECTION })
    .sort({ createdAt: filters.sort === "oldest" ? 1 : -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  return {
    items: docs.map((doc) => toSummary(doc as unknown as SummaryDoc)),
    total,
    page,
    pageCount,
  };
}

export async function recentScans(
  userId: string,
  limit: number,
): Promise<ScanSummary[]> {
  const docs = await scans()
    .find({ userId }, { projection: SUMMARY_PROJECTION })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((doc) => toSummary(doc as unknown as SummaryDoc));
}

/** Crops this user has scanned, for the history filter. */
export async function scannedCrops(userId: string): Promise<string[]> {
  const crops = await scans().distinct("disease.crop", { userId });
  return (crops as string[]).sort((a, b) => a.localeCompare(b));
}

export async function getScan(
  userId: string,
  id: string,
): Promise<ScanDetail | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  const doc = await scans().findOne({ _id, userId });
  return doc ? toDetail(doc) : null;
}

export async function updateScan(
  userId: string,
  id: string,
  update: ScanUpdate,
): Promise<boolean> {
  const _id = toObjectId(id);
  if (!_id) return false;

  const set: Partial<ScanDoc> = { updatedAt: new Date() };
  if (update.label !== undefined) set.label = update.label;
  if (update.notes !== undefined) set.notes = update.notes;

  const result = await scans().updateOne({ _id, userId }, { $set: set });
  return result.matchedCount > 0;
}

export async function deleteScan(userId: string, id: string): Promise<boolean> {
  const _id = toObjectId(id);
  if (!_id) return false;
  const result = await scans().deleteOne({ _id, userId });
  if (result.deletedCount === 0) return false;
  await scanImages().deleteOne({ _id, userId });
  return true;
}

export async function deleteAllScansForUser(userId: string): Promise<number> {
  const result = await scans().deleteMany({ userId });
  await scanImages().deleteMany({ userId });
  return result.deletedCount;
}

export async function getScanImage(
  userId: string,
  id: string,
  variant: "full" | "thumb",
): Promise<{ data: Buffer; type: string } | null> {
  const _id = toObjectId(id);
  if (!_id) return null;

  const doc = await scanImages().findOne(
    { _id, userId },
    {
      projection:
        variant === "full"
          ? { image: 1, imageType: 1 }
          : { thumb: 1, thumbType: 1 },
    },
  );
  if (!doc) return null;

  return variant === "full"
    ? { data: Buffer.from(doc.image.buffer), type: doc.imageType }
    : { data: Buffer.from(doc.thumb.buffer), type: doc.thumbType };
}

/** Rows for CSV export, newest first. */
export async function exportScanDocs(
  userId: string,
  filters: Omit<ScanFilters, "page" | "sort">,
  limit: number,
): Promise<ScanDoc[]> {
  return scans()
    .find(buildScanQuery(userId, filters), {
      projection: { cam: 0 },
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfIsoWeek(date: Date): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const offset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - offset);
  return start;
}

export async function getUserStats(
  userId: string,
  now: Date = new Date(),
): Promise<UserScanStats> {
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const firstWeek = startOfIsoWeek(now);
  firstWeek.setUTCDate(firstWeek.getUTCDate() - 7 * 7);

  const [result] = await scans()
    .aggregate<{
      totals: {
        total: number;
        healthy: number;
        last30: number;
        lastScanAt: Date | null;
      }[];
      bySeverity: { _id: string; count: number }[];
      byCrop: { _id: string; count: number }[];
      topConditions: {
        _id: string;
        crop: string;
        condition: string;
        count: number;
      }[];
      weekly: { _id: Date; count: number }[];
    }>([
      { $match: { userId } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                healthy: { $sum: { $cond: ["$disease.healthy", 1, 0] } },
                last30: {
                  $sum: { $cond: [{ $gte: ["$createdAt", since30] }, 1, 0] },
                },
                lastScanAt: { $max: "$createdAt" },
              },
            },
          ],
          bySeverity: [
            { $match: { "disease.healthy": false } },
            { $group: { _id: "$severity.className", count: { $sum: 1 } } },
          ],
          byCrop: [
            { $group: { _id: "$disease.crop", count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 8 },
          ],
          topConditions: [
            { $match: { "disease.healthy": false } },
            {
              $group: {
                _id: "$disease.className",
                crop: { $first: "$disease.crop" },
                condition: { $first: "$disease.condition" },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 5 },
          ],
          weekly: [
            { $match: { createdAt: { $gte: firstWeek } } },
            {
              $group: {
                _id: {
                  $dateTrunc: {
                    date: "$createdAt",
                    unit: "week",
                    startOfWeek: "monday",
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ])
    .toArray();

  const totals = result?.totals[0];
  const weeklyCounts = new Map(
    (result?.weekly ?? []).map((w) => [new Date(w._id).getTime(), w.count]),
  );

  const weekly: UserScanStats["weekly"] = [];
  for (let i = 0; i < 8; i++) {
    const start = new Date(firstWeek);
    start.setUTCDate(start.getUTCDate() + i * 7);
    weekly.push({
      weekStart: start.toISOString(),
      count: weeklyCounts.get(start.getTime()) ?? 0,
    });
  }

  const total = totals?.total ?? 0;
  const healthy = totals?.healthy ?? 0;

  return {
    total,
    healthy,
    diseased: total - healthy,
    last30Days: totals?.last30 ?? 0,
    lastScanAt: totals?.lastScanAt ? totals.lastScanAt.toISOString() : null,
    bySeverity: (result?.bySeverity ?? []).map((s) => ({
      level: s._id,
      count: s.count,
    })),
    byCrop: (result?.byCrop ?? []).map((c) => ({
      crop: c._id,
      count: c.count,
    })),
    topConditions: (result?.topConditions ?? []).map((c) => ({
      className: c._id,
      crop: c.crop,
      condition: c.condition,
      count: c.count,
    })),
    weekly,
  };
}

export async function scanCountsByUser(
  userIds: string[],
): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  const rows = await scans()
    .aggregate<{ _id: string; count: number }>([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
}
