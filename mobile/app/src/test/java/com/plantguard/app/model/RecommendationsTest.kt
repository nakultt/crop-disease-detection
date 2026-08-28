package com.plantguard.app.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Treatment guidance.
 *
 * The table is generated from the web app's, so these assertions also guard
 * against the two drifting apart: a prediction must never produce advice on one
 * platform and an empty panel on the other.
 */
class RecommendationsTest {

    private val severityLevels = listOf("Mild", "Moderate", "Severe", "Critical")

    /** The 38 PlantVillage classes, in model-output order. */
    private val diseaseClasses = listOf(
        "Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust",
        "Apple___healthy", "Blueberry___healthy",
        "Cherry_(including_sour)___Powdery_mildew", "Cherry_(including_sour)___healthy",
        "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
        "Corn_(maize)___Common_rust_", "Corn_(maize)___Northern_Leaf_Blight",
        "Corn_(maize)___healthy", "Grape___Black_rot", "Grape___Esca_(Black_Measles)",
        "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)", "Grape___healthy",
        "Orange___Haunglongbing_(Citrus_greening)", "Peach___Bacterial_spot",
        "Peach___healthy", "Pepper,_bell___Bacterial_spot", "Pepper,_bell___healthy",
        "Potato___Early_blight", "Potato___Late_blight", "Potato___healthy",
        "Raspberry___healthy", "Soybean___healthy", "Squash___Powdery_mildew",
        "Strawberry___Leaf_scorch", "Strawberry___healthy", "Tomato___Bacterial_spot",
        "Tomato___Early_blight", "Tomato___Late_blight", "Tomato___Leaf_Mold",
        "Tomato___Septoria_leaf_spot", "Tomato___Spider_mites Two-spotted_spider_mite",
        "Tomato___Target_Spot", "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
        "Tomato___Tomato_mosaic_virus", "Tomato___healthy",
    )

    @Test
    fun `every class and severity pair yields advice`() {
        for (disease in diseaseClasses) {
            val healthy = disease.contains("healthy", ignoreCase = true)
            for (severity in severityLevels) {
                val advice = Recommendations.forPrediction(disease, severity, healthy)
                assertTrue(
                    "no advice for $disease at $severity",
                    advice.isNotEmpty(),
                )
                assertTrue(
                    "blank advice line for $disease at $severity",
                    advice.all { it.text.isNotBlank() },
                )
            }
        }
    }

    @Test
    fun `healthy plants get care advice, not treatment`() {
        val advice = Recommendations.forPrediction("Tomato___healthy", "Mild", true)
        assertTrue(advice.all { it.urgency == Recommendations.Urgency.INFO })
        assertTrue(advice.any { it.text.contains("healthy", ignoreCase = true) })
    }

    @Test
    fun `urgency escalates with severity`() {
        val disease = "Tomato___Late_blight"
        assertEquals(
            Recommendations.Urgency.INFO,
            Recommendations.forPrediction(disease, "Mild", false).first().urgency,
        )
        assertEquals(
            Recommendations.Urgency.WARNING,
            Recommendations.forPrediction(disease, "Moderate", false).first().urgency,
        )
        assertEquals(
            Recommendations.Urgency.CRITICAL,
            Recommendations.forPrediction(disease, "Severe", false).first().urgency,
        )
        assertEquals(
            Recommendations.Urgency.CRITICAL,
            Recommendations.forPrediction(disease, "Critical", false).first().urgency,
        )
    }

    @Test
    fun `an unrecognised class still gets severity-appropriate advice`() {
        // No entry in the disease table, but a known severity: the generic
        // severity guidance applies and is more useful than a bare fallback.
        val advice = Recommendations.forPrediction("Kiwi___Some_new_blight", "Severe", false)
        assertTrue(advice.isNotEmpty())
        assertTrue(advice.all { it.urgency == Recommendations.Urgency.CRITICAL })
    }

    @Test
    fun `an unrecognised class and severity falls back to consulting an expert`() {
        // Both lookups miss, so the only honest answer is to send the user to
        // someone who can actually identify it.
        val advice = Recommendations.forPrediction("Kiwi___Some_new_blight", "Unknown", false)
        assertEquals(1, advice.size)
        assertTrue(advice.single().text.contains("extension service", ignoreCase = true))
    }

    @Test
    fun `disease-specific advice precedes generic severity advice`() {
        // The most actionable line should be first; generic "isolate the plant"
        // guidance is a poor headline when a named fungicide applies.
        val advice = Recommendations.forPrediction("Tomato___Late_blight", "Severe", false)
        assertTrue(advice.size > 1)
        assertTrue(
            "expected a named treatment first, got '${advice.first().text}'",
            advice.first().text.contains("fungicide", ignoreCase = true) ||
                advice.first().text.contains("chlorothalonil", ignoreCase = true) ||
                advice.first().text.contains("mancozeb", ignoreCase = true),
        )
    }
}
