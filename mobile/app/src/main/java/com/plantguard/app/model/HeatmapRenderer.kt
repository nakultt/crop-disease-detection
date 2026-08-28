package com.plantguard.app.model

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import kotlin.math.floor
import kotlin.math.pow

/**
 * Turns a class activation map into pixels.
 *
 * The map itself comes from the ONNX graph; this only normalises, upscales and
 * colours it. Mirrors `pc/src/app/lib/cam.ts` so both apps draw the same thing.
 *
 * JET is deliberately absent: it is not perceptually uniform, and its bands
 * invent edges that read as structure in the data.
 */
object HeatmapRenderer {

    enum class Colormap { INFERNO, VIRIDIS, MAGMA }

    private val ANCHORS: Map<Colormap, Array<IntArray>> = mapOf(
        Colormap.INFERNO to arrayOf(
            intArrayOf(0, 0, 4), intArrayOf(22, 11, 57), intArrayOf(66, 10, 104),
            intArrayOf(106, 23, 110), intArrayOf(147, 38, 103), intArrayOf(188, 55, 84),
            intArrayOf(221, 81, 58), intArrayOf(243, 120, 25), intArrayOf(252, 165, 10),
            intArrayOf(246, 215, 70), intArrayOf(252, 255, 164),
        ),
        Colormap.VIRIDIS to arrayOf(
            intArrayOf(68, 1, 84), intArrayOf(72, 36, 117), intArrayOf(65, 68, 135),
            intArrayOf(53, 95, 141), intArrayOf(42, 120, 142), intArrayOf(33, 145, 140),
            intArrayOf(34, 168, 132), intArrayOf(68, 191, 112), intArrayOf(122, 209, 81),
            intArrayOf(189, 223, 38), intArrayOf(253, 231, 37),
        ),
        Colormap.MAGMA to arrayOf(
            intArrayOf(0, 0, 4), intArrayOf(20, 14, 54), intArrayOf(59, 15, 112),
            intArrayOf(100, 26, 128), intArrayOf(140, 41, 129), intArrayOf(180, 54, 122),
            intArrayOf(217, 72, 105), intArrayOf(242, 108, 93), intArrayOf(252, 152, 108),
            intArrayOf(254, 199, 141), intArrayOf(252, 253, 191),
        ),
    )

    private val lutCache = mutableMapOf<Colormap, IntArray>()

    /** 256-entry RGB lookup table, built once per colormap. */
    fun lut(colormap: Colormap): IntArray = lutCache.getOrPut(colormap) {
        val anchors = ANCHORS.getValue(colormap)
        val segments = anchors.size - 1
        IntArray(256) { i ->
            val position = (i / 255f) * segments
            val index = floor(position).toInt().coerceAtMost(segments - 1)
            val t = position - index
            val a = anchors[index]
            val b = anchors[index + 1]
            Color.rgb(
                (a[0] + (b[0] - a[0]) * t).toInt(),
                (a[1] + (b[1] - a[1]) * t).toInt(),
                (a[2] + (b[2] - a[2]) * t).toInt(),
            )
        }
    }

    /**
     * ReLU then min-max normalise into `[0, 1]`.
     *
     * Negative activations argue *against* the class, which the heatmap does
     * not depict, so they clamp to zero. A flat map stays flat rather than
     * being amplified into noise by dividing by ~zero.
     */
    fun normalize(cam: FloatArray): FloatArray {
        var maxValue = 0f
        val out = FloatArray(cam.size) { i ->
            val v = if (cam[i] > 0f) cam[i] else 0f
            if (v > maxValue) maxValue = v
            v
        }
        if (maxValue < 1e-8f) return out
        for (i in out.indices) out[i] /= maxValue
        return out
    }

