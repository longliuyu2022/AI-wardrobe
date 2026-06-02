package com.wardrobe.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.wardrobe.data.*
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(onBack: () -> Unit) {
    var yearMonth by remember { mutableStateOf(YearMonth.now()) }
    var wearLog by remember { mutableStateOf<WearLogMonth?>(null) }
    var stats by remember { mutableStateOf<WearStats?>(null) }
    var garments by remember { mutableStateOf<List<Garment>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }

    val garmentMap = remember(garments) { garments.associateBy { it.id } }

    LaunchedEffect(yearMonth) {
        loading = true
        error = null
        try {
            val monthStr = yearMonth.format(DateTimeFormatter.ofPattern("yyyy-MM"))
            val log = WardrobeApi.getWearLog(monthStr)
            val s = WardrobeApi.getWearStats()
            val g = WardrobeApi.listGarments(limit = 200)
            wearLog = log
            stats = s
            garments = g
        } catch (e: Exception) {
            error = e.message ?: "加载失败"
        } finally {
            loading = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("穿搭日历") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
            )
        },
    ) { inner ->
        if (loading) {
            Box(Modifier.fillMaxSize().padding(inner), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.padding(inner).fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // 使用说明
            item {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f),
                    ),
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("使用方法", style = MaterialTheme.typography.titleSmall)
                        Spacer(Modifier.height(4.dp))
                        Text("在衣橱页长按卡片，点「今天穿了」记录", style = MaterialTheme.typography.bodySmall)
                        Text("本页日历显示每天穿过的衣物", style = MaterialTheme.typography.bodySmall)
                        Text("下方展示最常穿 Top 和最近 7 天", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            // 月份导航
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = { yearMonth = yearMonth.minusMonths(1) }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "上月")
                    }
                    Text(
                        "${yearMonth.year} 年 ${yearMonth.monthValue} 月",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    IconButton(onClick = { yearMonth = yearMonth.plusMonths(1) }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowForward, "下月")
                    }
                }
            }

            // 日历网格
            item {
                CalendarGrid(yearMonth, wearLog, garmentMap)
            }

            // 总穿次
            stats?.let { s ->
                item {
                    Card {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("总穿次", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("${s.totalWears}", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                // 最近 7 天
                if (s.week.isNotEmpty()) {
                    item {
                        Card {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("最近 7 天", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Spacer(Modifier.height(8.dp))
                                WeekChart(s.week)
                            }
                        }
                    }
                }

                // 最常穿 Top
                if (s.top.isNotEmpty()) {
                    item {
                        Text("最常穿 Top ${s.top.size}", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    items(s.top) { item ->
                        TopWearRow(item, s.top.maxOf { it.wearCount })
                    }
                }
            }

            if (error != null) {
                item {
                    Text(error!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun CalendarGrid(
    yearMonth: YearMonth,
    wearLog: WearLogMonth?,
    garmentMap: Map<String, Garment>,
) {
    val firstDay = yearMonth.atDay(1)
    val daysInMonth = yearMonth.lengthOfMonth()
    var startWeekday = firstDay.dayOfWeek.value - 1
    val today = LocalDate.now()

    Card {
        Column(modifier = Modifier.padding(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth()) {
                listOf("一", "二", "三", "四", "五", "六", "日").forEach { d ->
                    Text(
                        d,
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(4.dp))

            val totalCells = startWeekday + daysInMonth
            val rows = (totalCells + 6) / 7
            for (row in 0 until rows) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    for (col in 0 until 7) {
                        val idx = row * 7 + col
                        val dayNum = idx - startWeekday + 1
                        val isCurrentMonth = dayNum in 1..daysInMonth
                        val dateStr = if (isCurrentMonth) {
                            "${yearMonth.year}-${String.format("%02d", yearMonth.monthValue)}-${String.format("%02d", dayNum)}"
                        } else ""
                        val wornIds = if (dateStr.isNotEmpty()) wearLog?.days?.get(dateStr) ?: emptyList() else emptyList()
                        val isToday = isCurrentMonth && dateStr == today.toString()

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .padding(1.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(
                                    if (isToday) MaterialTheme.colorScheme.primaryContainer
                                    else MaterialTheme.colorScheme.surface
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                if (isCurrentMonth) {
                                    Text(
                                        "$dayNum",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isToday) MaterialTheme.colorScheme.primary
                                        else MaterialTheme.colorScheme.onSurface,
                                    )
                                    if (wornIds.isNotEmpty()) {
                                        Row(
                                            modifier = Modifier.padding(top = 1.dp),
                                            horizontalArrangement = Arrangement.spacedBy(1.dp),
                                        ) {
                                            wornIds.take(2).forEach { gid ->
                                                val g = garmentMap[gid]
                                                if (g != null) {
                                                    AsyncImage(
                                                        model = garmentImageUrl(g.imageUrl),
                                                        contentDescription = null,
                                                        modifier = Modifier.size(12.dp).clip(RoundedCornerShape(2.dp)),
                                                        contentScale = ContentScale.Crop,
                                                    )
                                                }
                                            }
                                            if (wornIds.size > 2) {
                                                Text("+${wornIds.size - 2}", fontSize = 6.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WeekChart(week: Map<String, Int>) {
    val today = LocalDate.now()
    val maxCnt = (week.values.maxOrNull() ?: 1).coerceAtLeast(1)

    Row(
        modifier = Modifier.fillMaxWidth().height(60.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        for (i in 0 until 7) {
            val date = today.minusDays((6 - i).toLong())
            val key = date.toString()
            val cnt = week[key] ?: 0
            val pct = cnt.toFloat() / maxCnt

            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (cnt > 0) {
                    Text("$cnt", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Box(
                    modifier = Modifier.fillMaxWidth().weight(1f).padding(horizontal = 2.dp),
                    contentAlignment = Alignment.BottomCenter,
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .fillMaxHeight(pct.coerceAtLeast(0.05f))
                            .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                            .background(MaterialTheme.colorScheme.primary),
                    )
                }
                Text(
                    "${date.monthValue}/${date.dayOfMonth}",
                    style = MaterialTheme.typography.labelSmall,
                    fontSize = 8.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun TopWearRow(item: WearTopItem, maxWear: Int) {
    val pct = if (maxWear > 0) item.wearCount.toFloat() / maxWear else 0f
    Card {
        Row(
            modifier = Modifier.padding(8.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            AsyncImage(
                model = garmentImageUrl(item.imageUrl),
                contentDescription = null,
                modifier = Modifier.size(40.dp).clip(RoundedCornerShape(6.dp)),
                contentScale = ContentScale.Crop,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    item.subCategory ?: categoryLabel(item.category),
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { pct },
                    modifier = Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)),
                )
            }
            Text(
                "${item.wearCount} 次",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}
