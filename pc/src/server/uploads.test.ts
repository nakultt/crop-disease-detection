import { describe, expect, it } from "vitest";
import { TINY_JPEG } from "@/test/fixtures";
import {
  PayloadTooLargeError,
  readBodyLimited,
  sniffImageType,
} from "./uploads";

describe("sniffImageType", () => {
  it("recognises JPEG, PNG and WebP by their bytes", () => {
    expect(sniffImageType(TINY_JPEG)).toBe("image/jpeg");
    expect(
      sniffImageType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      ),
    ).toBe("image/png");
    expect(sniffImageType(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))).toBe(
      "image/webp",
    );
  });

  it("rejects anything else, whatever it claims to be", () => {
    expect(sniffImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("readBodyLimited", () => {
  const stream = (chunks: number[]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const size of chunks) controller.enqueue(new Uint8Array(size));
        controller.close();
      },
    });

  it("reads a body under the limit", async () => {
    const request = new Request("http://x/", {
      method: "POST",
      body: stream([10, 20]),
      duplex: "half",
    } as RequestInit);
    expect((await readBodyLimited(request, 100)).length).toBe(30);
  });

  it("stops reading as soon as the limit is crossed, even without Content-Length", async () => {
    const request = new Request("http://x/", {
      method: "POST",
      body: stream([60, 60, 60]),
      duplex: "half",
    } as RequestInit);
    await expect(readBodyLimited(request, 100)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });

  it("trusts a declared Content-Length that is already too big", async () => {
    const request = new Request("http://x/", {
      method: "POST",
      body: "small",
      headers: { "content-length": "999999" },
    });
    await expect(readBodyLimited(request, 100)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });
});
