package com.wardrobe.ui.screens

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.wardrobe.data.WardrobeApi
import kotlinx.coroutines.Dispatchers
import retrofit2.HttpException
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream

private enum class Mode { FULL_BODY, SINGLE }

/** 把 Uri 读成 ByteArray，缩放到长边 maxPx，JPEG quality 压缩。 */
private suspend fun compressImage(
    context: android.content.Context,
    uri: Uri,
    maxPx: Int = 1024,
    quality: Int = 80,
): ByteArray = withContext(Dispatchers.IO) {
    val input = context.contentResolver.openInputStream(uri)!!
    val raw = input.use { it.readBytes() }
    val bmp = BitmapFactory.decodeByteArray(raw, 0, raw.size)
        ?: throw Exception("无法读取图片")

    val (w, h) = bmp.width to bmp.height
    val scale = if (maxOf(w, h) > maxPx) maxPx.toFloat() / maxOf(w, h) else 1f
    val nw = (w * scale).toInt().coerceAtLeast(1)
    val nh = (h * scale).toInt().coerceAtLeast(1)

    val scaled = Bitmap.createScaledBitmap(bmp, nw, nh, true)
    val out = ByteArrayOutputStream()
    scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
    out.toByteArray()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UploadScreen(onDone: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var mode by remember { mutableStateOf(Mode.FULL_BODY) }
    var preview by remember { mutableStateOf<Bitmap?>(null) }
    var imageBytes by remember { mutableStateOf<ByteArray?>(null) }
    var uploading by remember { mutableStateOf(false) }
    var resultMsg by remember { mutableStateOf<String?>(null) }
    var isError by remember { mutableStateOf(false) }

    fun processUri(uri: Uri) {
        scope.launch {
            try {
                val bytes = compressImage(context, uri)
                imageBytes = bytes
                preview = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                resultMsg = null
            } catch (e: Exception) {
                resultMsg = "图片处理失败: ${e.message}"
                isError = true
            }
        }
    }

    // 相册选择
    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { processUri(it) }
    }

    // 相机拍照
    var cameraUri by remember { mutableStateOf<Uri?>(null) }
    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success: Boolean ->
        if (success) cameraUri?.let { processUri(it) }
    }

    fun upload() {
        val bytes = imageBytes ?: return
        uploading = true
        resultMsg = null
        scope.launch {
            try {
                val body = bytes.toRequestBody("image/jpeg".toMediaTypeOrNull())
                val part = MultipartBody.Part.createFormData("file", "photo.jpg", body)

                if (mode == Mode.FULL_BODY) {
                    val result = WardrobeApi.uploadFullBody(part)
                    val count = result.items.size
                    val warns = result.warnings
                    resultMsg = buildString {
                        append("成功拆出 $count 件衣物")
                        if (warns.isNotEmpty()) append("，${warns.joinToString("；")}")
                    }
                } else {
                    WardrobeApi.uploadSingle(part)
                    resultMsg = "上传成功，AI 已识别属性"
                }
                isError = false
                preview = null
                imageBytes = null
            } catch (e: retrofit2.HttpException) {
                val body = try { e.response()?.errorBody()?.string()?.take(200) } catch (_: Exception) { null }
                resultMsg = "上传失败 (${e.code()}): ${body ?: e.message()}"
                isError = true
            } catch (e: Exception) {
                resultMsg = "上传失败: ${e.message}"
                isError = true
            } finally {
                uploading = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("上传衣物") },
                navigationIcon = {
                    IconButton(onClick = onDone) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
            )
        },
    ) { inner ->
        Column(
            modifier = Modifier
                .padding(inner)
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // 模式切换
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = mode == Mode.FULL_BODY,
                    onClick = { mode = Mode.FULL_BODY },
                    label = { Text("全身照分部位") },
                )
                FilterChip(
                    selected = mode == Mode.SINGLE,
                    onClick = { mode = Mode.SINGLE },
                    label = { Text("单件") },
                )
            }

            Text(
                if (mode == Mode.FULL_BODY)
                    "上传一张穿搭照，AI 自动拆出上衣/外套/裤/鞋/包。原图不存储。"
                else
                    "上传一件衣物的图，AI 识别类目和属性。",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            // 图片预览
            if (preview != null) {
                Image(
                    bitmap = preview!!.asImageBitmap(),
                    contentDescription = "预览",
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 300.dp),
                    contentScale = ContentScale.Fit,
                )
            }

            // 选择图片来源
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = { galleryLauncher.launch("image/*") },
                    enabled = !uploading,
                    modifier = Modifier.weight(1f),
                ) { Text("从相册选择") }
                Button(
                    onClick = {
                        try {
                            val file = java.io.File(context.cacheDir, "camera_${System.currentTimeMillis()}.jpg")
                            file.createNewFile()
                            cameraUri = androidx.core.content.FileProvider.getUriForFile(
                                context, "${context.packageName}.fileprovider", file
                            )
                            cameraLauncher.launch(cameraUri!!)
                        } catch (e: Exception) {
                            resultMsg = "无法启动相机: ${e.message}"
                            isError = true
                        }
                    },
                    enabled = !uploading,
                    modifier = Modifier.weight(1f),
                ) { Text("拍照") }
            }

            // 上传按钮
            if (imageBytes != null) {
                Button(
                    onClick = { upload() },
                    enabled = !uploading,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (uploading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("上传中…")
                    } else {
                        Text(if (mode == Mode.FULL_BODY) "上传全身照" else "上传单件")
                    }
                }
            }

            // 结果提示
            if (resultMsg != null) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (isError) MaterialTheme.colorScheme.errorContainer
                        else MaterialTheme.colorScheme.primaryContainer,
                    ),
                ) {
                    Text(
                        text = resultMsg!!,
                        modifier = Modifier.padding(16.dp),
                        color = if (isError) MaterialTheme.colorScheme.onErrorContainer
                        else MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }

            // 上传成功后显示"返回衣橱"按钮
            if (resultMsg != null && !isError) {
                Button(
                    onClick = onDone,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("返回衣橱") }
            }
        }
    }
}
