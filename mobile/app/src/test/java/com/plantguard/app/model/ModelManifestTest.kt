package com.plantguard.app.model

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Manifest parsing and validation.
 *
 * A malformed manifest yields silently wrong predictions -- wrong normalisation
 * shifts every logit, a stale class list mislabels every diagnosis -- so the
 * parser must reject rather than fill in defaults. These mirror
 * `pc/src/app/lib/manifest.test.ts` so both clients agree on what is valid.
 */
class ModelManifestTest {

    private fun validJson(mutate: JSONObject.() -> Unit = {}): JSONObject {
        val json = JSONObject(
            """
            {
              "schemaVersion": 1,
              "modelVersion": "2026-08-28T12:00:00Z",
              "backbone": "mobilenetv4_conv_small.e2400_r224_in1k",
              "trained": true,
              "precision": "fp32",
              "sizeBytes": 10171239,
              "input": {
                "name": "input", "size": 256, "layout": "NCHW",
                "mean": [0.485, 0.456, 0.406],
                "std": [0.229, 0.224, 0.225]
              },
              "outputs": {
                "disease": "disease_logits", "severity": "severity_logits",
                "diseaseCam": "disease_cam", "severityCam": "severity_cam"
              },
              "cam": { "grid": [8, 8], "exact": true, "method": "CAM" },
              "classes": {
                "disease": ["Tomato___Late_blight", "Tomato___healthy"],
                "severity": ["Mild", "Moderate", "Severe", "Critical"]
              },
              "severityRanges": { "Mild": "0-25%" },
              "metrics": {
                "diseaseAccuracy": 0.9696, "diseaseMacroF1": 0.9594,
                "severityAccuracy": 0.8249, "severityMacroF1": 0.7806,
                "evaluatedOn": "test", "numSamples": 8146
              }
            }
            """.trimIndent(),
        )
        json.mutate()
        return json
    }

    @Test
    fun `parses a well-formed manifest`() {
        val manifest = ModelManifest.parse(validJson())
        assertEquals(256, manifest.inputSize)
        assertEquals(8 to 8, manifest.camGrid)
        assertTrue(manifest.camExact)
        assertEquals(2, manifest.diseaseClasses.size)
        assertEquals("disease_cam", manifest.diseaseCamOutput)
    }

    @Test
    fun `reads metrics when present`() {
        val metrics = ModelManifest.parse(validJson()).metrics
        assertNotNull(metrics)
        assertEquals(0.9696, metrics!!.diseaseAccuracy, 1e-6)
        assertEquals(8146, metrics.numSamples)
    }

    @Test
    fun `treats an absent metrics block as null`() {
        val manifest = ModelManifest.parse(validJson { remove("metrics") })
        assertEquals(null, manifest.metrics)
    }

    @Test(expected = ModelUnavailableException::class)
    fun `rejects a future schema version instead of guessing`() {
        ModelManifest.parse(validJson { put("schemaVersion", 2) })
    }

    @Test(expected = ModelUnavailableException::class)
    fun `rejects a zero in std, which would divide by zero`() {
        ModelManifest.parse(
            validJson {
                getJSONObject("input").put("std", org.json.JSONArray(listOf(0.229, 0.0, 0.225)))
            },
        )
    }

    @Test
    fun `carries a setup hint so the UI can say what to run`() {
        try {
            ModelManifest.parse(validJson { put("schemaVersion", 9) })
            throw AssertionError("expected ModelUnavailableException")
        } catch (e: ModelUnavailableException) {
            assertNotNull(e.hint)
        }
    }

    @Test
    fun `treats a missing trained flag as untrained`() {
        // Defaulting to trusted would let an unlabelled artifact present noise
        // as a diagnosis with no warning banner.
        val manifest = ModelManifest.parse(validJson { remove("trained") })
        assertFalse(manifest.trained)
    }

    @Test
    fun `preserves trained false from a demo export`() {
        assertFalse(ModelManifest.parse(validJson { put("trained", false) }).trained)
    }

    // --- Class name formatting ---------------------------------------------

    private val manifest = ModelManifest.parse(validJson())

    @Test
    fun `splits a class into crop and condition`() {
        assertEquals("Tomato", manifest.cropOf("Tomato___Late_blight"))
        assertEquals("Late blight", manifest.conditionOf("Tomato___Late_blight"))
    }

    @Test
    fun `strips the parenthetical from crop names`() {
        assertEquals("Cherry", manifest.cropOf("Cherry_(including_sour)___Powdery_mildew"))
        assertEquals("Corn", manifest.cropOf("Corn_(maize)___Common_rust_"))
    }

    @Test
    fun `never leaks the raw separator into display text`() {
        for (raw in listOf(
            "Tomato___Late_blight",
            "Grape___Esca_(Black_Measles)",
            "Pepper,_bell___Bacterial_spot",
        )) {
            val shown = manifest.displayName(raw)
            assertFalse("'$shown' still contains '___'", shown.contains("___"))
            assertFalse("'$shown' still contains '_'", shown.contains("_"))
        }
    }

    @Test
    fun `detects healthy classes`() {
        assertTrue(manifest.isHealthy("Tomato___healthy"))
        assertFalse(manifest.isHealthy("Tomato___Late_blight"))
    }

    @Test
    fun `handles a name with no condition segment`() {
        assertEquals("Soybean", manifest.displayName("Soybean"))
        assertEquals("Unknown", manifest.conditionOf("Soybean"))
    }
}
