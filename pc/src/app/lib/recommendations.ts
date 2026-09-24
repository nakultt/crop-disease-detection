/**
 * Treatment recommendations keyed by disease class and severity level.
 *
 * Each tip is a translation key (English text lives in `i18n/locales/en.ts`),
 * so advice reaches farmers in their own language. Listing the keys
 * explicitly, rather than building them from strings, lets the compiler catch
 * a missing tip.
 */

import type { Translate, TranslationKey } from "./i18n/types";
import { isHealthy } from "./manifest";

const DISEASE_ADVICE: Record<string, TranslationKey[]> = {
  Apple___Apple_scab: ["rec.appleScab.1", "rec.appleScab.2", "rec.appleScab.3"],
  Apple___Black_rot: [
    "rec.appleBlackRot.1",
    "rec.appleBlackRot.2",
    "rec.appleBlackRot.3",
  ],
  Apple___Cedar_apple_rust: [
    "rec.appleCedarRust.1",
    "rec.appleCedarRust.2",
    "rec.appleCedarRust.3",
  ],
  "Cherry_(including_sour)___Powdery_mildew": [
    "rec.cherryPowderyMildew.1",
    "rec.cherryPowderyMildew.2",
    "rec.cherryPowderyMildew.3",
  ],
  "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": [
    "rec.cornGrayLeafSpot.1",
    "rec.cornGrayLeafSpot.2",
    "rec.cornGrayLeafSpot.3",
  ],
  "Corn_(maize)___Common_rust_": [
    "rec.cornCommonRust.1",
    "rec.cornCommonRust.2",
    "rec.cornCommonRust.3",
  ],
  "Corn_(maize)___Northern_Leaf_Blight": [
    "rec.cornNorthernBlight.1",
    "rec.cornNorthernBlight.2",
    "rec.cornNorthernBlight.3",
  ],
  Grape___Black_rot: [
    "rec.grapeBlackRot.1",
    "rec.grapeBlackRot.2",
    "rec.grapeBlackRot.3",
  ],
  "Grape___Esca_(Black_Measles)": [
    "rec.grapeEsca.1",
    "rec.grapeEsca.2",
    "rec.grapeEsca.3",
  ],
  "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": [
    "rec.grapeLeafBlight.1",
    "rec.grapeLeafBlight.2",
    "rec.grapeLeafBlight.3",
  ],
  "Orange___Haunglongbing_(Citrus_greening)": [
    "rec.citrusGreening.1",
    "rec.citrusGreening.2",
    "rec.citrusGreening.3",
    "rec.citrusGreening.4",
  ],
  Peach___Bacterial_spot: [
    "rec.peachBacterialSpot.1",
    "rec.peachBacterialSpot.2",
    "rec.peachBacterialSpot.3",
  ],
  "Pepper,_bell___Bacterial_spot": [
    "rec.pepperBacterialSpot.1",
    "rec.pepperBacterialSpot.2",
    "rec.pepperBacterialSpot.3",
  ],
  Potato___Early_blight: [
    "rec.potatoEarlyBlight.1",
    "rec.potatoEarlyBlight.2",
    "rec.potatoEarlyBlight.3",
  ],
  Potato___Late_blight: [
    "rec.potatoLateBlight.1",
    "rec.potatoLateBlight.2",
    "rec.potatoLateBlight.3",
    "rec.potatoLateBlight.4",
  ],
  Squash___Powdery_mildew: [
    "rec.squashPowderyMildew.1",
    "rec.squashPowderyMildew.2",
    "rec.squashPowderyMildew.3",
  ],
  Strawberry___Leaf_scorch: [
    "rec.strawberryLeafScorch.1",
    "rec.strawberryLeafScorch.2",
    "rec.strawberryLeafScorch.3",
  ],
  Tomato___Bacterial_spot: [
    "rec.tomatoBacterialSpot.1",
    "rec.tomatoBacterialSpot.2",
    "rec.tomatoBacterialSpot.3",
  ],
  Tomato___Early_blight: [
    "rec.tomatoEarlyBlight.1",
    "rec.tomatoEarlyBlight.2",
    "rec.tomatoEarlyBlight.3",
  ],
  Tomato___Late_blight: [
    "rec.tomatoLateBlight.1",
    "rec.tomatoLateBlight.2",
    "rec.tomatoLateBlight.3",
    "rec.tomatoLateBlight.4",
  ],
  Tomato___Leaf_Mold: [
    "rec.tomatoLeafMold.1",
    "rec.tomatoLeafMold.2",
    "rec.tomatoLeafMold.3",
  ],
  Tomato___Septoria_leaf_spot: [
    "rec.tomatoSeptoria.1",
    "rec.tomatoSeptoria.2",
    "rec.tomatoSeptoria.3",
  ],
  "Tomato___Spider_mites Two-spotted_spider_mite": [
    "rec.tomatoSpiderMites.1",
    "rec.tomatoSpiderMites.2",
    "rec.tomatoSpiderMites.3",
  ],
  Tomato___Target_Spot: [
    "rec.tomatoTargetSpot.1",
    "rec.tomatoTargetSpot.2",
    "rec.tomatoTargetSpot.3",
  ],
  Tomato___Tomato_Yellow_Leaf_Curl_Virus: [
    "rec.tomatoYellowCurl.1",
    "rec.tomatoYellowCurl.2",
    "rec.tomatoYellowCurl.3",
    "rec.tomatoYellowCurl.4",
  ],
  Tomato___Tomato_mosaic_virus: [
    "rec.tomatoMosaic.1",
    "rec.tomatoMosaic.2",
    "rec.tomatoMosaic.3",
    "rec.tomatoMosaic.4",
  ],
};

