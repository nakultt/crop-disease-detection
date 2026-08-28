package com.plantguard.app.ui

import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddPhotoAlternate
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.plantguard.app.R
import com.plantguard.app.model.HeatmapRenderer
import com.plantguard.app.model.ModelManifest
import com.plantguard.app.model.PlantDiseaseClassifier
import com.plantguard.app.model.Recommendations
import com.plantguard.app.ui.theme.LocalSeverityColors
import java.util.Locale

// --- Shared shell -----------------------------------------------------------

@Composable
fun SectionCard(
    modifier: Modifier = Modifier,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outlineVariant,
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

@Composable
fun SectionLabel(text: String) {
    Text(
        text.uppercase(Locale.getDefault()),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
fun ErrorCard(message: String, hint: String?) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer,
        ),
    ) {
        Row(modifier = Modifier.padding(16.dp)) {
            Icon(
                Icons.Outlined.ErrorOutline,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
                if (hint != null) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        hint,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                    )
                }
            }
        }
    }
}

// --- Model status -----------------------------------------------------------

@Composable
fun ModelStatusCard(
    loading: Boolean,
    manifest: ModelManifest?,
    errorMessage: String?,
    errorHint: String?,
) {
    if (errorMessage != null) {
        ErrorCard(message = errorMessage, hint = errorHint)
        return
    }

    if (loading) {
        SectionCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    stringResource(R.string.status_loading_model),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        return
    }

    if (manifest == null) return

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (!manifest.trained) {
            val severity = LocalSeverityColors.current
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = severity.moderateContainer,
                ),
            ) {
                Row(modifier = Modifier.padding(16.dp)) {
                    Icon(
                        Icons.Outlined.WarningAmber,
                        contentDescription = null,
                        tint = severity.moderate,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            stringResource(R.string.demo_banner_title),
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            stringResource(R.string.demo_banner_body),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }
        }

        SectionCard {
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Fact(stringResource(R.string.fact_backbone), manifest.backbone.substringBefore('.'))
                Fact(
                    stringResource(R.string.fact_size),
                    "%.1f MB".format(manifest.sizeBytes / 1024.0 / 1024.0),
                )
                Fact(
                    stringResource(R.string.fact_explanation),
                    stringResource(
                        if (manifest.camExact) R.string.cam_exact else R.string.cam_approximate,
                    ),
                )
            }
            manifest.metrics?.let { metrics ->
                Spacer(Modifier.height(10.dp))
                Text(
                    stringResource(
                        R.string.fact_accuracy,
                        metrics.diseaseAccuracy * 100,
                        metrics.numSamples,
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun Fact(label: String, value: String) {
    Column(modifier = Modifier.width(intrinsicSize = androidx.compose.foundation.layout.IntrinsicSize.Min)) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
    }
}

// --- Intake -----------------------------------------------------------------

@Composable
fun ImageIntake(
    enabled: Boolean,
    compact: Boolean,
    onImagePicked: (Uri) -> Unit,
) {
    val galleryLauncher = rememberLauncherForActivityResult(
        // PickVisualMedia routes to the system photo picker, which needs no
        // storage permission at all on any supported API level.
        ActivityResultContracts.PickVisualMedia(),
    ) { uri -> uri?.let(onImagePicked) }

    var pendingCameraUri by remember { mutableStateOf<Uri?>(null) }
    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { success -> if (success) pendingCameraUri?.let(onImagePicked) }

    val context = androidx.compose.ui.platform.LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant,
                RoundedCornerShape(20.dp),
            )
            .clickable(enabled = enabled) {
                galleryLauncher.launch(
                    androidx.activity.result.PickVisualMediaRequest(
                        ActivityResultContracts.PickVisualMedia.ImageOnly,
                    ),
                )
            }
            .padding(vertical = if (compact) 16.dp else 28.dp, horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(if (compact) 36.dp else 46.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Outlined.AddPhotoAlternate,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(if (compact) 18.dp else 22.dp),
            )
        }

        Spacer(Modifier.height(10.dp))
        Text(
            stringResource(R.string.intake_title),
            style = MaterialTheme.typography.titleSmall,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(2.dp))
        Text(
            stringResource(R.string.intake_subtitle),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        if (!compact) {
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton(
                    enabled = enabled,
                    onClick = {
                        galleryLauncher.launch(
                            androidx.activity.result.PickVisualMediaRequest(
                                ActivityResultContracts.PickVisualMedia.ImageOnly,
                            ),
                        )
                    },
                ) {
                    Icon(
                        Icons.Outlined.PhotoLibrary,
                        contentDescription = null,
                        modifier = Modifier.size(17.dp),
                    )
                    Spacer(Modifier.width(7.dp))
                    Text(stringResource(R.string.action_gallery))
                }

                OutlinedButton(
                    enabled = enabled,
                    onClick = {
                        val uri = CameraCapture.newImageUri(context)
                        pendingCameraUri = uri
                        cameraLauncher.launch(uri)
                    },
                ) {
                    Icon(
                        Icons.Outlined.CameraAlt,
                        contentDescription = null,
                        modifier = Modifier.size(17.dp),
                    )
                    Spacer(Modifier.width(7.dp))
                    Text(stringResource(R.string.action_camera))
                }
            }
        }
    }
}

// --- Heatmap ----------------------------------------------------------------

@Composable
fun HeatmapCard(
    overlay: Bitmap,
    description: String,
    explaining: String,
    exact: Boolean,
    colormap: HeatmapRenderer.Colormap,
    opacity: Float,
    onColormapChange: (HeatmapRenderer.Colormap) -> Unit,
    onOpacityChange: (Float) -> Unit,
) {
    SectionCard {
        SectionLabel(stringResource(R.string.heatmap_title))
        Spacer(Modifier.height(3.dp))
        Text(
            stringResource(
                if (exact) R.string.heatmap_caption_exact else R.string.heatmap_caption_approx,
                explaining,
            ),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(12.dp))
        Image(
            bitmap = overlay.asImageBitmap(),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(12.dp))
                .semantics { contentDescription = description },
        )

        Spacer(Modifier.height(8.dp))
        Text(
            description,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            SectionLabel(stringResource(R.string.heatmap_overlay))
            Text(
                "${(opacity * 100).toInt()}%",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Slider(
            value = opacity,
            onValueChange = onOpacityChange,
            valueRange = 0f..1f,
            modifier = Modifier.semantics {
                contentDescription = "Heatmap overlay strength"
            },
        )

        Spacer(Modifier.height(4.dp))
        SectionLabel(stringResource(R.string.heatmap_colour_scale))
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HeatmapRenderer.Colormap.entries.forEach { option ->
                val selected = option == colormap
                if (selected) {
                    FilledTonalButton(onClick = { onColormapChange(option) }) {
                        Text(option.name.lowercase().replaceFirstChar { it.uppercase() })
                    }
                } else {
                    OutlinedButton(onClick = { onColormapChange(option) }) {
                        Text(option.name.lowercase().replaceFirstChar { it.uppercase() })
                    }
                }
            }
        }
    }
}

// --- Diagnosis --------------------------------------------------------------

@Composable
fun DiagnosisCard(
    prediction: PlantDiseaseClassifier.Prediction,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
) {
    val severityColors = LocalSeverityColors.current
    val confidence = prediction.diseaseConfidence
    val runnerUp = prediction.topDiseases.getOrNull(1)?.probability ?: 0f
    val margin = confidence - runnerUp

    SectionCard {
        SectionLabel(stringResource(R.string.diagnosis_title))
        Spacer(Modifier.height(10.dp))

        Row(verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(
                        if (prediction.isHealthy) severityColors.mildContainer
                        else MaterialTheme.colorScheme.primaryContainer,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (prediction.isHealthy) Icons.Outlined.CheckCircle else Icons.Outlined.WarningAmber,
                    contentDescription = null,
                    tint = if (prediction.isHealthy) severityColors.mild
                    else MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    prediction.crop,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    prediction.condition,
                    style = MaterialTheme.typography.headlineSmall,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "%.1f%%".format(confidence * 100),
                    style = MaterialTheme.typography.headlineSmall,
                )
                Text(
                    stringResource(R.string.label_confidence),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        LinearProgressIndicator(
            progress = { confidence },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )

        // A high top-1 alone is not confidence: 0.55 against a 0.45 runner-up is
        // a coin toss. Both the score and the margin have to clear the bar.
        val warning = when {
            confidence >= 0.85f && margin >= 0.3f -> null
            confidence >= 0.6f -> stringResource(R.string.confidence_moderate)
            else -> stringResource(R.string.confidence_low)
        }
        if (warning != null) {
            Spacer(Modifier.height(10.dp))
            val isLow = confidence < 0.6f
            Card(
                shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isLow) severityColors.criticalContainer
                    else severityColors.moderateContainer,
                ),
            ) {
                Text(
                    warning,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isLow) severityColors.critical else severityColors.moderate,
                    modifier = Modifier.padding(10.dp),
                )
            }
        }

        Spacer(Modifier.height(16.dp))
        SectionLabel(stringResource(R.string.candidates_title))
        Spacer(Modifier.height(3.dp))
        Text(
            stringResource(R.string.candidates_hint),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))

        prediction.topDiseases.forEach { candidate ->
            val selected = candidate.index == selectedIndex
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        if (selected) MaterialTheme.colorScheme.primaryContainer
                        else androidx.compose.ui.graphics.Color.Transparent,
                    )
                    .clickable { onSelect(candidate.index) }
                    .padding(horizontal = 10.dp, vertical = 8.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        candidate.displayName,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        maxLines = 1,
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "%.1f%%".format(candidate.probability * 100),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { candidate.probability },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp)),
                    color = if (selected) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.outline,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        Text(
            stringResource(R.string.inference_time, prediction.inferenceMillis),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

// --- Severity ---------------------------------------------------------------

@Composable
fun SeverityCard(prediction: PlantDiseaseClassifier.Prediction) {
    val colors = LocalSeverityColors.current

    if (prediction.isHealthy) {
        SectionCard {
            SectionLabel(stringResource(R.string.severity_title))
            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(colors.mildContainer)
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Outlined.CheckCircle,
                    contentDescription = null,
                    tint = colors.mild,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    stringResource(R.string.severity_healthy),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        return
    }

    SectionCard {
        SectionLabel(stringResource(R.string.severity_title))
        Spacer(Modifier.height(12.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(colors.forLevel(prediction.severityLevel)),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                prediction.severityLevel,
                style = MaterialTheme.typography.headlineSmall,
                color = colors.forLevel(prediction.severityLevel),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                prediction.severityRange,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.weight(1f))
            Text(
                "${(prediction.severityConfidence * 100).toInt()}%",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(Modifier.height(14.dp))
        prediction.severityDistribution.forEach { bin ->
            val selected = bin.className == prediction.severityLevel
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(vertical = 3.dp),
            ) {
                Text(
                    bin.className,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (selected) colors.forLevel(bin.className)
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.width(70.dp),
                )
                LinearProgressIndicator(
                    progress = { bin.probability },
                    modifier = Modifier
                        .weight(1f)
                        .height(5.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color = colors.forLevel(bin.className),
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "${(bin.probability * 100).toInt()}%",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.width(36.dp),
                    textAlign = TextAlign.End,
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        Text(
            stringResource(R.string.severity_caveat),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

// --- Recommendations --------------------------------------------------------

@Composable
fun RecommendationCard(
    diseaseClass: String,
    severity: String,
    isHealthy: Boolean,
    trustworthy: Boolean,
) {
    val colors = LocalSeverityColors.current
    val advice = remember(diseaseClass, severity, isHealthy) {
        Recommendations.forPrediction(diseaseClass, severity, isHealthy)
    }

    SectionCard {
        SectionLabel(
            stringResource(
                if (isHealthy) R.string.advice_title_healthy else R.string.advice_title,
            ),
        )

        if (!trustworthy) {
            Spacer(Modifier.height(10.dp))
            Card(
                shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.cardColors(containerColor = colors.moderateContainer),
            ) {
                Text(
                    stringResource(R.string.advice_untrained_caveat),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.moderate,
                    modifier = Modifier.padding(10.dp),
                )
            }
        }

        Spacer(Modifier.height(10.dp))
        advice.forEach { item ->
            Row(
                modifier = Modifier.padding(vertical = 5.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Box(
                    modifier = Modifier
                        .padding(top = 6.dp)
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(
                            when (item.urgency) {
                                Recommendations.Urgency.INFO -> colors.mild
                                Recommendations.Urgency.WARNING -> colors.moderate
                                Recommendations.Urgency.CRITICAL -> colors.critical
                            },
                        ),
                )
                Spacer(Modifier.width(10.dp))
                Text(item.text, style = MaterialTheme.typography.bodyMedium)
            }
        }

        if (!isHealthy) {
            Spacer(Modifier.height(10.dp))
            Text(
                stringResource(R.string.advice_disclaimer),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
