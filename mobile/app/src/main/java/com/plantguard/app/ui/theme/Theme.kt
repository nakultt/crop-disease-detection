package com.plantguard.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * Severity colours, which sit outside Material's semantic roles.
 *
 * They are exposed through a CompositionLocal so a composable can read the
 * theme-correct value without branching on `isSystemInDarkTheme()` at each
 * call site. Values match `docs/DESIGN_SYSTEM.md` and the web app exactly.
 */
data class SeverityColors(
    val mild: Color,
    val moderate: Color,
    val severe: Color,
    val critical: Color,
    val mildContainer: Color,
    val moderateContainer: Color,
    val severeContainer: Color,
    val criticalContainer: Color,
) {
    fun forLevel(level: String): Color = when (level) {
        "Mild" -> mild
        "Moderate" -> moderate
        "Severe" -> severe
        "Critical" -> critical
        else -> mild
    }

    fun containerForLevel(level: String): Color = when (level) {
        "Mild" -> mildContainer
        "Moderate" -> moderateContainer
        "Severe" -> severeContainer
        "Critical" -> criticalContainer
        else -> mildContainer
    }
}

private val LightSeverity = SeverityColors(
    mild = Color(0xFF2F8F4E),
    moderate = Color(0xFFB3810A),
    severe = Color(0xFFC2570D),
    critical = Color(0xFFC0322B),
    mildContainer = Color(0xFFE6F4EA),
    moderateContainer = Color(0xFFFBF1D8),
    severeContainer = Color(0xFFFBEADE),
    criticalContainer = Color(0xFFFBE6E4),
)

private val DarkSeverity = SeverityColors(
    mild = Color(0xFF4ADE80),
    moderate = Color(0xFFFBBF24),
    severe = Color(0xFFFB923C),
    critical = Color(0xFFF87171),
    mildContainer = Color(0xFF123322),
    moderateContainer = Color(0xFF33280A),
    severeContainer = Color(0xFF33210F),
    criticalContainer = Color(0xFF331715),
)

val LocalSeverityColors = staticCompositionLocalOf { LightSeverity }

private val LightColors = lightColorScheme(
    primary = Color(0xFF12805C),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE3F3EC),
    onPrimaryContainer = Color(0xFF04291D),
    secondary = Color(0xFF4A5A50),
    onSecondary = Color(0xFFFFFFFF),
    background = Color(0xFFF6F8F6),
    onBackground = Color(0xFF111B15),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF111B15),
    surfaceVariant = Color(0xFFEEF2EE),
    onSurfaceVariant = Color(0xFF4A5A50),
    outline = Color(0xFFB6C3BA),
    outlineVariant = Color(0xFFD6DED8),
    error = Color(0xFFC0322B),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFBE6E4),
    onErrorContainer = Color(0xFF410E0B),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF3DDC97),
    onPrimary = Color(0xFF04150E),
    primaryContainer = Color(0xFF12312A),
    onPrimaryContainer = Color(0xFFB6F0D6),
    secondary = Color(0xFFA5B5AB),
    onSecondary = Color(0xFF04150E),
    background = Color(0xFF0B0F0D),
    onBackground = Color(0xFFE8EFE9),
    surface = Color(0xFF141A17),
    onSurface = Color(0xFFE8EFE9),
    surfaceVariant = Color(0xFF1C2420),
    onSurfaceVariant = Color(0xFFA5B5AB),
    outline = Color(0xFF3A4741),
    outlineVariant = Color(0xFF26302A),
    error = Color(0xFFF87171),
    onError = Color(0xFF2A0A08),
    errorContainer = Color(0xFF331715),
    onErrorContainer = Color(0xFFFBD5D2),
)

@Composable
fun PlantGuardTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColors else LightColors
    val severity = if (darkTheme) DarkSeverity else LightSeverity

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // Status-bar icons must contrast with the app background, which is
            // light in the light theme and dark in the dark one.
            WindowCompat.getInsetsController(window, view)
                .isAppearanceLightStatusBars = !darkTheme
        }
    }

    CompositionLocalProvider(LocalSeverityColors provides severity) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = PlantGuardTypography,
            content = content,
        )
    }
}
