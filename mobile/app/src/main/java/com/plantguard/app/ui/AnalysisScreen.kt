package com.plantguard.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.RestartAlt
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.plantguard.app.AnalysisViewModel
import com.plantguard.app.R

/**
 * The single screen: intake at the top, then diagnosis, explanation, severity
 * and advice as the analysis fills in.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalysisScreen(viewModel: AnalysisViewModel) {
    val modelState by viewModel.modelState.collectAsStateWithLifecycle()
    val state by viewModel.viewState.collectAsStateWithLifecycle()

    val manifest = modelState.manifest
    val modelUsable = manifest != null && modelState.errorMessage == null

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            color = MaterialTheme.colorScheme.primary,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.size(26.dp),
                        ) {
                            Column(
                                verticalArrangement = Arrangement.Center,
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.fillMaxSize(),
                            ) {
                                Text(
                                    "P",
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    style = MaterialTheme.typography.labelLarge,
                                )
                            }
                        }
                        Spacer(Modifier.size(10.dp))
                        Text(
                            stringResource(R.string.app_name),
                            style = MaterialTheme.typography.titleMedium,
                        )
                    }
                },
                actions = {
                    if (state.analysis != null) {
                        IconButton(onClick = viewModel::reset) {
                            Icon(
                                Icons.Outlined.RestartAlt,
                                contentDescription = stringResource(R.string.action_start_over),
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                    actionIconContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                ),
            )
        },
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 40.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (state.analysis == null) {
                item("hero") { HeroCopy() }
            }

            item("model-status") {
                ModelStatusCard(
                    loading = modelState.loading,
                    manifest = manifest,
                    errorMessage = modelState.errorMessage,
                    errorHint = modelState.errorHint,
                )
            }

            item("intake") {
                ImageIntake(
                    enabled = modelUsable && !state.analysing,
                    compact = state.analysis != null,
                    onImagePicked = viewModel::analyse,
                )
            }

            if (state.analysing) {
                item("busy") {
                    SectionCard {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Spacer(Modifier.size(12.dp))
                            Text(
                                stringResource(R.string.status_analysing),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                }
            }

            state.errorMessage?.let { message ->
                item("run-error") { ErrorCard(message = message, hint = null) }
            }

            val analysis = state.analysis
            if (analysis != null && manifest != null) {
                item("heatmap") {
                    AnimatedVisibility(visible = true, enter = fadeIn() + slideInVertically()) {
                        HeatmapCard(
                            overlay = analysis.overlay,
                            description = analysis.heatmapDescription,
                            explaining = manifest.displayName(
                                manifest.diseaseClasses.getOrElse(analysis.explainedIndex) {
                                    analysis.prediction.diseaseClass
                                },
                            ),
                            exact = manifest.camExact,
                            colormap = state.colormap,
                            opacity = state.overlayOpacity,
                            onColormapChange = viewModel::setColormap,
                            onOpacityChange = viewModel::setOverlayOpacity,
                        )
                    }
                }

                item("diagnosis") {
                    DiagnosisCard(
                        prediction = analysis.prediction,
                        selectedIndex = analysis.explainedIndex,
                        onSelect = viewModel::explainClass,
                    )
                }

                item("severity") {
                    SeverityCard(prediction = analysis.prediction)
                }

                item("advice") {
                    RecommendationCard(
                        diseaseClass = analysis.prediction.diseaseClass,
                        severity = analysis.prediction.severityLevel,
                        isHealthy = analysis.prediction.isHealthy,
                        trustworthy = manifest.trained,
                    )
                }

                item("privacy") {
                    Text(
                        stringResource(R.string.privacy_note),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }

            item("spacer") { Spacer(Modifier.height(8.dp)) }
        }
    }
}

@Composable
private fun HeroCopy() {
    Column(modifier = Modifier.padding(top = 20.dp, bottom = 6.dp)) {
        Text(
            stringResource(R.string.hero_title),
            style = MaterialTheme.typography.displaySmall,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Spacer(Modifier.height(10.dp))
        Text(
            stringResource(R.string.hero_subtitle),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
