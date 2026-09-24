import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  passwordResetEmail,
  verificationEmail,
} from "./email-templates";

describe("email templates", () => {
  it("escapes user-controlled text in HTML", () => {
    const message = verificationEmail({
      to: "a@example.com",
      name: '<img src=x onerror="alert(1)">',
      url: "https://plantguard.example/api/auth/verify-email?token=abc",
      appName: "PlantGuard",
    });
    expect(message.html).not.toContain("<img src=x");
    expect(message.html).toContain("&lt;img");
  });

  it("escapes the link in attributes", () => {
    const message = passwordResetEmail({
      to: "a@example.com",
      url: 'https://x.example/reset?a=1&b="2"',
      appName: "PlantGuard",
    });
    expect(message.html).toContain(
      'href="https://x.example/reset?a=1&amp;b=&quot;2&quot;"',
    );
  });

  it("includes the raw link in the plain-text part", () => {
    const url =
      "https://plantguard.example/reset-password/tok?callbackURL=%2Freset-password";
    const message = passwordResetEmail({
      to: "a@example.com",
      url,
      appName: "PlantGuard",
    });
    expect(message.text).toContain(url);
    expect(message.subject).toMatch(/password/i);
  });

  it("greets by first name only", () => {
    const message = verificationEmail({
      to: "a@example.com",
      name: "Lakshmi Narayanan",
      url: "https://x.example",
      appName: "PlantGuard",
    });
    expect(message.text).toContain("Hi Lakshmi,");
  });
});

describe("escapeHtml", () => {
  it("escapes all five special characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
