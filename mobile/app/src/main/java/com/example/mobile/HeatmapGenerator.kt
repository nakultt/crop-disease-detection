package com.example.mobile

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint

/**
 * Generates heatmap visualizations for disease detection.
 *
 * Uses HSV color analysis to highlight diseased regions,
 * matching the approach used in the training pipeline
 * and web frontend.
 */
object HeatmapGenerator {

    /**
     * Generate a heatmap overlay highlighting diseased regions.
     */
    fun generateOverlay(
        original: Bitmap,
        opacity: Float = 0.5f,
        size: Int = 256,
    ): Bitmap {
        val resized = Bitmap.createScaledBitmap(original, size, size, true)
        val overlay = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(overlay)

        // Draw original
        canvas.drawBitmap(resized, 0f, 0f, null)

        // Generate heatmap scores
        val scores = FloatArray(size * size)
        val pixels = IntArray(size * size)
        resized.getPixels(pixels, 0, size, 0, 0, size, size)

        for (i in pixels.indices) {
            val pixel = pixels[i]
            val r = Color.red(pixel) / 255f
            val g = Color.green(pixel) / 255f
            val b = Color.blue(pixel) / 255f

            val hsv = FloatArray(3)
            Color.RGBToHSV(
                (r * 255).toInt(),
                (g * 255).toInt(),
                (b * 255).toInt(),
                hsv,
            )

            val h = hsv[0]   // 0-360
            val s = hsv[1]   // 0-1
            val v = hsv[2]   // 0-1

            // Score diseased regions
            val score = when {
                s < 0.12f -> 0f                              // Background
                h in 60f..170f && s > 0.15f -> 0.1f          // Green = healthy
                h in 15f..50f && s > 0.12f -> 0.6f + s * 0.4f // Brown/yellow = diseased
                v < 0.3f && s > 0.08f -> 0.8f                // Dark spots
                (h < 15f || h > 330f) && s > 0.2f -> 0.7f    // Red/purple
                else -> 0.3f
            }

            scores[i] = score.coerceIn(0f, 1f)
        }

        // Normalize
        val maxScore = scores.max().coerceAtLeast(0.001f)

        // Apply JET colormap overlay
        val paint = Paint()
        for (y in 0 until size) {
            for (x in 0 until size) {
                val score = scores[y * size + x] / maxScore
                if (score > 0.1f) {
                    val (cr, cg, cb) = jetColormap(score)
                    paint.color = Color.argb(
                        (score * opacity * 200).toInt().coerceIn(0, 255),
                        cr, cg, cb,
                    )
                    canvas.drawPoint(x.toFloat(), y.toFloat(), paint)
                }
            }
        }

        return overlay
    }

    private fun jetColormap(value: Float): Triple<Int, Int, Int> {
        val v = value.coerceIn(0f, 1f)
        val r: Float
        val g: Float
        val b: Float

        when {
            v < 0.125f -> { r = 0f; g = 0f; b = 128f + v * 4 * 127f }
            v < 0.375f -> { r = 0f; g = (v - 0.125f) * 4 * 255f; b = 255f }
            v < 0.625f -> { r = (v - 0.375f) * 4 * 255f; g = 255f; b = 255f - (v - 0.375f) * 4 * 255f }
            v < 0.875f -> { r = 255f; g = 255f - (v - 0.625f) * 4 * 255f; b = 0f }
            else -> { r = 255f - (v - 0.875f) * 4 * 127f; g = 0f; b = 0f }
        }

        return Triple(
            r.toInt().coerceIn(0, 255),
            g.toInt().coerceIn(0, 255),
            b.toInt().coerceIn(0, 255),
        )
    }
}
