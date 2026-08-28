package com.plantguard.app

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.plantguard.app.model.HeatmapRenderer
import com.plantguard.app.model.ModelManifest
import com.plantguard.app.model.ModelUnavailableException
import com.plantguard.app.model.PlantDiseaseClassifier
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Owns the classifier and the screen's state.
 *
 * The classifier lives here, not in the composable, for two reasons: building
 * it parses and optimises the whole graph, and it holds native memory that must
 * be released deterministically. Creating one per image (as the first version
 * did) re-parsed the model on every analysis and leaked a session each time.
 */
class AnalysisViewModel(application: Application) : AndroidViewModel(application) {

    data class ModelState(
        val loading: Boolean = true,
        val manifest: ModelManifest? = null,
        val errorMessage: String? = null,
        val errorHint: String? = null,
    )

    data class Analysis(
        val original: Bitmap,
        val prediction: PlantDiseaseClassifier.Prediction,
        val overlay: Bitmap,
        val heatmapDescription: String,
        /** Which class the heatmap currently explains. */
        val explainedIndex: Int,
    )

    data class ViewState(
        val analysing: Boolean = false,
        val analysis: Analysis? = null,
        val errorMessage: String? = null,
        val colormap: HeatmapRenderer.Colormap = HeatmapRenderer.Colormap.INFERNO,
        val overlayOpacity: Float = 0.6f,
    )

    private val _modelState = MutableStateFlow(ModelState())
    val modelState: StateFlow<ModelState> = _modelState.asStateFlow()

    private val _viewState = MutableStateFlow(ViewState())
    val viewState: StateFlow<ViewState> = _viewState.asStateFlow()

    private var classifier: PlantDiseaseClassifier? = null

    /** The square model input, kept so the overlay can be re-rendered cheaply. */
    private var modelInput: Bitmap? = null

    init {
        viewModelScope.launch {
            try {
                val loaded = withContext(Dispatchers.IO) {
                    PlantDiseaseClassifier.create(getApplication())
                }
                classifier = loaded
                _modelState.value = ModelState(loading = false, manifest = loaded.manifest)
            } catch (e: ModelUnavailableException) {
                _modelState.value = ModelState(
                    loading = false,
                    errorMessage = e.message,
                    errorHint = e.hint,
                )
            } catch (e: Exception) {
                _modelState.value = ModelState(
                    loading = false,
                    errorMessage = e.message ?: "The model could not be loaded.",
                    errorHint = null,
                )
            }
        }
    }

    fun analyse(uri: Uri) {
        val engine = classifier ?: return
        _viewState.update { it.copy(analysing = true, errorMessage = null) }

        viewModelScope.launch {
            try {
                val bitmap = withContext(Dispatchers.IO) { decode(uri) }
                val prediction = withContext(Dispatchers.Default) { engine.predict(bitmap) }

                val input = withContext(Dispatchers.Default) {
                    squareInput(bitmap, engine.manifest.inputSize)
                }
                modelInput = input

                val current = _viewState.value
                val overlay = withContext(Dispatchers.Default) {
                    HeatmapRenderer.overlay(
                        source = input,
                        cam = prediction.camFor(prediction.diseaseIndex),
                        gridHeight = prediction.gridHeight,
                        gridWidth = prediction.gridWidth,
                        colormap = current.colormap,
                        opacity = current.overlayOpacity,
                    )
                }

                _viewState.update {
                    it.copy(
                        analysing = false,
                        analysis = Analysis(
                            original = bitmap,
                            prediction = prediction,
                            overlay = overlay,
                            heatmapDescription = HeatmapRenderer.describe(
                                prediction.camFor(prediction.diseaseIndex),
                                prediction.gridHeight,
                                prediction.gridWidth,
                            ),
                            explainedIndex = prediction.diseaseIndex,
                        ),
                    )
                }
            } catch (e: Exception) {
                _viewState.update {
                    it.copy(
                        analysing = false,
                        errorMessage = e.message ?: "That image could not be analysed.",
                    )
                }
            }
        }
    }

