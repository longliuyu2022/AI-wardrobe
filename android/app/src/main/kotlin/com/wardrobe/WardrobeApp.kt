package com.wardrobe

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.wardrobe.data.WardrobeApi
import com.wardrobe.ui.screens.AdminScreen
import com.wardrobe.ui.screens.CalendarScreen
import com.wardrobe.ui.screens.GarmentDetailScreen
import com.wardrobe.ui.screens.LoginScreen
import com.wardrobe.ui.screens.OutfitScreen
import com.wardrobe.ui.screens.UploadScreen
import com.wardrobe.ui.screens.WardrobeScreen
import kotlinx.coroutines.launch

@Composable
fun WardrobeApp() {
    val nav = rememberNavController()
    val scope = rememberCoroutineScope()

    // null = 还在检查, true = 已登录, false = 未登录
    var loggedIn by remember { mutableStateOf<Boolean?>(null) }

    // 启动时检查登录态
    LaunchedEffect(Unit) {
        try {
            WardrobeApi.me()
            loggedIn = true
        } catch (_: Exception) {
            loggedIn = false
        }
    }

    when (val state = loggedIn) {
        null -> {
            // 还在检查登录态，显示 loading
            androidx.compose.foundation.layout.Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator()
            }
        }
        else -> {
            Scaffold(modifier = Modifier.fillMaxSize()) { inner ->
                NavHost(
                    navController = nav,
                    startDestination = if (state) "wardrobe" else "login",
                    modifier = Modifier.padding(inner),
                ) {
                    composable("login") {
                        LoginScreen(onLoginSuccess = {
                            loggedIn = true
                            nav.navigate("wardrobe") {
                                popUpTo("login") { inclusive = true }
                            }
                        })
                    }
                    composable("wardrobe") {
                        WardrobeScreen(
                            onUpload = { nav.navigate("upload") },
                            onItemClick = { id -> nav.navigate("detail/$id") },
                            onOutfits = { nav.navigate("outfits") },
                            onCalendar = { nav.navigate("calendar") },
                            onAdmin = { nav.navigate("admin") },
                            onLogout = {
                                scope.launch {
                                    try { WardrobeApi.logout() } catch (_: Exception) {}
                                    com.wardrobe.data.cookieJar.clear()
                                    loggedIn = false
                                    nav.navigate("login") {
                                        popUpTo("wardrobe") { inclusive = true }
                                    }
                                }
                            },
                        )
                    }
                    composable("upload") {
                        UploadScreen(onDone = { nav.popBackStack() })
                    }
                    composable("detail/{id}") { backStackEntry ->
                        GarmentDetailScreen(
                            garmentId = backStackEntry.arguments?.getString("id") ?: "",
                            onBack = { nav.popBackStack() },
                        )
                    }
                    composable("outfits") {
                        OutfitScreen(onBack = { nav.popBackStack() })
                    }
                    composable("admin") {
                        AdminScreen(onBack = { nav.popBackStack() })
                    }
                    composable("calendar") {
                        CalendarScreen(onBack = { nav.popBackStack() })
                    }
                }
            }
        }
    }
}
