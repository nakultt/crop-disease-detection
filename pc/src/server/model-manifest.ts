import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { type ModelManifest, parseManifest } from "@/app/lib/manifest";
import { logger } from "./logger";

/**
 * The deployed model's manifest, read from disk on the server.
 *
 * Used to validate saved scans (a class name must exist in the model that
 * produced it) and to describe the model on public pages. Cached for the life
 * of the process in production; re-read every few seconds in development so
 * a fresh export shows up without a restart.
 */

const MANIFEST_PATH = path.join(
  process.cwd(),
  "public",
  "models",
  "model.json",
);
const DEV_TTL_MS = 5_000;

let cache: { manifest: ModelManifest; loadedAt: number } | null = null;

export async function getServerManifest(): Promise<ModelManifest | null> {
  const fresh =
    cache &&
    (process.env.NODE_ENV === "production" ||
      Date.now() - cache.loadedAt < DEV_TTL_MS);
  if (fresh && cache) return cache.manifest;

  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    const manifest = parseManifest(JSON.parse(raw));
    cache = { manifest, loadedAt: Date.now() };
    return manifest;
  } catch (error) {
    logger.warn("Model manifest unavailable", {
      path: MANIFEST_PATH,
      err: error,
    });
    return null;
  }
}
