package com.example.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val PlantGuardColorScheme = darkColorScheme(
    primary = Emerald500,
    onPrimary = Color.White,
    primaryContainer = Emerald800,
    secondary = Emerald400,
    background = BgPrimary,
    surface = BgCard,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary,
    outline = Color(0x1F4ADE80),
)

@Composable
fun MobileTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = PlantGuardColorScheme,
        typography = Typography,
        content = content,
    )
}