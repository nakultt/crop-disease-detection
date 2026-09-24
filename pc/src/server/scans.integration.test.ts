/**
 * Integration tests against a real MongoDB: a throwaway database per run,
 * dropped afterwards. Skipped (not failed) when no server is reachable, so the
 * unit suite still runs anywhere; CI provides a MongoDB service.
 */
import { MongoClient } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scanMetaSchema } from "@/app/lib/scan-contract";
import { camBuffers, TINY_JPEG, validMeta } from "@/test/fixtures";

const base = process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017";
const dbName = `plantguard_test_${process.pid}_${Date.now()}`;
process.env.MONGODB_URI = `${base.replace(/\/+$/, "")}/${dbName}`;
delete process.env.MONGODB_DB;

async function reachable(): Promise<boolean> {
  const probe = new MongoClient(base, { serverSelectionTimeoutMS: 1500 });
  try {
    await probe.connect();
    await probe.db("admin").command({ ping: 1 });
    return true;
  } catch {
    return false;
  } finally {
    await probe.close().catch(() => undefined);
  }
}

const available = await reachable();

describe.skipIf(!available)("scans repository (MongoDB)", async () => {
  const { ensureIndexes, getMongo } = await import("./db");
  const scans = await import("./scans");
  const { consumeRateLimit } = await import("./rate-limit");

  const alice = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const bob = "bbbbbbbbbbbbbbbbbbbbbbbb";

  async function save(
    userId: string,
    overrides: Parameters<typeof validMeta>[1] = {},
    withPhoto = true,
  ) {
    const meta = scanMetaSchema.parse(validMeta(undefined, overrides));
    return scans.createScan(userId, meta, {
      ...camBuffers(meta),
      image: withPhoto ? { data: TINY_JPEG, type: "image/jpeg" } : null,
      thumb: withPhoto ? { data: TINY_JPEG, type: "image/jpeg" } : null,
    });
  }

  beforeAll(async () => {
    await ensureIndexes();
  });

  afterAll(async () => {
    const { client, db } = getMongo();
    await db.dropDatabase();
    await client.close();
    (globalThis as { __plantguardMongo?: unknown }).__plantguardMongo =
      undefined;
    (globalThis as { __plantguardIndexes?: unknown }).__plantguardIndexes =
      undefined;
  });

  it("stores a scan and reads it back in full", async () => {
    const id = await save(alice, {
      label: "North field",
      notes: "Spots on lower leaves",
    });
    const scan = await scans.getScan(alice, id);

    expect(scan).toMatchObject({
      id,
      className: "Tomato___Early_blight",
      crop: "Tomato",
      condition: "Early blight",
      healthy: false,
      label: "North field",
      notes: "Spots on lower leaves",
      hasImage: true,
      image: { width: 1200, height: 900 },
    });
    expect(scan?.cam.disease.length).toBeGreaterThan(0);
  });

  it("never returns another user's scan", async () => {
    const id = await save(alice);
    expect(await scans.getScan(bob, id)).toBeNull();
    expect(await scans.getScanImage(bob, id, "full")).toBeNull();
    expect(await scans.updateScan(bob, id, { notes: "mine now" })).toBe(false);
    expect(await scans.deleteScan(bob, id)).toBe(false);
    expect(await scans.getScan(alice, id)).not.toBeNull();
  });

  it("treats malformed ids as not found", async () => {
    expect(await scans.getScan(alice, "not-an-id")).toBeNull();
    expect(await scans.deleteScan(alice, "{$ne:null}")).toBe(false);
  });

  it("serves the stored photo and thumbnail", async () => {
    const id = await save(alice);
    const full = await scans.getScanImage(alice, id, "full");
    const thumb = await scans.getScanImage(alice, id, "thumb");
    expect(full?.type).toBe("image/jpeg");
    expect(full?.data.equals(TINY_JPEG)).toBe(true);
    expect(thumb?.data.length).toBe(TINY_JPEG.length);
  });

  it("can store a result without a photo", async () => {
    const id = await save(alice, {}, false);
    expect((await scans.getScan(alice, id))?.hasImage).toBe(false);
    expect(await scans.getScanImage(alice, id, "full")).toBeNull();
  });

  it("updates notes and label", async () => {
    const id = await save(alice);
    expect(
      await scans.updateScan(alice, id, {
        label: "Plot 7",
        notes: "Sprayed copper",
      }),
    ).toBe(true);
    expect(await scans.getScan(alice, id)).toMatchObject({
      label: "Plot 7",
      notes: "Sprayed copper",
    });
  });

  it("filters, searches and paginates", async () => {
    const carol = "cccccccccccccccccccccccc";
    const meta = validMeta();
    const healthy = {
      className: "Tomato___healthy",
      index: meta.topK[0].index + 7,
      probability: 0.9,
    };
    // Tomato___healthy's real index, from the manifest order.
    const { shippedManifest } = await import("@/test/fixtures");
    healthy.index =
      shippedManifest().classes.disease.indexOf("Tomato___healthy");

    for (let i = 0; i < 5; i++) await save(carol, { label: `Row ${i}` });
    await save(carol, {
      disease: healthy,
      topK: [healthy],
      label: "Greenhouse",
    });

    const all = await scans.listScans(carol, scanFilters({}), 4);
    expect(all.total).toBe(6);
    expect(all.pageCount).toBe(2);
    expect(all.items).toHaveLength(4);

    expect(
      (await scans.listScans(carol, scanFilters({ status: "healthy" }))).total,
    ).toBe(1);
    expect(
      (await scans.listScans(carol, scanFilters({ status: "diseased" }))).total,
    ).toBe(5);
    expect(
      (await scans.listScans(carol, scanFilters({ q: "greenhouse" }))).total,
    ).toBe(1);
    expect(
      (await scans.listScans(carol, scanFilters({ q: "early blight" }))).total,
    ).toBe(5);
    expect(await scans.scannedCrops(carol)).toEqual(["Tomato"]);

    const stats = await scans.getUserStats(carol);
    expect(stats).toMatchObject({
      total: 6,
      healthy: 1,
      diseased: 5,
      last30Days: 6,
    });
    expect(stats.weekly).toHaveLength(8);
    expect(stats.weekly.at(-1)?.count).toBe(6);
    expect(stats.topConditions[0]).toMatchObject({
      className: "Tomato___Early_blight",
      count: 5,
    });
  });

  it("deletes everything for a user and nothing for anyone else", async () => {
    const dave = "dddddddddddddddddddddddd";
    await save(dave);
    await save(dave);
    const keep = await save(alice);

    expect(await scans.deleteAllScansForUser(dave)).toBe(2);
    expect(await scans.countScans(dave)).toBe(0);
    expect(await scans.getScan(alice, keep)).not.toBeNull();
  });

  it("rate-limits within a window and resets in the next", async () => {
    const t0 = Date.UTC(2026, 0, 1, 12, 0, 0);
    const results = [];
    for (let i = 0; i < 4; i++)
      results.push(await consumeRateLimit("test:burst", 3, 60, t0 + i));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3].retryAfter).toBeGreaterThan(0);

    const nextWindow = await consumeRateLimit("test:burst", 3, 60, t0 + 61_000);
    expect(nextWindow.allowed).toBe(true);
  });
});

function scanFilters(
  partial: Partial<{ q: string; status: "all" | "healthy" | "diseased" }>,
) {
  return {
    status: "all" as const,
    sort: "newest" as const,
    page: 1,
    ...partial,
  };
}
