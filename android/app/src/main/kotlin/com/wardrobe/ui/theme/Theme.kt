package com.wardrobe.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val WardrobeColors = lightColorScheme(
    primary = Brand600,
    onPrimary = Brand50,
    primaryContainer = Brand200,
    onPrimaryContainer = Brand900,
    secondary = Brand500,
    background = Brand50,
    onBackground = Brand900,
    surface = Brand50,
    onSurface = Brand900,
    surfaceVariant = Brand100,
    outline = Brand300,
)

@Composable
fun WardrobeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = WardrobeColors,
        typography = WardrobeTypography,
        content = content,
    )
}
