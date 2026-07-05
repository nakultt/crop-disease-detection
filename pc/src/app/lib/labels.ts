/**
 * Disease class labels matching the training pipeline's 38 PlantVillage classes.
 * Order must match the model's output indices exactly.
 */

export const DISEASE_CLASSES = [
  "Apple___Apple_scab",
  "Apple___Black_rot",
  "Apple___Cedar_apple_rust",
  "Apple___healthy",
  "Blueberry___healthy",
  "Cherry_(including_sour)___Powdery_mildew",
  "Cherry_(including_sour)___healthy",
  "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
  "Corn_(maize)___Common_rust_",
  "Corn_(maize)___Northern_Leaf_Blight",
  "Corn_(maize)___healthy",
  "Grape___Black_rot",
  "Grape___Esca_(Black_Measles)",
  "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
  "Grape___healthy",
  "Orange___Haunglongbing_(Citrus_greening)",
  "Peach___Bacterial_spot",
  "Peach___healthy",
  "Pepper,_bell___Bacterial_spot",
  "Pepper,_bell___healthy",
  "Potato___Early_blight",
  "Potato___Late_blight",
  "Potato___healthy",
  "Raspberry___healthy",
  "Soybean___healthy",
  "Squash___Powdery_mildew",
  "Strawberry___Leaf_scorch",
  "Strawberry___healthy",
  "Tomato___Bacterial_spot",
  "Tomato___Early_blight",
  "Tomato___Late_blight",
  "Tomato___Leaf_Mold",
  "Tomato___Septoria_leaf_spot",
  "Tomato___Spider_mites Two-spotted_spider_mite",
  "Tomato___Target_Spot",
  "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
  "Tomato___Tomato_mosaic_virus",
  "Tomato___healthy",
] as const;

export const SEVERITY_CLASSES = ["Mild", "Moderate", "Severe", "Critical"] as const;

export const SEVERITY_RANGES: Record<string, string> = {
  Mild: "0–25%",
  Moderate: "26–50%",
  Severe: "51–75%",
  Critical: "76–100%",
};

export const SEVERITY_COLORS: Record<string, string> = {
  Mild: "#4ade80",
  Moderate: "#facc15",
  Severe: "#f97316",
  Critical: "#ef4444",
};

export const SEVERITY_CSS_CLASS: Record<string, string> = {
  Mild: "severity-mild",
  Moderate: "severity-moderate",
  Severe: "severity-severe",
  Critical: "severity-critical",
};

/**
 * Convert internal class name to human-readable display name.
 */
export function getDisplayName(className: string): string {
  return className.replace(/___/g, " – ").replace(/_/g, " ");
}

/**
 * Extract plant name from disease class.
 */
export function getPlantName(className: string): string {
  const parts = className.split("___");
  return parts[0].replace(/_/g, " ").replace(/,/g, ",");
}

/**
 * Check if a class represents a healthy plant.
 */
export function isHealthy(className: string): boolean {
  return className.toLowerCase().includes("healthy");
}
