/**
 * Treatment recommendations keyed by disease class and severity level.
 */

import { isHealthy } from "./labels";

const DISEASE_RECOMMENDATIONS: Record<string, string[]> = {
  "Apple___Apple_scab": [
    "Apply fungicide containing captan or myclobutanil.",
    "Rake and destroy fallen leaves in autumn.",
    "Prune trees to improve air circulation.",
  ],
  "Apple___Black_rot": [
    "Remove mummified fruits and cankers.",
    "Apply fungicide during early bloom.",
    "Maintain tree vigor with proper fertilization.",
  ],
  "Apple___Cedar_apple_rust": [
    "Apply fungicide at pink bud stage.",
    "Remove nearby juniper/cedar trees if possible.",
    "Use resistant apple varieties.",
  ],
  "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": [
    "Apply foliar fungicide (strobilurin or triazole).",
    "Rotate crops away from corn for 1–2 years.",
    "Improve field drainage and air flow.",
  ],
  "Corn_(maize)___Common_rust_": [
    "Apply foliar fungicide if infection is early.",
    "Use resistant corn varieties in future plantings.",
    "Monitor humidity – rust thrives in moist conditions.",
  ],
  "Corn_(maize)___Northern_Leaf_Blight": [
    "Apply fungicide at early infection stages.",
    "Plant resistant hybrids.",
    "Practice crop rotation with non-host crops.",
  ],
  "Grape___Black_rot": [
    "Apply mancozeb or myclobutanil fungicide.",
    "Remove mummified berries and infected canes.",
    "Prune for good air circulation.",
  ],
  "Grape___Esca_(Black_Measles)": [
    "No known cure – manage through pruning.",
    "Remove and destroy infected wood.",
    "Apply wound protectants after pruning.",
  ],
  "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": [
    "Apply copper-based fungicide.",
    "Remove infected leaves promptly.",
    "Ensure good canopy management.",
  ],
  "Orange___Haunglongbing_(Citrus_greening)": [
    "No known cure – manage psyllid vector.",
    "Apply systemic insecticide for psyllid control.",
    "Remove and destroy severely infected trees.",
    "Use certified disease-free nursery stock.",
  ],
  "Peach___Bacterial_spot": [
    "Apply copper-based bactericide in dormant season.",
    "Use resistant peach varieties.",
    "Avoid overhead irrigation.",
  ],
  "Pepper,_bell___Bacterial_spot": [
    "Apply copper-based bactericide.",
    "Use disease-free seeds and transplants.",
    "Rotate crops for 2–3 years.",
  ],
  "Potato___Early_blight": [
    "Apply chlorothalonil or mancozeb fungicide.",
    "Maintain proper plant nutrition.",
    "Remove and destroy infected plant debris.",
  ],
  "Potato___Late_blight": [
    "Apply systemic fungicide (metalaxyl + mancozeb).",
    "Destroy infected tubers and plant debris.",
    "Use certified disease-free seed potatoes.",
    "Ensure good field drainage.",
  ],
  "Squash___Powdery_mildew": [
    "Apply sulfur or potassium bicarbonate fungicide.",
    "Improve air circulation between plants.",
    "Water at base of plant, avoid wetting foliage.",
  ],
  "Strawberry___Leaf_scorch": [
    "Remove and destroy infected leaves.",
    "Apply fungicide during early season.",
    "Ensure proper plant spacing.",
  ],
  "Tomato___Bacterial_spot": [
    "Apply copper-based bactericide.",
    "Use disease-free seeds and transplants.",
    "Avoid working with wet plants.",
  ],
  "Tomato___Early_blight": [
    "Apply chlorothalonil or copper-based fungicide.",
    "Mulch around plants to prevent soil splash.",
    "Rotate crops – avoid same spot for 2 years.",
  ],
  "Tomato___Late_blight": [
    "Apply fungicide immediately (chlorothalonil or mancozeb).",
    "Remove and destroy all infected plant material.",
    "Do NOT compost infected plants.",
    "Avoid overhead irrigation.",
  ],
  "Tomato___Leaf_Mold": [
    "Improve greenhouse ventilation.",
    "Apply fungicide if severe.",
    "Reduce humidity around plants.",
  ],
  "Tomato___Septoria_leaf_spot": [
    "Apply chlorothalonil or mancozeb fungicide.",
    "Remove lower infected leaves.",
    "Avoid overhead watering.",
  ],
  "Tomato___Spider_mites Two-spotted_spider_mite": [
    "Apply miticide or insecticidal soap.",
    "Spray plants with strong water jet to dislodge mites.",
    "Introduce predatory mites as biological control.",
  ],
  "Tomato___Target_Spot": [
    "Apply chlorothalonil fungicide.",
    "Improve air circulation.",
    "Remove infected lower leaves.",
  ],
  "Tomato___Tomato_Yellow_Leaf_Curl_Virus": [
    "No chemical cure – manage whitefly vector.",
    "Use insecticide for whitefly control.",
    "Remove and destroy infected plants early.",
    "Use resistant tomato varieties.",
  ],
  "Tomato___Tomato_mosaic_virus": [
    "No chemical cure available.",
    "Remove and destroy infected plants.",
    "Disinfect tools between plants.",
    "Wash hands before handling healthy plants.",
  ],
  "Cherry_(including_sour)___Powdery_mildew": [
    "Apply sulfur-based fungicide.",
    "Prune to improve air circulation.",
    "Remove fallen infected leaves.",
  ],
};

const SEVERITY_ADVICE: Record<string, string[]> = {
  Mild: [
    "Monitor the plant closely for progression.",
    "Ensure proper spacing for air circulation.",
  ],
  Moderate: [
    "Apply appropriate treatment promptly.",
    "Remove heavily affected leaves.",
    "Improve drainage and reduce overhead watering.",
  ],
  Severe: [
    "Immediately apply targeted treatment.",
    "Prune and destroy all infected plant parts.",
    "Isolate affected plants to prevent spread.",
  ],
  Critical: [
    "Urgently apply systemic treatment.",
    "Consider removing the entire plant to prevent spread.",
    "Seek professional agricultural advice immediately.",
  ],
};

export interface Recommendation {
  text: string;
  urgency: "info" | "warning" | "critical";
}

export function getRecommendations(
  diseaseClass: string,
  severity: string
): Recommendation[] {
  if (isHealthy(diseaseClass)) {
    return [
      { text: "Plant appears healthy! Continue regular care.", urgency: "info" },
      {
        text: "Maintain proper watering and fertilization schedule.",
        urgency: "info",
      },
      {
        text: "Monitor periodically for early signs of disease.",
        urgency: "info",
      },
    ];
  }

  const urgencyMap: Record<string, "info" | "warning" | "critical"> = {
    Mild: "info",
    Moderate: "warning",
    Severe: "critical",
    Critical: "critical",
  };
  const baseUrgency = urgencyMap[severity] || "info";

  const recommendations: Recommendation[] = [];

  // Disease-specific recommendations
  const diseaseRecs = DISEASE_RECOMMENDATIONS[diseaseClass];
  if (diseaseRecs) {
    for (const rec of diseaseRecs) {
      recommendations.push({ text: rec, urgency: baseUrgency });
    }
  }

  // Severity-based general advice
  const severityRecs = SEVERITY_ADVICE[severity];
  if (severityRecs) {
    for (const rec of severityRecs) {
      recommendations.push({ text: rec, urgency: baseUrgency });
    }
  }

  // Fallback
  if (recommendations.length === 0) {
    recommendations.push({
      text: "Consult a local agricultural expert for specific treatment advice.",
      urgency: "warning",
    });
  }

  return recommendations;
}
