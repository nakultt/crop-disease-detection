package com.plantguard.app.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The pure maths behind the heatmap.
 *
 * `lut` and `overlay` touch `android.graphics`, which is stubbed in JVM unit
 * tests, so they are exercised on-device instead. Everything here is plain
 * Kotlin and mirrors `pc/src/app/lib/cam.test.ts` — both clients must render
 * the same map for the same activation grid.
 */
class HeatmapRendererTest {

    @Test
    fun `normalize scales the peak to one`() {
        val out = HeatmapRenderer.normalize(floatArrayOf(1f, 2f, 4f))
        assertArrayEquals(floatArrayOf(0.25f, 0.5f, 1f), out)
    }

    @Test
    fun `normalize clamps negative activations to zero`() {
        // Negative activation is evidence *against* the class; drawing it as
        // heat would invert the meaning of the map.
        val out = HeatmapRenderer.normalize(floatArrayOf(-5f, 0f, 2f))
        assertArrayEquals(floatArrayOf(0f, 0f, 1f), out)
    }

    @Test
    fun `normalize returns zeros for an all-negative map`() {
        val out = HeatmapRenderer.normalize(floatArrayOf(-3f, -2f, -1f))
        assertArrayEquals(floatArrayOf(0f, 0f, 0f), out)
    }

    @Test
    fun `normalize returns zeros for a flat map instead of dividing by ~zero`() {
        val out = HeatmapRenderer.normalize(FloatArray(16))
        assertTrue(out.all { it == 0f })
    }

    @Test
    fun `normalize never emits a value outside zero to one`() {
        val out = HeatmapRenderer.normalize(floatArrayOf(-100f, -1f, 0f, 0.5f, 3f, 1e6f))
        assertTrue(out.all { it in 0f..1f })
    }

    @Test
    fun `normalize does not mutate its input`() {
        val input = floatArrayOf(-1f, 2f, 4f)
        HeatmapRenderer.normalize(input)
        assertArrayEquals(floatArrayOf(-1f, 2f, 4f), input)
    }

    @Test
    fun `upscale returns the requested size`() {
        val out = HeatmapRenderer.upscale(FloatArray(64), 8, 8, 256, 256)
        assertEquals(256 * 256, out.size)
    }

    @Test
    fun `upscale preserves a constant field`() {
        val out = HeatmapRenderer.upscale(FloatArray(16) { 0.42f }, 4, 4, 32, 32)
        assertTrue(out.all { kotlin.math.abs(it - 0.42f) < 1e-5f })
    }

    @Test
    fun `upscale is an identity at the same size`() {
        val source = floatArrayOf(0f, 1f, 2f, 3f)
        assertArrayEquals(source, HeatmapRenderer.upscale(source, 2, 2, 2, 2))
    }

    @Test
    fun `upscale interpolates rather than replicating`() {
        // A hard 0/1 edge doubled must produce intermediate values; nearest
        // neighbour would emit only 0s and 1s and look like a chessboard.
        val source = floatArrayOf(0f, 1f, 0f, 1f)
        val out = HeatmapRenderer.upscale(source, 2, 2, 4, 4)
        assertTrue(out.toSet().size > 2)
    }

    @Test
    fun `upscale does not overshoot the input range`() {
        val source = floatArrayOf(0f, 1f, 0f, 1f, 0f, 1f, 0f, 1f, 0f)
        val out = HeatmapRenderer.upscale(source, 3, 3, 40, 40)
        assertTrue(out.all { it in 0f..1f })
    }

    @Test
    fun `upscale keeps the hot corner in the same corner`() {
        // A peak that drifts under upscaling would point the user at the wrong
        // part of the leaf.
        val source = FloatArray(9).also { it[8] = 1f }
        val size = 30
        val out = HeatmapRenderer.upscale(source, 3, 3, size, size)
        val best = out.indices.maxByOrNull { out[it] }!!
        assertTrue("row should be in the lower half", best / size > size / 2)
        assertTrue("column should be in the right half", best % size > size / 2)
    }

    // --- Hotspot description ------------------------------------------------

    private fun hotAt(row: Int, column: Int, size: Int = 9) =
        FloatArray(size * size).also { it[row * size + column] = 1f }

    @Test
    fun `describes the upper left`() {
        assertTrue(HeatmapRenderer.describe(hotAt(0, 0), 9, 9).contains("upper left"))
    }

    @Test
    fun `describes the lower right`() {
        assertTrue(HeatmapRenderer.describe(hotAt(8, 8), 9, 9).contains("lower right"))
    }

    @Test
    fun `calls the middle-centre cell simply the centre`() {
        val description = HeatmapRenderer.describe(hotAt(4, 4), 9, 9)
        assertTrue(description.contains("the centre"))
        assertFalse(description.contains("middle centre"))
    }

    @Test
    fun `says nothing stood out for an empty map`() {
        assertTrue(
            HeatmapRenderer.describe(FloatArray(64), 8, 8).contains("did not concentrate"),
        )
    }

    @Test
    fun `reports a single spike as tightly focused`() {
        assertTrue(HeatmapRenderer.describe(hotAt(1, 7), 9, 9).contains("tightly focused"))
    }

    @Test
    fun `reports a uniform map as spread broadly`() {
        val flat = FloatArray(64) { 0.5f }
        assertTrue(HeatmapRenderer.describe(flat, 8, 8).contains("spread broadly"))
    }

    // --- Helpers ------------------------------------------------------------

    private fun assertArrayEquals(expected: FloatArray, actual: FloatArray) {
        assertEquals(expected.size, actual.size)
        for (i in expected.indices) assertEquals(expected[i], actual[i], 1e-5f)
    }

    private fun assertFalse(condition: Boolean) = assertNotEquals(true, condition)
}
