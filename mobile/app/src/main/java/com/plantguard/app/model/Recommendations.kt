package com.plantguard.app.model

/**
 * Treatment guidance, keyed by disease class and severity.
 *
 * Generated from the same table the web app uses
 * (`pc/src/app/lib/recommendations.ts`) so both clients give identical advice
 * for identical predictions. Update both together, or neither.
 */
object Recommendations {

    enum class Urgency { INFO, WARNING, CRITICAL }

    data class Advice(val text: String, val urgency: Urgency)

    private val DISEASE_ADVICE: Map<String, List<String>> = mapOf(
        "Apple___Apple_scab" to listOf(
            "Apply fungicide containing captan or myclobutanil.",
            "Rake and destroy fallen leaves in autumn.",
            "Prune trees to improve air circulation.",
        ),
        "Apple___Black_rot" to listOf(
            "Remove mummified fruits and cankers.",
            "Apply fungicide during early bloom.",
            "Maintain tree vigor with proper fertilization.",
        ),
        "Apple___Cedar_apple_rust" to listOf(
            "Apply fungicide at pink bud stage.",
            "Remove nearby juniper/cedar trees if possible.",
            "Use resistant apple varieties.",
        ),
        "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot" to listOf(
            "Apply foliar fungicide (strobilurin or triazole).",
            "Rotate crops away from corn for 1–2 years.",
            "Improve field drainage and air flow.",
        ),
        "Corn_(maize)___Common_rust_" to listOf(
            "Apply foliar fungicide if infection is early.",
            "Use resistant corn varieties in future plantings.",
            "Monitor humidity – rust thrives in moist conditions.",
        ),
        "Corn_(maize)___Northern_Leaf_Blight" to listOf(
            "Apply fungicide at early infection stages.",
            "Plant resistant hybrids.",
            "Practice crop rotation with non-host crops.",
        ),
        "Grape___Black_rot" to listOf(
            "Apply mancozeb or myclobutanil fungicide.",
            "Remove mummified berries and infected canes.",
            "Prune for good air circulation.",
        ),
        "Grape___Esca_(Black_Measles)" to listOf(
            "No known cure – manage through pruning.",
            "Remove and destroy infected wood.",
            "Apply wound protectants after pruning.",
        ),
        "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)" to listOf(
            "Apply copper-based fungicide.",
            "Remove infected leaves promptly.",
            "Ensure good canopy management.",
        ),
        "Orange___Haunglongbing_(Citrus_greening)" to listOf(
            "No known cure – manage psyllid vector.",
            "Apply systemic insecticide for psyllid control.",
            "Remove and destroy severely infected trees.",
            "Use certified disease-free nursery stock.",
        ),
        "Peach___Bacterial_spot" to listOf(
            "Apply copper-based bactericide in dormant season.",
            "Use resistant peach varieties.",
            "Avoid overhead irrigation.",
        ),
        "Pepper,_bell___Bacterial_spot" to listOf(
            "Apply copper-based bactericide.",
            "Use disease-free seeds and transplants.",
            "Rotate crops for 2–3 years.",
        ),
        "Potato___Early_blight" to listOf(
            "Apply chlorothalonil or mancozeb fungicide.",
            "Maintain proper plant nutrition.",
            "Remove and destroy infected plant debris.",
        ),
        "Potato___Late_blight" to listOf(
            "Apply systemic fungicide (metalaxyl + mancozeb).",
            "Destroy infected tubers and plant debris.",
            "Use certified disease-free seed potatoes.",
            "Ensure good field drainage.",
        ),
        "Squash___Powdery_mildew" to listOf(
            "Apply sulfur or potassium bicarbonate fungicide.",
            "Improve air circulation between plants.",
            "Water at base of plant, avoid wetting foliage.",
        ),
        "Strawberry___Leaf_scorch" to listOf(
            "Remove and destroy infected leaves.",
            "Apply fungicide during early season.",
            "Ensure proper plant spacing.",
        ),
        "Tomato___Bacterial_spot" to listOf(
            "Apply copper-based bactericide.",
            "Use disease-free seeds and transplants.",
            "Avoid working with wet plants.",
        ),
        "Tomato___Early_blight" to listOf(
            "Apply chlorothalonil or copper-based fungicide.",
            "Mulch around plants to prevent soil splash.",
            "Rotate crops – avoid same spot for 2 years.",
        ),
        "Tomato___Late_blight" to listOf(
            "Apply fungicide immediately (chlorothalonil or mancozeb).",
            "Remove and destroy all infected plant material.",
            "Do NOT compost infected plants.",
            "Avoid overhead irrigation.",
        ),
        "Tomato___Leaf_Mold" to listOf(
            "Improve greenhouse ventilation.",
            "Apply fungicide if severe.",
            "Reduce humidity around plants.",
        ),
        "Tomato___Septoria_leaf_spot" to listOf(
            "Apply chlorothalonil or mancozeb fungicide.",
            "Remove lower infected leaves.",
            "Avoid overhead watering.",
        ),
        "Tomato___Spider_mites Two-spotted_spider_mite" to listOf(
            "Apply miticide or insecticidal soap.",
            "Spray plants with strong water jet to dislodge mites.",
            "Introduce predatory mites as biological control.",
        ),
        "Tomato___Target_Spot" to listOf(
            "Apply chlorothalonil fungicide.",
            "Improve air circulation.",
            "Remove infected lower leaves.",
        ),
        "Tomato___Tomato_Yellow_Leaf_Curl_Virus" to listOf(
            "No chemical cure – manage whitefly vector.",
            "Use insecticide for whitefly control.",
            "Remove and destroy infected plants early.",
            "Use resistant tomato varieties.",
        ),
        "Tomato___Tomato_mosaic_virus" to listOf(
            "No chemical cure available.",
            "Remove and destroy infected plants.",
            "Disinfect tools between plants.",
            "Wash hands before handling healthy plants.",
        ),
        "Cherry_(including_sour)___Powdery_mildew" to listOf(
            "Apply sulfur-based fungicide.",
            "Prune to improve air circulation.",
            "Remove fallen infected leaves.",
        ),
    )

