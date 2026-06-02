package com.wardrobe.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.wardrobe.data.Garment
import com.wardrobe.data.GarmentUpdate
import com.wardrobe.data.WardrobeApi
import kotlinx.coroutines.launch

private val CATEGORIES = listOf(
    "top" to "上衣",
    "outerwear" to "外套",
    "bottom" to "下装",
    "dress" to "连衣裙",
    "shoes" to "鞋",
    "bag" to "包",
    "accessory" to "配饰",
    "other" to "其他",
)

private val SEASONS = listOf("spring" to "春", "summer" to "夏", "autumn" to "秋", "winter" to "冬")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GarmentDetailScreen(garmentId: String, onBack: () -> Unit) {
    var garment by remember { mutableStateOf<Garment?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    // 编辑状态
    var category by remember { mutableStateOf("") }
    var subCategory by remember { mutableStateOf("") }
    var colors by remember { mutableStateOf("") }
    var selectedSeasons by remember { mutableStateOf(setOf<String>()) }
    var material by remember { mutableStateOf("") }
    var style by remember { mutableStateOf("") }
    var wearCount by remember { mutableStateOf("0") }
    var purchasePrice by remember { mutableStateOf("") }
    var purchaseLink by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var saveMsg by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(garmentId) {
        try {
            val g = WardrobeApi.getGarment(garmentId)
            garment = g
            category = g.category
            subCategory = g.subCategory ?: ""
            colors = g.colors?.joinToString(", ") ?: ""
            selectedSeasons = g.season?.toSet() ?: emptySet()
            material = g.material ?: ""
            style = g.style ?: ""
            wearCount = g.wearCount.toString()
            purchasePrice = g.purchasePrice?.toString() ?: ""
            purchaseLink = g.purchaseLink ?: ""
            note = g.note ?: ""
        } catch (e: Exception) {
            error = e.message ?: "加载失败"
        } finally {
            loading = false
        }
    }

    fun save() {
        saving = true
        saveMsg = null
        scope.launch {
            try {
                val updated = WardrobeApi.updateGarment(
                    garmentId,
                    GarmentUpdate(
                        category = category,
                        subCategory = subCategory.ifBlank { null },
                        colors = colors.split(",").map { it.trim() }.filter { it.isNotBlank() }.ifEmpty { null },
                        season = selectedSeasons.toList().ifEmpty { null },
                        material = material.ifBlank { null },
                        style = style.ifBlank { null },
                        wearCount = wearCount.toIntOrNull(),
                        purchasePrice = purchasePrice.toDoubleOrNull(),
                        purchaseLink = purchaseLink.ifBlank { null },
                        note = note.ifBlank { null },
                    )
                )
                garment = updated
                saveMsg = "已保存"
            } catch (e: Exception) {
                saveMsg = "保存失败: ${e.message}"
            } finally {
                saving = false
            }
        }
    }

    // 删除确认
    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("确认删除") },
            text = { Text("删除后无法恢复，确定要删除这件衣物吗？") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteDialog = false
                    scope.launch {
                        try {
                            WardrobeApi.deleteGarment(garmentId)
                            onBack()
                        } catch (_: Exception) {}
                    }
                }) { Text("删除", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) { Text("取消") }
            },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(garment?.subCategory ?: garment?.category ?: "详情") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
                actions = {
                    IconButton(onClick = { showDeleteDialog = true }) {
                        Icon(Icons.Default.Delete, contentDescription = "删除")
                    }
                },
            )
        },
    ) { inner ->
        when {
            loading -> Box(Modifier.fillMaxSize().padding(inner), contentAlignment = androidx.compose.ui.Alignment.Center) {
                CircularProgressIndicator()
            }
            error != null -> Box(Modifier.fillMaxSize().padding(inner), contentAlignment = androidx.compose.ui.Alignment.Center) {
                Text(error!!, color = MaterialTheme.colorScheme.error)
            }
            garment != null -> {
                Column(
                    modifier = Modifier
                        .padding(inner)
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // 图片
                    AsyncImage(
                        model = garmentImageUrl(garment!!.imageUrl),
                        contentDescription = null,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 300.dp)
                            .clip(MaterialTheme.shapes.medium),
                        contentScale = ContentScale.Fit,
                    )

                    HorizontalDivider()

                    // 编辑表单
                    Text("编辑属性", style = MaterialTheme.typography.titleMedium)

                    // 类目下拉
                    var catExpanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(expanded = catExpanded, onExpandedChange = { catExpanded = it }) {
                        OutlinedTextField(
                            value = CATEGORIES.firstOrNull { it.first == category }?.second ?: category,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("类目") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(catExpanded) },
                            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth(),
                        )
                        ExposedDropdownMenu(expanded = catExpanded, onDismissRequest = { catExpanded = false }) {
                            CATEGORIES.forEach { (v, label) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = { category = v; catExpanded = false },
                                )
                            }
                        }
                    }

                    OutlinedTextField(value = subCategory, onValueChange = { subCategory = it }, label = { Text("子类") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = colors, onValueChange = { colors = it }, label = { Text("颜色（逗号分隔）") }, modifier = Modifier.fillMaxWidth())

                    // 季节多选
                    Text("季节", style = MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SEASONS.forEach { (v, label) ->
                            FilterChip(
                                selected = v in selectedSeasons,
                                onClick = {
                                    selectedSeasons = if (v in selectedSeasons) selectedSeasons - v else selectedSeasons + v
                                },
                                label = { Text(label) },
                            )
                        }
                    }

                    OutlinedTextField(value = material, onValueChange = { material = it }, label = { Text("材质") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = style, onValueChange = { style = it }, label = { Text("风格") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(
                        value = wearCount, onValueChange = { wearCount = it },
                        label = { Text("穿过次数") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = purchasePrice, onValueChange = { purchasePrice = it },
                        label = { Text("购入价") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(value = purchaseLink, onValueChange = { purchaseLink = it }, label = { Text("购买链接") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("备注") }, modifier = Modifier.fillMaxWidth(), minLines = 2)

                    if (saveMsg != null) {
                        Text(saveMsg!!, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
                    }

                    Button(
                        onClick = { save() },
                        enabled = !saving,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (saving) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                        else Text("保存")
                    }

                    Spacer(Modifier.height(32.dp))
                }
            }
        }
    }
}