    /** Re-render the overlay for a different candidate class. */
    fun explainClass(classIndex: Int) {
        val analysis = _viewState.value.analysis ?: return
        if (analysis.explainedIndex == classIndex) return
        rerender(analysis, classIndex, _viewState.value.colormap, _viewState.value.overlayOpacity)
    }

    fun setColormap(colormap: HeatmapRenderer.Colormap) {
        _viewState.update { it.copy(colormap = colormap) }
        val analysis = _viewState.value.analysis ?: return
        rerender(analysis, analysis.explainedIndex, colormap, _viewState.value.overlayOpacity)
    }

    fun setOverlayOpacity(opacity: Float) {
        _viewState.update { it.copy(overlayOpacity = opacity) }
        val analysis = _viewState.value.analysis ?: return
        rerender(analysis, analysis.explainedIndex, _viewState.value.colormap, opacity)
    }

    private fun rerender(
        analysis: Analysis,
        classIndex: Int,
        colormap: HeatmapRenderer.Colormap,
        opacity: Float,
    ) {
        val input = modelInput ?: return
        viewModelScope.launch {
            val cam = analysis.prediction.camFor(classIndex)
            val overlay = withContext(Dispatchers.Default) {
                HeatmapRenderer.overlay(
                    source = input,
                    cam = cam,
                    gridHeight = analysis.prediction.gridHeight,
                    gridWidth = analysis.prediction.gridWidth,
                    colormap = colormap,
                    opacity = opacity,
                )
            }
            _viewState.update {
                it.copy(
                    analysis = analysis.copy(
                        overlay = overlay,
                        explainedIndex = classIndex,
                        heatmapDescription = HeatmapRenderer.describe(
                            cam,
                            analysis.prediction.gridHeight,
                            analysis.prediction.gridWidth,
                        ),
                    ),
                )
            }
        }
    }

    fun reset() {
        _viewState.value = ViewState(
            colormap = _viewState.value.colormap,
            overlayOpacity = _viewState.value.overlayOpacity,
        )
        modelInput = null
    }

    override fun onCleared() {
        classifier?.close()
        classifier = null
        super.onCleared()
    }

    /**
     * Decode a picked image, downsampling large photos and honouring EXIF
     * rotation. A modern phone camera produces 12 MP+ files; decoding one at
     * full size costs ~50 MB of heap for an image about to be scaled to 256 px.
     */
    private fun decode(uri: Uri): Bitmap {
        val resolver = getApplication<Application>().contentResolver

        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }

        var sampleSize = 1
        while (
            bounds.outWidth / (sampleSize * 2) >= MAX_DECODE_EDGE &&
            bounds.outHeight / (sampleSize * 2) >= MAX_DECODE_EDGE
        ) {
            sampleSize *= 2
        }

        val options = BitmapFactory.Options().apply {
            inSampleSize = sampleSize
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val decoded = resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, options)
        } ?: throw IllegalStateException("That file could not be decoded as an image.")

        val orientation = resolver.openInputStream(uri)?.use { stream ->
            ExifInterface(stream).getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL,
            )
        } ?: ExifInterface.ORIENTATION_NORMAL

        return applyOrientation(decoded, orientation)
    }

    private fun applyOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
            else -> return bitmap
        }
        val rotated =
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        if (rotated != bitmap) bitmap.recycle()
        return rotated
    }

    /** The same short-side-scale + centre-crop the classifier feeds the graph. */
    private fun squareInput(bitmap: Bitmap, size: Int): Bitmap {
        val scale = size.toFloat() / minOf(bitmap.width, bitmap.height)
        val width = maxOf(size, (bitmap.width * scale).toInt())
        val height = maxOf(size, (bitmap.height * scale).toInt())
        val scaled = Bitmap.createScaledBitmap(bitmap, width, height, true)
        val cropped = Bitmap.createBitmap(scaled, (width - size) / 2, (height - size) / 2, size, size)
        if (scaled != bitmap && scaled != cropped) scaled.recycle()
        return cropped
    }

    private companion object {
        const val MAX_DECODE_EDGE = 1024
    }
}
