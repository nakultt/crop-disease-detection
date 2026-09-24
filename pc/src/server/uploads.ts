import "server-only";
import type { ImageType } from "@/app/lib/scan-contract";

/**
 * Request-body handling for uploads.
 *
 * `request.formData()` buffers whatever the client sends, and a missing or
 * lying Content-Length does not stop it. The body is read here with a hard
 * byte cap first, so an oversized upload is cut off mid-stream instead of
 * filling memory.
 */

export class PayloadTooLargeError extends Error {
  constructor(message = "The upload is too large.") {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export class MalformedUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedUploadError";
  }
}

export async function readBodyLimited(
  request: Request,
  maxBytes: number,
): Promise<Buffer> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new PayloadTooLargeError();
  }
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks, total);
}

export async function parseMultipart(
  request: Request,
  maxBytes: number,
): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new MalformedUploadError("Expected multipart/form-data.");
  }

  const body = await readBodyLimited(request, maxBytes);
  try {
    return await new Response(new Uint8Array(body), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new MalformedUploadError("The upload could not be parsed.");
  }
}

/** A file field as bytes, or `null` when absent. */
export async function readFilePart(
  value: FormDataEntryValue | null,
  maxBytes: number,
  field: string,
): Promise<Buffer | null> {
  if (value === null) return null;
  if (typeof value === "string") {
    throw new MalformedUploadError(`"${field}" must be a file.`);
  }
  if (value.size > maxBytes) {
    throw new PayloadTooLargeError(
      `"${field}" is larger than ${maxBytes} bytes.`,
    );
  }
  return Buffer.from(await value.arrayBuffer());
}

/**
 * Identify an image by its magic bytes. The declared MIME type is ignored:
 * it is whatever the client says, and the stored type decides the
 * Content-Type these bytes are later served with.
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
