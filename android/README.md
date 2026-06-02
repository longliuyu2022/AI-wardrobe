# Wardrobe Android

Kotlin + Jetpack Compose 客户端。

## 开发

推荐用 **Android Studio Ladybug**（含 AGP 8.7+），打开 `android/` 目录，等 Gradle 同步完成后运行 `app`。Gradle wrapper（`gradlew`、`gradle-wrapper.jar`）会在首次同步时自动下载。

纯命令行：

```bash
# 首次：生成 gradle wrapper（需要本地装了 gradle 8.10+）
gradle wrapper --gradle-version 8.10

# 启动模拟器后
./gradlew installDebug
```

## baseUrl

默认指向 `http://10.0.2.2:8000/`（Android 模拟器访问宿主机 localhost 的特殊地址）。

- **真机调试**：改成你电脑的局域网 IP（修改 `ApiClient.kt` 的 `BASE_URL`）
- **生产**：改成 `https://api.wardrobe.example.com/`

## 项目布局

```
android/
├── settings.gradle.kts
├── build.gradle.kts
├── gradle.properties
└── app/
    ├── build.gradle.kts
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── kotlin/com/wardrobe/
        │   ├── MainActivity.kt
        │   ├── WardrobeApp.kt          NavHost
        │   ├── ui/theme/                Material3 主题（莫兰迪低饱和色）
        │   ├── ui/screens/              Compose 页面
        │   └── data/ApiClient.kt        Retrofit + Moshi
        └── res/values/
```

## 待办（Phase 1）

- [ ] 相机/相册 picker（ActivityResultContracts）
- [ ] 实际上传 multipart 到 backend
- [ ] 用 openapi-generator 从 `../openapi/wardrobe.openapi.yaml` 生成 Kotlin DTO
- [ ] 微信登录 SDK 接入（Phase 2）
