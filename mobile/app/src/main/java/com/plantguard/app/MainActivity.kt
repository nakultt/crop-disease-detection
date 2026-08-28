package com.plantguard.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.plantguard.app.ui.AnalysisScreen
import com.plantguard.app.ui.theme.PlantGuardTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PlantGuardTheme {
                // Scoped to the activity so the ONNX session survives
                // configuration changes instead of being rebuilt on rotation.
                val viewModel: AnalysisViewModel = viewModel()
                AnalysisScreen(viewModel)
            }
        }
    }
}
