/**
 * The shape of a saved scan, shared by the browser (which produces it) and
 * the server (which validates and stores it).
 *
 * Inference happens on the user's device, so the server receives a finished
 * result rather than a photo to classify. It still validates that result
 * against the deployed model's manifest before storing it — see
 * `validateAgainstManifest` in `src/server/scans.ts`.
 */

import { z } from "zod";

export const SCAN_LIMITS = {
  /** Longest edge of the stored photo, in pixels. */
  imageMaxEdge: 1600,
  imageMaxBytes: 2_500_000,
  thumbSize: 320,
  thumbMaxBytes: 256_000,
  /** 1000 classes × 64 × 64 float32s would be 16 MB; nothing real is close. */
  camMaxBytes: 512_000,
  labelMaxLength: 120,
  notesMaxLength: 4000,
  requestMaxBytes: 4_000_000,
  pageSize: 24,
} as const;

export const IMAGE_TYPES = ["image/jpeg", "image/webp", "image/png"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

const classScore = z.object({
  className: z.string().min(1).max(200),
  index: z.number().int().min(0).max(999),
  probability: z.number().min(0).max(1),
});

export type ClassScoreInput = z.infer<typeof classScore>;

export const scanMetaSchema = z.object({
  fileName: z.string().trim().max(255).nullish(),
  label: z.string().trim().max(SCAN_LIMITS.labelMaxLength).default(""),
  notes: z.string().trim().max(SCAN_LIMITS.notesMaxLength).default(""),
  disease: classScore,
  topK: z.array(classScore).min(1).max(10),
  severity: classScore.extend({
    range: z.string().max(40),
    distribution: z.array(classScore).min(1).max(20),
  }),
  cam: z.object({
    gridH: z.number().int().min(1).max(64),
    gridW: z.number().int().min(1).max(64),
    classes: z.number().int().min(1).max(999),
  }),
  model: z.object({
    version: z.string().min(1).max(100),
    backbone: z.string().min(1).max(200),
    trained: z.boolean(),
  }),
  inferenceMs: z.number().min(0).max(600_000),
  image: z
    .object({
      width: z.number().int().min(1).max(20_000),
      height: z.number().int().min(1).max(20_000),
    })
    .nullable(),
});

export type ScanMetaInput = z.input<typeof scanMetaSchema>;
export type ScanMeta = z.output<typeof scanMetaSchema>;

export const scanUpdateSchema = z
  .object({
    label: z.string().trim().max(SCAN_LIMITS.labelMaxLength).optional(),
    notes: z.string().trim().max(SCAN_LIMITS.notesMaxLength).optional(),
  })
  .refine((value) => value.label !== undefined || value.notes !== undefined, {
    message: "Nothing to update.",
  });

export type ScanUpdate = z.infer<typeof scanUpdateSchema>;

export const SCAN_STATUSES = ["all", "healthy", "diseased"] as const;
export const SCAN_SORTS = ["newest", "oldest"] as const;

export const scanFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  crop: z.string().trim().max(80).optional().catch(undefined),
  status: z.enum(SCAN_STATUSES).default("all").catch("all"),
  severity: z.string().trim().max(40).optional().catch(undefined),
  sort: z.enum(SCAN_SORTS).default("newest").catch("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export type ScanFilters = z.output<typeof scanFiltersSchema>;

/** What a list row needs — no CAM cube, no notes. */
export interface ScanSummary {
  id: string;
  createdAt: string;
  className: string;
  crop: string;
  condition: string;
  healthy: boolean;
  confidence: number;
  /** `null` for healthy leaves, where severity is meaningless. */
  severity: { level: string; probability: number } | null;
  label: string;
  hasImage: boolean;
}

export interface ScanDetail extends ScanSummary {
  updatedAt: string;
  notes: string;
  fileName: string | null;
  diseaseIndex: number;
  topK: ClassScoreInput[];
  severityDetail: ClassScoreInput & {
    range: string;
    distribution: ClassScoreInput[];
  };
  /** Float32 cubes, base64-encoded little-endian. */
  cam: {
    gridH: number;
    gridW: number;
    classes: number;
    disease: string;
    severity: string;
  };
  model: { version: string; backbone: string; trained: boolean };
  inferenceMs: number;
  image: { width: number; height: number } | null;
}

export interface ScanPage {
  items: ScanSummary[];
  total: number;
  page: number;
  pageCount: number;
}

export interface UserScanStats {
  total: number;
  healthy: number;
  diseased: number;
  last30Days: number;
  lastScanAt: string | null;
  bySeverity: { level: string; count: number }[];
  byCrop: { crop: string; count: number }[];
  topConditions: {
    className: string;
    crop: string;
    condition: string;
    count: number;
  }[];
  /** Scans per ISO week, oldest first, covering the last eight weeks. */
  weekly: { weekStart: string; count: number }[];
}

/** Float32Array → base64 (browser and Node). */
export function floatsToBase64(values: Float32Array): string {
  const bytes = new Uint8Array(
    values.buffer,
    values.byteOffset,
    values.byteLength,
  );
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** base64 → Float32Array (browser and Node). */
export function base64ToFloats(encoded: string): Float32Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer, 0, Math.floor(bytes.length / 4));
}
