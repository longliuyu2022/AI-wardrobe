package com.wardrobe.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.wardrobe.data.Garment
import com.wardrobe.data.OutfitSuggestion
import com.wardrobe.data.WardrobeApi
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OutfitScreen(onBack: () -> Unit) {
    var outfits by remember { mutableStateOf<List<OutfitSuggestion>>(emptyList()) }
    var allGarments by remember { mutableStateOf<Map<String, Garment>>(emptyMap()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun load() {
        loading = true
        error = null
        scope.launch {
            try {
                // 先拿衣柜数据（用于展示缩略图）
                val garments = WardrobeApi.listGarments(limit = 200)
                allGarments = garments.associateBy { it.id }
                // 再请求搭配
                outfits = WardrobeApi.suggestOutfits(count = 3)
            } catch (e: java.net.SocketTimeoutException) {
                error = "AI 搭配超时，请稍后重试"
            } catch (e: Exception) {
                error = e.message ?: "加载失败"
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("AI 搭配推荐") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
            )
        },
    ) { inner ->
        when {
            loading -> Box(Modifier.fillMaxSize().padding(inner), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator()
                    Spacer(Modifier.height(16.dp))
                    Text("AI 正在搭配中，请稍候…", style = MaterialTheme.typography.bodyMedium)
                }
            }
            error != null -> Box(Modifier.fillMaxSize().padding(inner), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(error!!, color = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.height(16.dp))
                    OutlinedButton(onClick = { load() }) { Text("重试") }
                }
            }
            outfits.isEmpty() -> Box(Modifier.fillMaxSize().padding(inner), contentAlignment = Alignment.Center) {
                Text("衣柜里衣物太少，至少需要 2 件才能搭配", style = MaterialTheme.typography.bodyLarge)
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.padding(inner).fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    items(outfits) { outfit ->
                        OutfitCard(outfit, allGarments)
                    }
                }
            }
        }
    }
}

@Composable
private fun OutfitCard(outfit: OutfitSuggestion, garmentMap: Map<String, Garment>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // 标题
            if (!outfit.name.isNullOrBlank()) {
                Text(
                    text = outfit.name,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
            // 推荐理由
            if (!outfit.reason.isNullOrBlank()) {
                Text(
                    text = outfit.reason,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 12.dp),
                )
            }
            // 涉及衣物缩略图
            val matchedGarments = outfit.garmentIds.mapNotNull { garmentMap[it] }
            if (matchedGarments.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    matchedGarments.forEach { garment ->
                        Column(
                            modifier = Modifier.weight(1f),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            AsyncImage(
                                model = garmentImageUrl(garment.imageUrl),
                                contentDescription = null,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .aspectRatio(3f / 4f)
                                    .clip(MaterialTheme.shapes.small),
                                contentScale = ContentScale.Crop,
                            )
                            Text(
                                text = garment.subCategory ?: categoryLabel(garment.category),
                                style = MaterialTheme.typography.labelSmall,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}