    /**
     * Bilinearly resample a `[h, w]` grid.
     *
     * An 8x8 grid blown up to 512 px with nearest-neighbour looks like a
     * chessboard and implies precision the evidence does not have.
     */
    fun upscale(grid: FloatArray, h: Int, w: Int, outH: Int, outW: Int): FloatArray {
        val out = FloatArray(outH * outW)
        val scaleY = h.toFloat() / outH
        val scaleX = w.toFloat() / outW

        for (y in 0 until outH) {
            val srcY = ((y + 0.5f) * scaleY - 0.5f).coerceIn(0f, (h - 1).toFloat())
            val y0 = floor(srcY).toInt()
            val y1 = (y0 + 1).coerceAtMost(h - 1)
            val wy = srcY - y0

            for (x in 0 until outW) {
                val srcX = ((x + 0.5f) * scaleX - 0.5f).coerceIn(0f, (w - 1).toFloat())
                val x0 = floor(srcX).toInt()
                val x1 = (x0 + 1).coerceAtMost(w - 1)
                val wx = srcX - x0

                val top = grid[y0 * w + x0] * (1 - wx) + grid[y0 * w + x1] * wx
                val bottom = grid[y1 * w + x0] * (1 - wx) + grid[y1 * w + x1] * wx
                out[y * outW + x] = top * (1 - wy) + bottom * wy
            }
        }
        return out
    }

    /**
     * Composite a heatmap over the source image.
     *
     * @param source the square model input, so heatmap and photo align exactly.
     * @param opacity peak overlay strength, `0f`..`1f`.
     */
    fun overlay(
        source: Bitmap,
        cam: FloatArray,
        gridHeight: Int,
        gridWidth: Int,
        colormap: Colormap = Colormap.INFERNO,
        opacity: Float = 0.6f,
        outputSize: Int = 512,
    ): Bitmap {
        val output = Bitmap.createBitmap(outputSize, outputSize, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)

        canvas.drawBitmap(
            source,
            Rect(0, 0, source.width, source.height),
            Rect(0, 0, outputSize, outputSize),
            Paint(Paint.FILTER_BITMAP_FLAG),
        )

        if (opacity <= 0f) return output

        val heat = upscale(normalize(cam), gridHeight, gridWidth, outputSize, outputSize)
        val palette = lut(colormap)

        // Build the overlay as a pixel array and blend it in one draw. Drawing
        // 262 144 individual points (as the previous implementation did) takes
        // hundreds of milliseconds and blocks whatever thread it runs on.
        val pixels = IntArray(outputSize * outputSize)
        for (i in pixels.indices) {
            val v = heat[i].coerceIn(0f, 1f)
            val rgb = palette[(v * 255).toInt()]
            // Ramp alpha with intensity so cold regions stay transparent and the
            // photograph shows through. v^0.7 keeps weak-but-real evidence visible.
            val alpha = (255 * opacity * v.toDouble().pow(0.7)).toInt().coerceIn(0, 255)
            pixels[i] = (alpha shl 24) or (rgb and 0x00FFFFFF)
        }

        val layer = Bitmap.createBitmap(pixels, outputSize, outputSize, Bitmap.Config.ARGB_8888)
        canvas.drawBitmap(layer, 0f, 0f, Paint().apply {
            xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_OVER)
        })
        layer.recycle()

        return output
    }

    /** Where the heat concentrates, in words, for a content description. */
    fun describe(cam: FloatArray, gridHeight: Int, gridWidth: Int): String {
        val heat = normalize(cam)
        var mass = 0f
        var best = -1f
        var bestIndex = 0

        for (i in heat.indices) {
            mass += heat[i]
            if (heat[i] > best) {
                best = heat[i]
                bestIndex = i
            }
        }

        if (mass < 1e-6f) return "The model did not concentrate on any particular region."

        val row = bestIndex / gridWidth
        val column = bestIndex % gridWidth
        val vertical = when {
            row < gridHeight / 3f -> "upper"
            row < 2 * gridHeight / 3f -> "middle"
            else -> "lower"
        }
        val horizontal = when {
            column < gridWidth / 3f -> "left"
            column < 2 * gridWidth / 3f -> "centre"
            else -> "right"
        }
        val band = if (vertical == "middle" && horizontal == "centre") {
            "the centre"
        } else {
            "the $vertical $horizontal"
        }

        val topQuarter = heat.sortedDescending()
            .take((heat.size / 4).coerceAtLeast(1))
            .sum()
        val concentration = topQuarter / mass
        val spread = when {
            concentration > 0.7f -> "tightly focused on"
            concentration > 0.5f -> "focused on"
            else -> "spread broadly, leaning toward"
        }

        return "Model attention is $spread $band of the leaf."
    }
}
