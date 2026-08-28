package com.plantguard.app

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.plantguard.app.model.HeatmapRenderer
import com.plantguard.app.model.ModelManifest
import com.plantguard.app.model.PlantDiseaseClassifier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import android.graphics.Bitmap

/**
 * On-device checks that need the real ONNX Runtime and `android.graphics`.
 *
 * Requires `model.onnx` and `model.json` in `assets/` — export them from
 * `training/` first. Run with `./gradlew connectedDebugAndroidTest`.
 */
@RunWith(AndroidJUnit4::class)
class ModelAssetTest {

    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun packageNameMatchesApplicationId() {
        assertEquals("com.plantguard.app", context.packageName)
    }

    @Test
    fun manifestLoadsFromAssets() {
        val manifest = ModelManifest.load(context)
        assertEquals(1, manifest.schemaVersion)
        assertTrue(manifest.inputSize > 0)
        assertEquals(38, manifest.diseaseClasses.size)
        assertEquals(4, manifest.severityClasses.size)
    }

    @Test
    fun classifierLoadsAndPredicts() {
        PlantDiseaseClassifier.create(context).use { classifier ->
            val size = classifier.manifest.inputSize
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
                eraseColor(android.graphics.Color.rgb(110, 150, 90))
            }

            val prediction = classifier.predict(bitmap)

            assertNotNull(prediction.diseaseClass)
            assertTrue(prediction.diseaseConfidence in 0f..1f)
            assertEquals(5, prediction.topDiseases.size)
            assertEquals(4, prediction.severityDistribution.size)
        }
    }

    @Test
    fun probabilitiesSumToOne() {
        PlantDiseaseClassifier.create(context).use { classifier ->
            val size = classifier.manifest.inputSize
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val prediction = classifier.predict(bitmap)

            val severitySum = prediction.severityDistribution.sumOf { it.probability.toDouble() }
            assertEquals(1.0, severitySum, 1e-4)
        }
    }

    @Test
    fun everyClassHasItsOwnActivationMap() {
        // Selecting a runner-up must show *that* class's evidence. If every
        // index returned the winner's map, the explanation would be a lie.
        PlantDiseaseClassifier.create(context).use { classifier ->
            val size = classifier.manifest.inputSize
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
                eraseColor(android.graphics.Color.rgb(120, 90, 40))
            }
            val prediction = classifier.predict(bitmap)

            val winner = prediction.camFor(prediction.diseaseIndex)
            val other = prediction.camFor((prediction.diseaseIndex + 1) % 38)

            assertEquals(prediction.gridHeight * prediction.gridWidth, winner.size)
            assertTrue(
                "two different classes returned an identical activation map",
                !winner.contentEquals(other),
            )
        }
    }

    @Test
    fun overlayProducesAnImageOfTheRequestedSize() {
        val source = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
        val cam = FloatArray(64) { it / 64f }

        val overlay = HeatmapRenderer.overlay(
            source = source,
            cam = cam,
            gridHeight = 8,
            gridWidth = 8,
            outputSize = 128,
        )

        assertEquals(128, overlay.width)
        assertEquals(128, overlay.height)
    }

    @Test
    fun colormapLutsAreComplete() {
        for (colormap in HeatmapRenderer.Colormap.entries) {
            val lut = HeatmapRenderer.lut(colormap)
            assertEquals(256, lut.size)
        }
    }
}
