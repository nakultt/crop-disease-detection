import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";

/** Must match MAIL_OUTBOX_DIR in playwright.config.ts. */
export const OUTBOX = path.resolve(__dirname, "../.e2e-outbox");

export const PASSWORD = "leaf-spot-2026!";

export function uniqueEmail(): string {
  return `e2e-${randomUUID().slice(0, 8)}@example.com`;
}

interface OutboxMessage {
  to: string;
  subject: string;
  text: string;
  date: string;
}

/** Wait for the newest email to `to` whose text contains `marker`, and return its link. */
export async function linkFromEmail(
  to: string,
  marker: string,
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = await readdir(OUTBOX).catch(() => [] as string[]);
    const messages: OutboxMessage[] = [];
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      messages.push(
        JSON.parse(await readFile(path.join(OUTBOX, file), "utf8")),
      );
    }
    const match = messages
      .filter((m) => m.to === to && m.text.includes(marker))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const link = match?.text.match(/https?:\/\/\S+/)?.[0];
    if (link) return link;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`No email containing "${marker}" arrived for ${to}`);
}

export async function signUpAndVerify(
  page: Page,
  email: string,
  name = "Asha Farmer",
): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email\?email=/);
  await expect(
    page.getByRole("heading", { name: "Confirm your email" }),
  ).toBeVisible();

  const link = await linkFromEmail(email, "verify-email");
  await page.goto(link);
  await expect(page).toHaveURL(/\/dashboard/);
}

// --- A synthetic leaf photo -------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * A 256×256 PNG: a green leaf-shaped ellipse with brown lesions on a pale
 * background. Not a real disease photo — the tests check the pipeline, not
 * the model — but it exercises decoding, inference, saving and display.
 */
export function leafPng(size = 256): Buffer {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const spots = [
    [0.4, 0.42, 0.05],
    [0.58, 0.55, 0.06],
    [0.47, 0.66, 0.04],
  ];
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const inLeaf = ((u - 0.5) / 0.3) ** 2 + ((v - 0.5) / 0.42) ** 2 < 1;
      const onSpot = spots.some(
        ([sx, sy, r]) => (u - sx) ** 2 + (v - sy) ** 2 < r * r,
      );
      const [r, g, b] = !inLeaf
        ? [226, 222, 214]
        : onSpot
          ? [92, 64, 38]
          : [58, 128, 52];
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour RGB

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
