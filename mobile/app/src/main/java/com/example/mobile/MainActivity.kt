package com.example.mobile

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.mobile.ui.theme.MobileTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MobileTheme {
                PlantGuardApp()
            }
        }
    }
}

// ─── Colors ──────────────────────────────────────────────────────
private val BgPrimary = Color(0xFF0A0F0D)
private val BgCard = Color(0xFF10201A)
private val Emerald400 = Color(0xFF4ADE80)
private val Emerald500 = Color(0xFF22C55E)
private val TextPrimary = Color(0xFFE8F5E9)
private val TextSecondary = Color(0xFFA5D6A7)
private val TextMuted = Color(0xFF6B9E6F)
private val BorderSubtle = Color(0x1F4ADE80)

private val SeverityMild = Color(0xFF4ADE80)
private val SeverityModerate = Color(0xFFFACC15)
private val SeveritySevere = Color(0xFFF97316)
private val SeverityCritical = Color(0xFFEF4444)

fun severityColor(level: String): Color = when (level) {
    "Mild" -> SeverityMild
    "Moderate" -> SeverityModerate
    "Severe" -> SeveritySevere
    "Critical" -> SeverityCritical
    else -> TextMuted
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlantGuardApp() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var selectedBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var result by remember { mutableStateOf<PlantDiseaseClassifier.PredictionResult?>(null) }
    var heatmapBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var isAnalyzing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    // Image picker
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            try {
                val inputStream = context.contentResolver.openInputStream(it)
                val bitmap = BitmapFactory.decodeStream(inputStream)
                inputStream?.close()
                selectedBitmap = bitmap
                result = null
                heatmapBitmap = null
                error = null

                // Run inference
                isAnalyzing = true
                scope.launch {
                    try {
                        val prediction = withContext(Dispatchers.Default) {
                            val classifier = PlantDiseaseClassifier(context)
                            val pred = classifier.predict(bitmap)
                            classifier.close()
                            pred
                        }
                        result = prediction

                        // Generate heatmap
                        val heatmap = withContext(Dispatchers.Default) {
                            HeatmapGenerator.generateOverlay(bitmap)
                        }
                        heatmapBitmap = heatmap
                    } catch (e: Exception) {
                        error = "Analysis failed: ${e.message}"
                    } finally {
                        isAnalyzing = false
                    }
                }
            } catch (e: Exception) {
                error = "Failed to load image: ${e.message}"
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "🌱 PlantGuard AI",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 18.sp,
                        )
                        Text(
                            "Powered by MobileNetV5",
                            fontSize = 10.sp,
                            color = TextMuted,
                            letterSpacing = 1.sp,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BgPrimary,
                    titleContentColor = TextPrimary,
                ),
            )
        },
        containerColor = BgPrimary,
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // ─── Upload / Preview ────────────────────────────
            if (selectedBitmap == null) {
                // Hero text
                Text(
                    "Detect Plant Diseases\nwith Explainable AI",
                    fontSize = 26.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextPrimary,
                    textAlign = TextAlign.Center,
                    lineHeight = 34.sp,
                    modifier = Modifier.padding(vertical = 24.dp),
                )

                Text(
                    "Upload a leaf image to identify diseases,\nestimate severity, and see AI explanations.",
                    fontSize = 14.sp,
                    color = TextSecondary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(bottom = 32.dp),
                )

                // Upload zone
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .border(2.dp, BorderSubtle, RoundedCornerShape(20.dp))
                        .background(BgCard)
                        .clickable { imagePickerLauncher.launch("image/*") },
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🌿", fontSize = 40.sp)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "Tap to Select a Leaf Image",
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary,
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            "JPG, PNG, WebP",
                            fontSize = 12.sp,
                            color = TextMuted,
                        )
                    }
                }
            } else {
                // ─── Image Preview ───────────────────────────
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        if (isAnalyzing) "Analyzing..." else if (result != null) "Analysis Complete" else "Processing...",
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary,
                    )
                    IconButton(onClick = {
                        selectedBitmap = null
                        result = null
                        heatmapBitmap = null
                        error = null
                    }) {
                        Icon(Icons.Default.Refresh, "New analysis", tint = Emerald400)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Preview image
                selectedBitmap?.let { bmp ->
                    Image(
                        bitmap = bmp.asImageBitmap(),
                        contentDescription = "Selected leaf",
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .clip(RoundedCornerShape(16.dp)),
                        contentScale = ContentScale.Crop,
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Loading
                if (isAnalyzing) {
                    CircularProgressIndicator(
                        color = Emerald500,
                        modifier = Modifier.padding(32.dp),
                    )
                }

                // Error
                error?.let { errMsg ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0x1AEF4444)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "⚠️ $errMsg",
                            color = SeverityCritical,
                            modifier = Modifier.padding(16.dp),
                            fontSize = 14.sp,
                        )
                    }
                }

                // ─── Results ──────────────────────────────────
                AnimatedVisibility(
                    visible = result != null,
                    enter = fadeIn() + slideInVertically(),
                ) {
                    result?.let { pred ->
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            // Disease Card
                            Card(
                                colors = CardDefaults.cardColors(containerColor = BgCard),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Column(modifier = Modifier.padding(20.dp)) {
                                    Text(
                                        "DETECTED DISEASE",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        letterSpacing = 1.5.sp,
                                        color = TextMuted,
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            if (pred.isHealthy) "✅" else "🔬",
                                            fontSize = 28.sp,
                                        )
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Column {
                                            Text(
                                                pred.diseaseDisplayName,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 16.sp,
                                                color = if (pred.isHealthy) SeverityMild else TextPrimary,
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(12.dp))

                                    // Confidence bar
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        LinearProgressIndicator(
                                            progress = { pred.diseaseConfidence },
                                            modifier = Modifier
                                                .weight(1f)
                                                .height(8.dp)
                                                .clip(RoundedCornerShape(4.dp)),
                                            color = Emerald400,
                                            trackColor = Color(0x1A4ADE80),
                                        )
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Text(
                                            "${(pred.diseaseConfidence * 100).toInt()}%",
                                            fontWeight = FontWeight.Bold,
                                            color = Emerald400,
                                            fontSize = 14.sp,
                                        )
                                    }
                                }
                            }

                            // Severity Card
                            Card(
                                colors = CardDefaults.cardColors(containerColor = BgCard),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Column(modifier = Modifier.padding(20.dp)) {
                                    Text(
                                        "INFECTION SEVERITY",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        letterSpacing = 1.5.sp,
                                        color = TextMuted,
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(
                                            modifier = Modifier
                                                .size(12.dp)
                                                .clip(CircleShape)
                                                .background(severityColor(pred.severityLevel))
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            pred.severityLevel,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 20.sp,
                                            color = severityColor(pred.severityLevel),
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            pred.severityRange,
                                            fontSize = 13.sp,
                                            color = TextMuted,
                                        )
                                        Spacer(modifier = Modifier.weight(1f))
                                        Text(
                                            "${(pred.severityConfidence * 100).toInt()}%",
                                            fontWeight = FontWeight.SemiBold,
                                            color = severityColor(pred.severityLevel),
                                            fontSize = 14.sp,
                                        )
                                    }
                                }
                            }

                            // Heatmap Card
                            heatmapBitmap?.let { heatmap ->
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = BgCard),
                                    shape = RoundedCornerShape(16.dp),
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    Column(modifier = Modifier.padding(20.dp)) {
                                        Text(
                                            "HEATMAP VISUALIZATION",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            letterSpacing = 1.5.sp,
                                            color = TextMuted,
                                        )
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        ) {
                                            Column(
                                                modifier = Modifier.weight(1f),
                                                horizontalAlignment = Alignment.CenterHorizontally,
                                            ) {
                                                Text("Original", fontSize = 11.sp, color = TextMuted)
                                                Spacer(modifier = Modifier.height(4.dp))
                                                selectedBitmap?.let {
                                                    Image(
                                                        bitmap = it.asImageBitmap(),
                                                        contentDescription = "Original",
                                                        modifier = Modifier
                                                            .aspectRatio(1f)
                                                            .clip(RoundedCornerShape(12.dp)),
                                                        contentScale = ContentScale.Crop,
                                                    )
                                                }
                                            }
                                            Column(
                                                modifier = Modifier.weight(1f),
                                                horizontalAlignment = Alignment.CenterHorizontally,
                                            ) {
                                                Text("Heatmap", fontSize = 11.sp, color = TextMuted)
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Image(
                                                    bitmap = heatmap.asImageBitmap(),
                                                    contentDescription = "Heatmap",
                                                    modifier = Modifier
                                                        .aspectRatio(1f)
                                                        .clip(RoundedCornerShape(12.dp)),
                                                    contentScale = ContentScale.Crop,
                                                )
                                            }
                                        }
                                        // Legend
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.Center,
                                            verticalAlignment = Alignment.CenterVertically,
                                        ) {
                                            Text("Low", fontSize = 10.sp, color = TextMuted)
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Box(
                                                modifier = Modifier
                                                    .width(100.dp)
                                                    .height(6.dp)
                                                    .clip(RoundedCornerShape(3.dp))
                                                    .background(
                                                        Brush.horizontalGradient(
                                                            listOf(
                                                                Color.Blue,
                                                                Color.Cyan,
                                                                Color.Green,
                                                                Color.Yellow,
                                                                Color.Red,
                                                            )
                                                        )
                                                    )
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("High", fontSize = 10.sp, color = TextMuted)
                                        }
                                    }
                                }
                            }

                            // Recommendations
                            Card(
                                colors = CardDefaults.cardColors(containerColor = BgCard),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Column(modifier = Modifier.padding(20.dp)) {
                                    Text(
                                        "RECOMMENDATIONS",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        letterSpacing = 1.5.sp,
                                        color = TextMuted,
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))

                                    val recs = getRecommendations(pred)
                                    recs.forEach { rec ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 4.dp),
                                        ) {
                                            Text("💡", fontSize = 14.sp)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                rec,
                                                fontSize = 13.sp,
                                                color = TextSecondary,
                                                lineHeight = 18.sp,
                                            )
                                        }
                                    }
                                }
                            }

                            // Select another image
                            Button(
                                onClick = { imagePickerLauncher.launch("image/*") },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Emerald500,
                                ),
                                shape = RoundedCornerShape(50),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                            ) {
                                Icon(Icons.Default.Add, "Analyze", modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Analyze Another Image", fontWeight = FontWeight.SemiBold)
                            }

                            Spacer(modifier = Modifier.height(16.dp))
                        }
                    }
                }
            }
        }
    }
}

private fun getRecommendations(result: PlantDiseaseClassifier.PredictionResult): List<String> {
    if (result.isHealthy) {
        return listOf(
            "Plant appears healthy! Continue regular care.",
            "Maintain proper watering and fertilization.",
            "Monitor periodically for early signs of disease.",
        )
    }

    val recs = mutableListOf<String>()
    when (result.severityLevel) {
        "Mild" -> {
            recs.add("Monitor the plant closely for progression.")
            recs.add("Ensure proper spacing for air circulation.")
        }
        "Moderate" -> {
            recs.add("Apply appropriate treatment promptly.")
            recs.add("Remove heavily affected leaves.")
        }
        "Severe" -> {
            recs.add("Immediately apply targeted treatment.")
            recs.add("Prune and destroy all infected plant parts.")
            recs.add("Isolate affected plants to prevent spread.")
        }
        "Critical" -> {
            recs.add("Urgently apply systemic treatment.")
            recs.add("Consider removing the entire plant to prevent spread.")
            recs.add("Seek professional agricultural advice immediately.")
        }
    }
    return recs
}