    private val SEVERITY_ADVICE: Map<String, List<String>> = mapOf(
        "Mild" to listOf(
            "Monitor the plant closely for progression.",
            "Ensure proper spacing for air circulation.",
        ),
        "Moderate" to listOf(
            "Apply appropriate treatment promptly.",
            "Remove heavily affected leaves.",
            "Improve drainage and reduce overhead watering.",
        ),
        "Severe" to listOf(
            "Immediately apply targeted treatment.",
            "Prune and destroy all infected plant parts.",
            "Isolate affected plants to prevent spread.",
        ),
        "Critical" to listOf(
            "Urgently apply systemic treatment.",
            "Consider removing the entire plant to prevent spread.",
            "Seek professional agricultural advice immediately.",
        ),
    )

    private val HEALTHY_ADVICE = listOf(
        "Plant appears healthy. Continue regular care.",
        "Maintain a consistent watering and fertilisation schedule.",
        "Check periodically for early signs of disease.",
    )

    /**
     * Advice for a prediction. Never returns an empty list: an unrecognised
     * class still yields a sensible "consult someone local" fallback rather
     * than an empty panel.
     */
    fun forPrediction(
        diseaseClass: String,
        severity: String,
        isHealthy: Boolean,
    ): List<Advice> {
        if (isHealthy) return HEALTHY_ADVICE.map { Advice(it, Urgency.INFO) }

        val urgency = when (severity) {
            "Mild" -> Urgency.INFO
            "Moderate" -> Urgency.WARNING
            "Severe", "Critical" -> Urgency.CRITICAL
            else -> Urgency.INFO
        }

        val advice = buildList {
            DISEASE_ADVICE[diseaseClass]?.forEach { add(Advice(it, urgency)) }
            SEVERITY_ADVICE[severity]?.forEach { add(Advice(it, urgency)) }
        }

        return advice.ifEmpty {
            listOf(
                Advice(
                    "Consult a local agricultural extension service for treatment advice.",
                    Urgency.WARNING,
                ),
            )
        }
    }
}
