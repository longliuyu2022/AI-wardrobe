package com.wardrobe.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.wardrobe.data.BASE_URL
import com.wardrobe.data.Garment
import com.wardrobe.data.RecordWearRequest
import com.wardrobe.data.WardrobeApi
import com.wardrobe.data.exportToDownloads

/** 把后端返回的 /api/backend/uploads/xxx.jpg 转成完整 URL。 */
fun garmentImageUrl(imageUrl: String): String {
    return "https://your-domain.example.com$imageUrl"
}

/** GarmentCategory 中文映射。 */
fun categoryLabel(cat: String): String = when (cat) {
    "top" -> "上衣"
    "outerwear" -> "外套"
    "bottom" -> "下装"
    "dress" -> "连衣裙"
    "shoes" -> "鞋"
    "bag" -> "包"
    "accessory" -> "配饰"
    "other" -> "其他"
    else -> cat
}

private data class FilterItem(val value: String?, val label: String)

private val FILTERS = listOf(
    FilterItem(null, "全部"),
    FilterItem("top", "上衣"),
    FilterItem("outerwear", "外套"),
    FilterItem("bottom", "下装"),
    FilterItem("dress", "连衣裙"),
    FilterItem("shoes", "鞋"),
    FilterItem("bag", "包"),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WardrobeScreen(onUpload: () -> Unit, onItemClick: (String) -> Unit = {}, onOutfits: () -> Unit = {}, onCalendar: () -> Unit = {}, onAdmin: () -> Unit = {}, onLogout: () -> Unit = {}) {
    var allItems by remember { mutableStateOf<List<Garment>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current
    var exporting by remember { mutableStateOf(false) }
    var exportMsg by remember { mutableStateOf<String?>(null) }
    var wearMsg by remember { mutableStateOf<String?>(null) }

    val filtered = if (selectedCategory == null) allItems
    else allItems.filter { it.category == selectedCategory }

    suspend fun refresh() {
        loading = true
        error = null
        try {
            allItems = WardrobeApi.listGarments(limit = 200)
        } catch (e: Exception) {
            error = e.message ?: "加载失败"
        } finally {
            loading = false
        }
    }

    LaunchedEffect(Unit) { refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("我的衣橱") },
                actions = {
                    TextButton(onClick = {
                        exporting = true
                        scope.launch {
                            try {
                                val file = com.wardrobe.data.exportToDownloads(context)
                                exportMsg = "已导出到 ${file.name}"
                            } catch (e: Exception) {
                                exportMsg = "导出失败: ${e.message}"
                            } finally {
                                exporting = false
                            }
                        }
                    }, enabled = !exporting) {
                        Text(if (exporting) "导出中…" else "导出")
                    }
                    TextButton(onClick = onOutfits) {
                        Text("AI 搭配")
                    }
                    TextButton(onClick = onCalendar) {
                        Text("日历")
                    }
                    TextButton(onClick = onAdmin) {
                        Text("管理")
                    }
                    TextButton(onClick = onLogout) {
                        Text("退出", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onUpload,
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("上传衣物") },
            )
        },
    ) { inner ->
        Column(
            modifier = Modifier
                .padding(inner)
                .fillMaxSize(),
        ) {
            // 分类筛选 pill
            ScrollableTabRow(
                selectedTabIndex = FILTERS.indexOfFirst { it.value == selectedCategory }.coerceAtLeast(0),
                modifier = Modifier.fillMaxWidth(),
                edgePadding = 16.dp,
                divider = {},
            ) {
                FILTERS.forEach { f ->
                    Tab(
                        selected = selectedCategory == f.value,
                        onClick = { selectedCategory = f.value },
                        text = { Text(f.label) },
                    )
                }
            }

            // 导出结果提示
            if (exportMsg != null) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (exportMsg!!.startsWith("已导出")) MaterialTheme.colorScheme.primaryContainer
                        else MaterialTheme.colorScheme.errorContainer,
                    ),
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                ) {
                    Text(
                        text = exportMsg!!,
                        modifier = Modifier.padding(12.dp),
                        color = if (exportMsg!!.startsWith("已导出")) MaterialTheme.colorScheme.onPrimaryContainer
                        else MaterialTheme.colorScheme.onErrorContainer,
                    )
                }
            }

            // 穿搭记录提示
            if (wearMsg != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                ) {
                    Text(
                        text = wearMsg!!,
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }

            when {
                loading -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                error != null -> {
                    Column(
                        modifier = Modifier.fillMaxSize().padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text(error!!, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(16.dp))
                        OutlinedButton(onClick = { scope.launch { refresh() } }) {
                            Text("重试")
                        }
                    }
                }
                filtered.isEmpty() -> {
                    Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text(
                            if (allItems.isEmpty()) "衣橱还是空的，点击右下角上传第一件衣物"
                            else "该分类下没有衣物",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                else -> {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(filtered, key = { it.id }) { g ->
                            GarmentCard(
                                g,
                                onClick = { onItemClick(g.id) },
                                onWear = {
                                    scope.launch {
                                        try {
                                            WardrobeApi.recordWear(RecordWearRequest(listOf(g.id)))
                                            wearMsg = "已记录今天穿了 ${g.subCategory ?: categoryLabel(g.category)}"
                                        } catch (e: Exception) {
                                            wearMsg = "记录失败: ${e.message}"
                                        }
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun GarmentCard(g: Garment, onClick: () -> Unit = {}, onWear: () -> Unit = {}) {
    var showMenu by remember { mutableStateOf(false) }

    Box {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .combinedClickable(
                    onClick = onClick,
                    onLongClick = { showMenu = true },
                ),
            shape = MaterialTheme.shapes.medium,
        ) {
            Column {
                AsyncImage(
                    model = garmentImageUrl(g.imageUrl),
                    contentDescription = g.subCategory ?: categoryLabel(g.category),
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(3f / 4f)
                        .clip(MaterialTheme.shapes.medium),
                    contentScale = ContentScale.Crop,
                )
                Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
                    Text(
                        text = g.subCategory ?: categoryLabel(g.category),
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (!g.colors.isNullOrEmpty()) {
                        Text(
                            text = g.colors.joinToString(" / "),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
        // 长按菜单
        DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
            DropdownMenuItem(
                text = { Text("今天穿了") },
                onClick = {
                    showMenu = false
                    onWear()
                },
            )
        }
    }
}
