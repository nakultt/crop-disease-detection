package com.plantguard.app.model

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * The `model.json` that ships beside `model.onnx` in `assets/`.
 *
 * Input size, normalisation constants, output names and class lists all come
 * from here rather than being hardcoded, so re-exporting with a different
 * backbone or label set needs no code change. See `docs/MODEL_CONTRACT.md`.
 */
data class ModelManifest(
    val schemaVersion: Int,
    val modelVersion: String,
    val backbone: String,
    /** `false` for `--demo` exports. The UI must warn when this is false. */
    val trained: Boolean,
    val precision: String,
    val sizeBytes: Long,
    val inputName: String,
    val inputSize: Int,
    val mean: FloatArray,
    val std: FloatArray,
    val diseaseOutput: String,
    val severityOutput: String,
    val diseaseCamOutput: String,
    val severityCamOutput: String,
    val camGrid: Pair<Int, Int>,
    val camExact: Boolean,
    val diseaseClasses: List<String>,
    val severityClasses: List<String>,
    val severityRanges: Map<String, String>,
    val metrics: Metrics?,
) {
    data class Metrics(
        val diseaseAccuracy: Double,
        val diseaseMacroF1: Double,
        val severityAccuracy: Double,
        val severityMacroF1: Double,
        val numSamples: Int,
    )

    /** "Tomato___Late_blight" -> "Tomato" */
    fun cropOf(className: String): String =
        className.substringBefore("___").replace('_', ' ').replace(Regex("\\s*\\(.*?\\)\\s*"), " ").trim()

    /** "Tomato___Late_blight" -> "Late blight" */
    fun conditionOf(className: String): String {
        val rest = className.substringAfter("___", "").replace('_', ' ').trim()
        if (rest.isEmpty()) return "Unknown"
        return rest.replaceFirstChar { it.uppercase() }
    }

    fun displayName(className: String): String {
        val condition = conditionOf(className)
        val crop = cropOf(className)
        return if (condition == "Unknown") crop else "$crop · $condition"
    }

    fun isHealthy(className: String): Boolean = className.contains("healthy", ignoreCase = true)

    // FloatArray has identity equals/hashCode, so a data class holding one needs
    // both written out or `==` silently compares references.
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ModelManifest) return false
        return modelVersion == other.modelVersion &&
            backbone == other.backbone &&
            inputSize == other.inputSize &&
            mean.contentEquals(other.mean) &&
            std.contentEquals(other.std) &&
            diseaseClasses == other.diseaseClasses
    }

    override fun hashCode(): Int {
        var result = modelVersion.hashCode()
        result = 31 * result + backbone.hashCode()
        result = 31 * result + inputSize
        result = 31 * result + mean.contentHashCode()
        result = 31 * result + std.contentHashCode()
        result = 31 * result + diseaseClasses.hashCode()
        return result
    }

    companion object {
        const val ASSET_NAME = "model.json"

        /**
         * Read and validate the manifest from `assets/`.
         *
         * @throws ModelUnavailableException when it is missing or malformed. A
         *   bad manifest yields silently wrong predictions -- wrong
         *   normalisation shifts every logit, a stale class list mislabels
         *   every diagnosis -- so this refuses to guess at defaults.
         */
        fun load(context: Context): ModelManifest {
            val text = try {
                context.assets.open(ASSET_NAME).bufferedReader().use { it.readText() }
            } catch (e: Exception) {
                throw ModelUnavailableException(
                    "No model.json in the app's assets.",
                    "Run `uv run python main.py export --demo` in training/ to publish a model, " +
                        "then rebuild the app.",
                    e,
                )
            }

            return try {
                parse(JSONObject(text))
            } catch (e: ModelUnavailableException) {
                throw e
            } catch (e: Exception) {
                throw ModelUnavailableException("model.json could not be parsed.", null, e)
            }
        }

        fun parse(json: JSONObject): ModelManifest {
            val schemaVersion = json.getInt("schemaVersion")
            if (schemaVersion != 1) {
                throw ModelUnavailableException(
                    "model.json declares schemaVersion $schemaVersion; this build understands 1.",
                    "Re-export with the current training pipeline.",
                )
            }

            val input = json.getJSONObject("input")
            val std = input.getJSONArray("std").toFloatArray()
            if (std.any { it == 0f }) {
                throw ModelUnavailableException(
                    "model.json: input.std contains a zero, which would divide by zero.",
                    null,
                )
            }

            val outputs = json.getJSONObject("outputs")
            val cam = json.getJSONObject("cam")
            val grid = cam.getJSONArray("grid")
            val classes = json.getJSONObject("classes")

            val severityRanges = mutableMapOf<String, String>()
            json.optJSONObject("severityRanges")?.let { ranges ->
                for (key in ranges.keys()) severityRanges[key] = ranges.getString(key)
            }

            val metrics = json.optJSONObject("metrics")?.let {
                Metrics(
                    diseaseAccuracy = it.getDouble("diseaseAccuracy"),
                    diseaseMacroF1 = it.getDouble("diseaseMacroF1"),
                    severityAccuracy = it.getDouble("severityAccuracy"),
                    severityMacroF1 = it.getDouble("severityMacroF1"),
                    numSamples = it.getInt("numSamples"),
                )
            }

            return ModelManifest(
                schemaVersion = schemaVersion,
                modelVersion = json.optString("modelVersion", "unknown"),
                backbone = json.optString("backbone", "unknown"),
                trained = json.optBoolean("trained", false),
                precision = json.optString("precision", "fp32"),
                sizeBytes = json.optLong("sizeBytes", 0L),
                inputName = input.optString("name", "input"),
                inputSize = input.getInt("size"),
                mean = input.getJSONArray("mean").toFloatArray(),
                std = std,
                diseaseOutput = outputs.getString("disease"),
                severityOutput = outputs.getString("severity"),
                diseaseCamOutput = outputs.getString("diseaseCam"),
                severityCamOutput = outputs.getString("severityCam"),
                camGrid = grid.getInt(0) to grid.getInt(1),
                camExact = cam.optBoolean("exact", false),
                diseaseClasses = classes.getJSONArray("disease").toStringList(),
                severityClasses = classes.getJSONArray("severity").toStringList(),
                severityRanges = severityRanges,
                metrics = metrics,
            )
        }

        private fun JSONArray.toFloatArray() =
            FloatArray(length()) { getDouble(it).toFloat() }

        private fun JSONArray.toStringList() = List(length()) { getString(it) }
    }
}

/** The model or its manifest is missing or unusable; carries setup guidance. */
class ModelUnavailableException(
    message: String,
    val hint: String?,
    cause: Throwable? = null,
) : Exception(message, cause)
