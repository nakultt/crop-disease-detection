import { describe, expect, it } from "vitest";
import { displayIp, summarizeUserAgent } from "./user-agent";

describe("summarizeUserAgent", () => {
  it("names common browsers and systems", () => {
    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
      ),
    ).toEqual({ browser: "Chrome", os: "Android", mobile: true });

    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0",
      ),
    ).toEqual({ browser: "Edge", os: "Windows", mobile: false });

    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toMatchObject({ browser: "Safari", os: "iOS", mobile: true });
  });

  it("degrades gracefully", () => {
    expect(summarizeUserAgent(null)).toEqual({
      browser: "Browser",
      os: "Unknown device",
      mobile: false,
    });
  });
});

describe("displayIp", () => {
  it("shortens IPv6", () => {
    expect(displayIp("2001:0db8:0000:0000:0000:ff00:0042:8329")).toBe(
      "2001:db8::ff00:42:8329",
    );
    expect(displayIp("2401:4900:1c2a:5d10:0000:0000:0000:0000")).toBe(
      "2401:4900:1c2a:5d10::",
    );
  });

  it("keeps IPv4", () => {
    expect(displayIp("203.0.113.9")).toBe("203.0.113.9");
  });

  it("hides loopback and unspecified addresses", () => {
    expect(displayIp("0000:0000:0000:0000:0000:0000:0000:0000")).toBeNull();
    expect(displayIp("::1")).toBeNull();
    expect(displayIp("127.0.0.1")).toBeNull();
    expect(displayIp(null)).toBeNull();
  });
});
