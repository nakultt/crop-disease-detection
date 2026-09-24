import { describe, expect, it } from "vitest";
import { shippedManifest } from "@/test/fixtures";
import { translate } from "./i18n/dictionary";
import en from "./i18n/locales/en";
import type { Translate } from "./i18n/types";
import { classLabel, conditionLabel, cropLabel } from "./labels";
import { hasSpecificAdvice, recommendationKeys } from "./recommendations";

const t: Translate = (key, ...args) => translate(en, key, args);
const manifest = shippedManifest();
const diseaseClasses = manifest.classes.disease.filter(
  (c) => !c.toLowerCase().includes("healthy"),
);

describe("labels", () => {
  it.each(manifest.classes.disease)(
    "has a translatable crop and condition for %s",
    (className) => {
      // A missing mapping falls back to the raw identifier text; a real label
      // never contains underscores.
      expect(cropLabel(className, t)).not.toMatch(/_/);
      expect(conditionLabel(className, t)).not.toMatch(/_/);
    },
  );

  it("formats a class as crop · condition", () => {
    expect(classLabel("Tomato___Early_blight", t)).toBe(
      "Tomato · Early blight",
    );
    expect(classLabel("Corn_(maize)___healthy", t)).toBe(
      "Maize (corn) · Healthy",
    );
  });

  it("falls back to English derived from the identifier for unknown classes", () => {
    expect(classLabel("Mango___Anthracnose", t)).toBe("Mango · Anthracnose");
  });
});

describe("recommendations", () => {
  it.each(diseaseClasses)(
    "gives disease-specific advice for %s",
    (className) => {
      expect(hasSpecificAdvice(className)).toBe(true);
    },
  );

  it("adds severity advice after the disease-specific tips", () => {
    const keys = recommendationKeys("Tomato___Late_blight", "Critical").map(
      (r) => r.key,
    );
    expect(
      keys.slice(0, 4).every((k) => k.startsWith("rec.tomatoLateBlight")),
    ).toBe(true);
    expect(keys).toContain("rec.critical.1");
  });

  it("marks urgency from severity", () => {
    expect(
      recommendationKeys("Potato___Early_blight", "Severe")[0].urgency,
    ).toBe("critical");
    expect(recommendationKeys("Potato___Early_blight", "Mild")[0].urgency).toBe(
      "info",
    );
  });

  it("uses care advice for healthy leaves", () => {
    const keys = recommendationKeys("Tomato___healthy", "Critical").map(
      (r) => r.key,
    );
    expect(keys.every((k) => k.startsWith("rec.healthy"))).toBe(true);
  });

  it("falls back to a single consult-an-expert tip", () => {
    expect(recommendationKeys("Mango___Anthracnose", "")).toEqual([
      { key: "rec.fallback", urgency: "warning" },
    ]);
  });
});
