package com.example.mobile

import android.content.Context
import android.graphics.Bitmap
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.nio.FloatBuffer
import kotlin.math.exp

/**
 * Plant disease classifier using ONNX Runtime.
 *
 * Loads the multi-task MobileNetV5 ONNX model and runs inference
 * on-device to predict disease type and severity.
 */
class PlantDiseaseClassifier(context: Context) {

    private val ortEnv: OrtEnvironment = OrtEnvironment.getEnvironment()
    private val session: OrtSession

    companion object {
        private const val MODEL_FILE = "model.onnx"
        private const val IMAGE_SIZE = 256
        private val MEAN = floatArrayOf(0.485f, 0.456f, 0.406f)
        private val STD = floatArrayOf(0.229f, 0.224f, 0.225f)

        val DISEASE_CLASSES = arrayOf(
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
        )

        val SEVERITY_CLASSES = arrayOf("Mild", "Moderate", "Severe", "Critical")

        val SEVERITY_RANGES = mapOf(
            "Mild" to "0–25%",
            "Moderate" to "26–50%",
            "Severe" to "51–75%",
            "Critical" to "76–100%",
        )

        fun getDisplayName(className: String): String {
            return className.replace("___", " – ").replace("_", " ")
        }

        fun isHealthy(className: String): Boolean {
            return className.lowercase().contains("healthy")
        }
    }

    init {
        // Load model from assets
        val modelBytes = context.assets.open(MODEL_FILE).readBytes()
        session = ortEnv.createSession(modelBytes)
    }

    data class PredictionResult(
        val diseaseClass: String,
        val diseaseDisplayName: String,
        val diseaseConfidence: Float,
        val severityLevel: String,
        val severityConfidence: Float,
        val severityRange: String,
        val isHealthy: Boolean,
        val topDiseases: List<Pair<String, Float>>,
    )

    /**
     * Run inference on a Bitmap image.
     */
    fun predict(bitmap: Bitmap): PredictionResult {
        // Resize to 256x256
        val resized = Bitmap.createScaledBitmap(bitmap, IMAGE_SIZE, IMAGE_SIZE, true)

        // Preprocess: normalize with ImageNet stats, convert to NCHW
        val inputBuffer = preprocessBitmap(resized)

        // Create input tensor
        val shape = longArrayOf(1, 3, IMAGE_SIZE.toLong(), IMAGE_SIZE.toLong())
        val inputTensor = OnnxTensor.createTensor(ortEnv, inputBuffer, shape)

        // Run inference
        val inputName = session.inputNames.first()
        val results = session.run(mapOf(inputName to inputTensor))

        // Parse outputs
        val outputNames = session.outputNames.toList()
        val diseaseLogits = (results[outputNames[0]].get().value as Array<FloatArray>)[0]
        val severityLogits = (results[outputNames[1]].get().value as Array<FloatArray>)[0]

        // Softmax
        val diseaseProbs = softmax(diseaseLogits)
        val severityProbs = softmax(severityLogits)

        // Best predictions
        val diseaseIdx = diseaseProbs.indices.maxByOrNull { diseaseProbs[it] } ?: 0
        val severityIdx = severityProbs.indices.maxByOrNull { severityProbs[it] } ?: 0

        // Top-K diseases
        val topDiseases = diseaseProbs.indices
            .sortedByDescending { diseaseProbs[it] }
            .take(5)
            .map { DISEASE_CLASSES[it] to diseaseProbs[it] }

        val diseaseClass = DISEASE_CLASSES[diseaseIdx]
        val severityLevel = SEVERITY_CLASSES[severityIdx]

        // Cleanup
        inputTensor.close()
        results.close()

        return PredictionResult(
            diseaseClass = diseaseClass,
            diseaseDisplayName = getDisplayName(diseaseClass),
            diseaseConfidence = diseaseProbs[diseaseIdx],
            severityLevel = severityLevel,
            severityConfidence = severityProbs[severityIdx],
            severityRange = SEVERITY_RANGES[severityLevel] ?: "",
            isHealthy = isHealthy(diseaseClass),
            topDiseases = topDiseases,
        )
    }

    private fun preprocessBitmap(bitmap: Bitmap): FloatBuffer {
        val pixels = IntArray(IMAGE_SIZE * IMAGE_SIZE)
        bitmap.getPixels(pixels, 0, IMAGE_SIZE, 0, 0, IMAGE_SIZE, IMAGE_SIZE)

        val buffer = FloatBuffer.allocate(3 * IMAGE_SIZE * IMAGE_SIZE)

        // NCHW format: all R, then all G, then all B
        for (c in 0 until 3) {
            for (i in pixels.indices) {
                val pixel = pixels[i]
                val channelValue = when (c) {
                    0 -> (pixel shr 16 and 0xFF) / 255.0f  // R
                    1 -> (pixel shr 8 and 0xFF) / 255.0f   // G
                    2 -> (pixel and 0xFF) / 255.0f          // B
                    else -> 0f
                }
                buffer.put((channelValue - MEAN[c]) / STD[c])
            }
        }
        buffer.rewind()
        return buffer
    }

    private fun softmax(logits: FloatArray): FloatArray {
        val maxVal = logits.max()
        val exps = logits.map { exp((it - maxVal).toDouble()).toFloat() }.toFloatArray()
        val sum = exps.sum()
        return exps.map { it / sum }.toFloatArray()
    }

    fun close() {
        session.close()
        ortEnv.close()
    }
}
