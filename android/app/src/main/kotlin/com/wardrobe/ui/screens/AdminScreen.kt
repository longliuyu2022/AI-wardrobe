package com.wardrobe.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.wardrobe.data.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminScreen(onBack: () -> Unit) {
    var loggedIn by remember { mutableStateOf(false) }
    var password by remember { mutableStateOf("") }
    var loginError by remember { mutableStateOf<String?>(null) }
    var loginLoading by remember { mutableStateOf(false) }

    // Stats & users
    var stats by remember { mutableStateOf<AdminStats?>(null) }
    var users by remember { mutableStateOf<List<AdminUserBrief>>(emptyList()) }
    var dataLoading by remember { mutableStateOf(false) }
    var dataError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun loadData() {
        dataLoading = true
        dataError = null
        scope.launch {
            try {
                stats = WardrobeApi.adminStats()
                users = WardrobeApi.adminUsers().users
            } catch (e: Exception) {
                dataError = e.message ?: "加载失败"
            } finally {
                dataLoading = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("管理员后台") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
            )
        },
    ) { inner ->
        if (!loggedIn) {
            // 登录表单
            Column(
                modifier = Modifier
                    .padding(inner)
                    .fillMaxSize()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("管理员登录", style = MaterialTheme.typography.headlineMedium)
                Spacer(Modifier.height(24.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("管理员密码") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !loginLoading,
                )
                if (loginError != null) {
                    Text(loginError!!, color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 8.dp))
                }
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = {
                        loginLoading = true
                        loginError = null
                        scope.launch {
                            try {
                                WardrobeApi.adminLogin(AdminLoginRequest(password.trim()))
                                loggedIn = true
                                loadData()
                            } catch (e: Exception) {
                                loginError = e.message ?: "登录失败"
                            } finally {
                                loginLoading = false
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !loginLoading && password.isNotBlank(),
                ) {
                    if (loginLoading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary)
                    else Text("登录")
                }
            }
        } else {
            // 管理面板
            when {
                dataLoading -> Box(Modifier.fillMaxSize().padding(inner), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                dataError != null -> Box(Modifier.fillMaxSize().padding(inner), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(dataError!!, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(16.dp))
                        OutlinedButton(onClick = { loadData() }) { Text("重试") }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.padding(inner).fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        // 统计卡片
                        item {
                            Text("系统概览", style = MaterialTheme.typography.titleLarge)
                        }
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                StatCard("用户", "${stats?.userCount ?: 0}", Modifier.weight(1f))
                                StatCard("衣物", "${stats?.garmentCount ?: 0}", Modifier.weight(1f))
                                StatCard("文件", "${stats?.uploadFiles ?: 0}", Modifier.weight(1f))
                                StatCard("占用", "${stats?.uploadSizeMb ?: 0} MB", Modifier.weight(1f))
                            }
                        }

                        // 分类分布
                        val cats = stats?.categories
                        if (!cats.isNullOrEmpty()) {
                            item {
                                Text("分类分布", style = MaterialTheme.typography.titleMedium,
                                    modifier = Modifier.padding(top = 8.dp))
                            }
                            item {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    cats.forEach { (cat, count) ->
                                        val label = categoryLabel(cat)
                                        AssistChip(
                                            onClick = {},
                                            label = { Text("$label $count") },
                                        )
                                    }
                                }
                            }
                        }

                        // 用户列表
                        item {
                            Text("用户列表", style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.padding(top = 8.dp))
                        }
                        items(users) { u ->
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(u.username, style = MaterialTheme.typography.titleSmall)
                                    Text(
                                        "衣物 ${u.garmentCount} 件 | 注册 ${u.createdAt?.take(10) ?: "-"} | 最近登录 ${u.lastLoginAt?.take(10) ?: "-"}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
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
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(value, style = MaterialTheme.typography.headlineSmall)
            Text(label, style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
