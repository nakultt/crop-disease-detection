package com.plantguard.app.model

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.graphics.Bitmap
import java.io.Closeable
import java.nio.FloatBuffer
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * On-device inference over the exported ONNX graph.
 *
 * The graph emits class activation maps alongside its logits, so an explanation
 * costs nothing extra: no gradients, no second pass. See
 * `docs/MODEL_CONTRACT.md`.
 *
 * Construction is expensive (it parses and optimises the graph), so callers
 * should hold one instance for the lifetime of the screen rather than building
 * one per image.
 */
class PlantDiseaseClassifier private constructor(
    private val environment: OrtEnvironment,
    private val session: OrtSession,
    val manifest: ModelManifest,
) : Closeable {

    data class Prediction(
        val diseaseClass: String,
        val diseaseDisplayName: String,
        val crop: String,
        val condition: String,
        val diseaseIndex: Int,
        val diseaseConfidence: Float,
        val isHealthy: Boolean,
        val topDiseases: List<Candidate>,
        val severityLevel: String,
        val severityRange: String,
        val severityConfidence: Float,
        val severityDistribution: List<Candidate>,
        /** Full disease CAM cube, `[numClasses * gridH * gridW]`. */
        val diseaseCamCube: FloatArray,
        val gridHeight: Int,
        val gridWidth: Int,
        val inferenceMillis: Long,
    ) {
        /**
         * The activation map for one class.
         *
         * The whole cube is retained so selecting a runner-up shows *that*
         * class's evidence. Returning the winner's map for every selection
         * would quietly turn the explanation into a lie.
         */
        fun camFor(classIndex: Int): FloatArray {
            val stride = gridHeight * gridWidth
            val start = classIndex * stride
            if (start < 0 || start + stride > diseaseCamCube.size) {
                val fallback = diseaseIndex * stride
                return diseaseCamCube.copyOfRange(fallback, fallback + stride)
            }
            return diseaseCamCube.copyOfRange(start, start + stride)
        }

        override fun equals(other: Any?) = this === other
        override fun hashCode() = System.identityHashCode(this)
    }

    data class Candidate(val className: String, val displayName: String, val index: Int, val probability: Float)

    /** Runs the graph. Call from a background dispatcher; this blocks. */
    fun predict(bitmap: Bitmap): Prediction {
        val size = manifest.inputSize
        val input = preprocess(bitmap, size)

        val shape = longArrayOf(1, 3, size.toLong(), size.toLong())
        val startedAt = System.nanoTime()

        OnnxTensor.createTensor(environment, input, shape).use { tensor ->
            session.run(mapOf(manifest.inputName to tensor)).use { results ->
                val elapsedMillis = (System.nanoTime() - startedAt) / 1_000_000

                val diseaseLogits = results.floatVector(manifest.diseaseOutput)
                val severityLogits = results.floatVector(manifest.severityOutput)
                val (camCube, gridHeight, gridWidth) = results.camCube(manifest.diseaseCamOutput)

                val diseaseProbabilities = softmax(diseaseLogits)
                val severityProbabilities = softmax(severityLogits)

                val diseaseIndex = diseaseProbabilities.argmax()
                val severityIndex = severityProbabilities.argmax()

                val diseaseClass = manifest.diseaseClasses.getOrElse(diseaseIndex) { "class_$diseaseIndex" }
                val severityLevel =
                    manifest.severityClasses.getOrElse(severityIndex) { "level_$severityIndex" }

                return Prediction(
                    diseaseClass = diseaseClass,
                    diseaseDisplayName = manifest.displayName(diseaseClass),
                    crop = manifest.cropOf(diseaseClass),
                    condition = manifest.conditionOf(diseaseClass),
                    diseaseIndex = diseaseIndex,
                    diseaseConfidence = diseaseProbabilities[diseaseIndex],
                    isHealthy = manifest.isHealthy(diseaseClass),
                    topDiseases = diseaseProbabilities.indices
                        .sortedByDescending { diseaseProbabilities[it] }
                        .take(TOP_K)
                        .map { index ->
                            val name = manifest.diseaseClasses.getOrElse(index) { "class_$index" }
                            Candidate(name, manifest.displayName(name), index, diseaseProbabilities[index])
                        },
                    severityLevel = severityLevel,
                    severityRange = manifest.severityRanges[severityLevel].orEmpty(),
                    severityConfidence = severityProbabilities[severityIndex],
                    severityDistribution = severityProbabilities.mapIndexed { index, probability ->
                        val name = manifest.severityClasses.getOrElse(index) { "level_$index" }
                        Candidate(name, name, index, probability)
                    },
                    diseaseCamCube = camCube,
                    gridHeight = gridHeight,
                    gridWidth = gridWidth,
                    inferenceMillis = elapsedMillis,
                )
            }
        }
    }

    /**
     * Scale the short side to `size`, centre-crop, then normalise into NCHW.
     *
     * Matches the training transform. Squashing a non-square photo into a
     * square (which `createScaledBitmap` alone would do) distorts leaf geometry
     * and measurably shifts predictions.
     */
    private fun preprocess(bitmap: Bitmap, size: Int): FloatBuffer {
        val scale = size.toFloat() / min(bitmap.width, bitmap.height)
        val scaledWidth = max(size, (bitmap.width * scale).roundToInt())
        val scaledHeight = max(size, (bitmap.height * scale).roundToInt())

        val scaled = Bitmap.createScaledBitmap(bitmap, scaledWidth, scaledHeight, true)
        val cropped = Bitmap.createBitmap(
            scaled,
            (scaledWidth - size) / 2,
            (scaledHeight - size) / 2,
            size,
            size,
        )

        val pixels = IntArray(size * size)
        cropped.getPixels(pixels, 0, size, 0, 0, size, size)

        if (cropped != scaled) cropped.recycle()
        if (scaled != bitmap) scaled.recycle()

        val buffer = FloatBuffer.allocate(3 * size * size)
        val mean = manifest.mean
        val std = manifest.std

        // NCHW: a full R plane, then G, then B.
        for (channel in 0 until 3) {
            val shift = when (channel) {
                0 -> 16
                1 -> 8
                else -> 0
            }
            for (pixel in pixels) {
                val value = (pixel shr shift and 0xFF) / 255f
                buffer.put((value - mean[channel]) / std[channel])
            }
        }
        buffer.rewind()
        return buffer
    }

    override fun close() {
        session.close()
        // The OrtEnvironment is a process-wide singleton. Closing it here would
        // tear down the runtime for every other consumer in the app, so it is
        // deliberately left alone.
    }

    companion object {
        private const val MODEL_ASSET = "model.onnx"
        private const val TOP_K = 5

        /**
         * Build a classifier from the packaged assets.
         *
         * @throws ModelUnavailableException if the model or manifest is absent.
         */
        fun create(context: Context): PlantDiseaseClassifier {
            val manifest = ModelManifest.load(context)
            val environment = OrtEnvironment.getEnvironment()

            val bytes = try {
                context.assets.open(MODEL_ASSET).use { it.readBytes() }
            } catch (e: Exception) {
                throw ModelUnavailableException(
                    "No model.onnx in the app's assets.",
                    "Export a model from training/ and rebuild.",
                    e,
                )
            }

            val options = OrtSession.SessionOptions().apply {
                setIntraOpNumThreads(
                    Runtime.getRuntime().availableProcessors().coerceIn(1, 4),
                )
                setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
            }

            val session = environment.createSession(bytes, options)

            val outputs = session.outputNames
            val missing = listOf(
                manifest.diseaseOutput,
                manifest.severityOutput,
                manifest.diseaseCamOutput,
                manifest.severityCamOutput,
            ).filterNot { it in outputs }

            if (missing.isNotEmpty()) {
                session.close()
                throw ModelUnavailableException(
                    "model.onnx is missing the outputs its manifest promises: " +
                        missing.joinToString(),
                    "The .onnx and .json in assets/ are out of sync. Re-export both together.",
                )
            }

            return PlantDiseaseClassifier(environment, session, manifest)
        }

        internal fun softmax(logits: FloatArray): FloatArray {
            val maxLogit = logits.max()
            var sum = 0.0
            val exps = FloatArray(logits.size) { index ->
                val e = exp((logits[index] - maxLogit).toDouble())
                sum += e
                e.toFloat()
            }
            return FloatArray(exps.size) { (exps[it] / sum).toFloat() }
        }

        private fun FloatArray.argmax(): Int {
            var best = 0
            for (i in 1 until size) if (this[i] > this[best]) best = i
            return best
        }
    }
}

/** `[1, K]` output as a flat FloatArray. */
private fun OrtSession.Result.floatVector(name: String): FloatArray {
    val value = get(name).orElseThrow {
        IllegalStateException("Graph produced no output named '$name'.")
    }.value
    @Suppress("UNCHECKED_CAST")
    return (value as Array<FloatArray>)[0]
}

/** `[1, K, h, w]` output flattened to `[K * h * w]`, with its grid dimensions. */
private fun OrtSession.Result.camCube(name: String): Triple<FloatArray, Int, Int> {
    val value = get(name).orElseThrow {
        IllegalStateException("Graph produced no output named '$name'.")
    }.value

    @Suppress("UNCHECKED_CAST")
    val batch = (value as Array<Array<Array<FloatArray>>>)[0]

    val classes = batch.size
    val height = batch[0].size
    val width = batch[0][0].size

    val flat = FloatArray(classes * height * width)
    var offset = 0
    for (classMap in batch) {
        for (row in classMap) {
            row.copyInto(flat, offset)
            offset += row.size
        }
    }
    return Triple(flat, height, width)
}
