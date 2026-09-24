/**
 * Human names for model classes, in the reader's language.
 *
 * The model's class names ("Tomato___Early_blight") are identifiers, not
 * copy. These map each one to translatable crop and condition names; a class
 * a future model adds that is not listed here falls back to the English name
 * derived from the identifier, so nothing breaks — it is just untranslated.
 */

import type { Translate, TranslationKey } from "./i18n/types";
import { conditionOf, cropOf } from "./manifest";

const CROP_KEYS: Record<string, TranslationKey> = {
  Apple: "crop.apple",
  Blueberry: "crop.blueberry",
  Cherry: "crop.cherry",
  Corn: "crop.corn",
  Grape: "crop.grape",
  Orange: "crop.orange",
  Peach: "crop.peach",
  "Pepper, bell": "crop.pepper",
  Potato: "crop.potato",
  Raspberry: "crop.raspberry",
  Soybean: "crop.soybean",
  Squash: "crop.squash",
  Strawberry: "crop.strawberry",
  Tomato: "crop.tomato",
};

const CONDITION_KEYS: Record<string, TranslationKey> = {
  Apple___Apple_scab: "cond.appleScab",
  Apple___Black_rot: "cond.blackRot",
  Apple___Cedar_apple_rust: "cond.cedarAppleRust",
  "Cherry_(including_sour)___Powdery_mildew": "cond.powderyMildew",
  "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "cond.grayLeafSpot",
  "Corn_(maize)___Common_rust_": "cond.commonRust",
  "Corn_(maize)___Northern_Leaf_Blight": "cond.northernLeafBlight",
  Grape___Black_rot: "cond.blackRot",
  "Grape___Esca_(Black_Measles)": "cond.esca",
  "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "cond.leafBlight",
  "Orange___Haunglongbing_(Citrus_greening)": "cond.citrusGreening",
  Peach___Bacterial_spot: "cond.bacterialSpot",
  "Pepper,_bell___Bacterial_spot": "cond.bacterialSpot",
  Potato___Early_blight: "cond.earlyBlight",
  Potato___Late_blight: "cond.lateBlight",
  Squash___Powdery_mildew: "cond.powderyMildew",
  Strawberry___Leaf_scorch: "cond.leafScorch",
  Tomato___Bacterial_spot: "cond.bacterialSpot",
  Tomato___Early_blight: "cond.earlyBlight",
  Tomato___Late_blight: "cond.lateBlight",
  Tomato___Leaf_Mold: "cond.leafMold",
  Tomato___Septoria_leaf_spot: "cond.septoria",
  "Tomato___Spider_mites Two-spotted_spider_mite": "cond.spiderMites",
  Tomato___Target_Spot: "cond.targetSpot",
  Tomato___Tomato_Yellow_Leaf_Curl_Virus: "cond.yellowLeafCurl",
  Tomato___Tomato_mosaic_virus: "cond.mosaicVirus",
};

export function cropLabel(className: string, t: Translate): string {
  const crop = cropOf(className);
  const key = CROP_KEYS[crop];
  return key ? t(key) : crop;
}

/** The crop name alone, e.g. from a stored `disease.crop` field. */
export function cropNameLabel(crop: string, t: Translate): string {
  const key = CROP_KEYS[crop];
  return key ? t(key) : crop;
}

export function conditionLabel(className: string, t: Translate): string {
  if (className.toLowerCase().includes("healthy")) return t("cond.healthy");
  const key = CONDITION_KEYS[className];
  return key ? t(key) : conditionOf(className);
}

/** "Tomato · Early blight", localised. */
export function classLabel(className: string, t: Translate): string {
  return `${cropLabel(className, t)} · ${conditionLabel(className, t)}`;
}
