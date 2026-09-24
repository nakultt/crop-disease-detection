import { describe, expect, it } from "vitest";
import {
  AUTH_PREFIXES,
  matchesPrefix,
  PROTECTED_PREFIXES,
  safeReturnPath,
} from "./routes";

describe("safeReturnPath", () => {
  it("keeps same-site paths", () => {
    expect(safeReturnPath("/history?crop=Tomato")).toBe("/history?crop=Tomato");
    expect(safeReturnPath("/history/abc#notes")).toBe("/history/abc#notes");
  });

  it("refuses anything that could leave the site", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "evil.example",
      "/ok\r\nSet-Cookie: x=y",
    ]) {
      expect(safeReturnPath(value)).toBe("/dashboard");
    }
  });

  it("does not bounce back into the auth screens", () => {
    expect(safeReturnPath("/sign-in")).toBe("/dashboard");
    expect(safeReturnPath("/verify-email/complete?x=1")).toBe("/dashboard");
  });

  it("defaults when empty", () => {
    expect(safeReturnPath(undefined)).toBe("/dashboard");
    expect(safeReturnPath("")).toBe("/dashboard");
  });
});

describe("matchesPrefix", () => {
  it("matches a path and its children only", () => {
    expect(matchesPrefix("/history", PROTECTED_PREFIXES)).toBe(true);
    expect(matchesPrefix("/history/123", PROTECTED_PREFIXES)).toBe(true);
    expect(matchesPrefix("/historyx", PROTECTED_PREFIXES)).toBe(false);
    expect(matchesPrefix("/about", PROTECTED_PREFIXES)).toBe(false);
    expect(matchesPrefix("/reset-password", AUTH_PREFIXES)).toBe(true);
  });
});