const SEVERITY_ADVICE: Record<string, TranslationKey[]> = {
  Mild: ["rec.mild.1", "rec.mild.2"],
  Moderate: ["rec.moderate.1", "rec.moderate.2", "rec.moderate.3"],
  Severe: ["rec.severe.1", "rec.severe.2", "rec.severe.3"],
  Critical: ["rec.critical.1", "rec.critical.2", "rec.critical.3"],
};

const HEALTHY_ADVICE: TranslationKey[] = [
  "rec.healthy.1",
  "rec.healthy.2",
  "rec.healthy.3",
];

const URGENCY: Record<string, Recommendation["urgency"]> = {
  Mild: "info",
  Moderate: "warning",
  Severe: "critical",
  Critical: "critical",
};

export interface Recommendation {
  text: string;
  urgency: "info" | "warning" | "critical";
}

/** Whether a disease class has specific advice (vs. only the generic fallback). */
export function hasSpecificAdvice(diseaseClass: string): boolean {
  return diseaseClass in DISEASE_ADVICE;
}

/** The advice keys for a class, disease-specific first. */
export function recommendationKeys(
  diseaseClass: string,
  severity: string,
): { key: TranslationKey; urgency: Recommendation["urgency"] }[] {
  if (isHealthy(diseaseClass)) {
    return HEALTHY_ADVICE.map((key) => ({ key, urgency: "info" }));
  }

  const urgency = URGENCY[severity] ?? "info";
  const keys = [
    ...(DISEASE_ADVICE[diseaseClass] ?? []),
    ...(SEVERITY_ADVICE[severity] ?? []),
  ];

  if (keys.length === 0) {
    return [{ key: "rec.fallback", urgency: "warning" }];
  }
  return keys.map((key) => ({ key, urgency }));
}

export function getRecommendations(
  diseaseClass: string,
  severity: string,
  t: Translate,
): Recommendation[] {
  return recommendationKeys(diseaseClass, severity).map(({ key, urgency }) => ({
    text: t(key),
    urgency,
  }));
}
