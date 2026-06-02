package com.wardrobe.data

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.*

// --------------- Config ---------------

// 后端地址：改成你自己的服务器。生产形如 https://your-domain.com/api/backend/（Caddy 反代 → FastAPI :8000）,
// 本地开发用 http://10.0.2.2:8000/api/backend/（Android 模拟器访问宿主机）。
const val BASE_URL = "https://your-domain.example.com/api/backend/"
const val IMAGE_BASE_URL = "https://your-domain.example.com/api/backend"

// --------------- DTOs ---------------

@JsonClass(generateAdapter = true)
data class Garment(
    val id: String,
    val category: String,
    @Json(name = "sub_category") val subCategory: String? = null,
    val colors: List<String>? = null,
    val season: List<String>? = null,
    val material: String? = null,
    val style: String? = null,
    @Json(name = "image_url") val imageUrl: String,
    @Json(name = "thumbnail_url") val thumbnailUrl: String? = null,
    @Json(name = "wear_count") val wearCount: Int = 0,
    @Json(name = "purchase_price") val purchasePrice: Double? = null,
    @Json(name = "purchase_link") val purchaseLink: String? = null,
    val note: String? = null,
    @Json(name = "created_at") val createdAt: String,
)

@JsonClass(generateAdapter = true)
data class FullBodyResult(
    val items: List<Garment>,
    val warnings: List<String> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class GarmentUpdate(
    val category: String? = null,
    @Json(name = "sub_category") val subCategory: String? = null,
    val colors: List<String>? = null,
    val season: List<String>? = null,
    val material: String? = null,
    val style: String? = null,
    @Json(name = "wear_count") val wearCount: Int? = null,
    @Json(name = "purchase_price") val purchasePrice: Double? = null,
    @Json(name = "purchase_link") val purchaseLink: String? = null,
    val note: String? = null,
)

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val username: String,
    val password: String,
)

@JsonClass(generateAdapter = true)
data class RegisterRequest(
    @Json(name = "invite_code") val inviteCode: String,
    val username: String,
    val password: String,
)

@JsonClass(generateAdapter = true)
data class AuthResponse(
    val ok: Boolean,
    @Json(name = "user_id") val userId: String? = null,
    val username: String? = null,
)

@JsonClass(generateAdapter = true)
data class UserInfo(
    val ok: Boolean,
    @Json(name = "user_id") val userId: String,
    val username: String,
    val nickname: String? = null,
)

@JsonClass(generateAdapter = true)
data class OutfitSuggestion(
    val name: String? = null,
    val reason: String? = null,
    @Json(name = "garment_ids") val garmentIds: List<String> = emptyList(),
)

// WearLog DTOs
@JsonClass(generateAdapter = true)
data class RecordWearRequest(
    @Json(name = "garment_ids") val garmentIds: List<String>,
    val date: String? = null,
)

@JsonClass(generateAdapter = true)
data class RecordWearResponse(
    val ok: Boolean,
    val added: Int = 0,
    val date: String? = null,
)

@JsonClass(generateAdapter = true)
data class WearLogMonth(
    val month: String = "",
    val days: Map<String, List<String>> = emptyMap(),
)

@JsonClass(generateAdapter = true)
data class WearTopItem(
    val id: String,
    @Json(name = "sub_category") val subCategory: String? = null,
    val category: String = "",
    @Json(name = "image_url") val imageUrl: String = "",
    @Json(name = "wear_count") val wearCount: Int = 0,
)

@JsonClass(generateAdapter = true)
data class WearStats(
    val top: List<WearTopItem> = emptyList(),
    val week: Map<String, Int> = emptyMap(),
    @Json(name = "total_wears") val totalWears: Int = 0,
)

// Admin DTOs
@JsonClass(generateAdapter = true)
data class AdminLoginRequest(val password: String)

@JsonClass(generateAdapter = true)
data class AdminLoginResponse(val ok: Boolean)

@JsonClass(generateAdapter = true)
data class AdminStats(
    @Json(name = "user_count") val userCount: Int = 0,
    @Json(name = "garment_count") val garmentCount: Int = 0,
    val categories: Map<String, Int> = emptyMap(),
    @Json(name = "upload_files") val uploadFiles: Int = 0,
    @Json(name = "upload_size_mb") val uploadSizeMb: Double = 0.0,
)

@JsonClass(generateAdapter = true)
data class AdminUserBrief(
    val id: String,
    val username: String,
    val nickname: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "last_login_at") val lastLoginAt: String? = null,
    @Json(name = "garment_count") val garmentCount: Int = 0,
)

@JsonClass(generateAdapter = true)
data class AdminUsersResponse(val users: List<AdminUserBrief> = emptyList())

// --------------- Cookie Jar ---------------

/** 内存 cookie jar，自动管理 wardrobe_session cookie。 */
class InMemoryCookieJar : CookieJar {
    private val store = mutableMapOf<String, List<Cookie>>()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        store[url.host] = cookies
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        return store[url.host].orEmpty()
    }

    fun clear() {
        store.clear()
    }
}

// --------------- API Service ---------------

interface WardrobeService {
    // Auth
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): AuthResponse

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): AuthResponse

    @GET("auth/me")
    suspend fun me(): UserInfo

    @POST("auth/logout")
    suspend fun logout(): Response<Unit>

    // Garments
    @GET("garments")
    suspend fun listGarments(
        @Query("category") category: String? = null,
        @Query("limit") limit: Int = 100,
    ): List<Garment>

    @GET("garments/{id}")
    suspend fun getGarment(@Path("id") id: String): Garment

    @Multipart
    @POST("garments")
    suspend fun uploadSingle(
        @Part file: MultipartBody.Part,
        @Part("category") category: String? = null,
    ): Garment

    @Multipart
    @POST("garments/from-full-body")
    suspend fun uploadFullBody(
        @Part file: MultipartBody.Part,
    ): FullBodyResult

    @PATCH("garments/{id}")
    suspend fun updateGarment(
        @Path("id") id: String,
        @Body body: GarmentUpdate,
    ): Garment

    @DELETE("garments/{id}")
    suspend fun deleteGarment(@Path("id") id: String): Response<Unit>

    // Outfits
    @POST("outfits/suggest")
    suspend fun suggestOutfits(
        @Query("count") count: Int = 3,
    ): List<OutfitSuggestion>

    // WearLog
    @POST("wearlog")
    suspend fun recordWear(@Body body: RecordWearRequest): RecordWearResponse

    @GET("wearlog")
    suspend fun getWearLog(@Query("month") month: String? = null): WearLogMonth

    @GET("wearlog/stats")
    suspend fun getWearStats(): WearStats

    // Admin
    @POST("admin/login")
    suspend fun adminLogin(@Body body: AdminLoginRequest): AdminLoginResponse

    @GET("admin/stats")
    suspend fun adminStats(): AdminStats

    @GET("admin/users")
    suspend fun adminUsers(): AdminUsersResponse
}

// --------------- Singleton ---------------

val cookieJar = InMemoryCookieJar()

object WardrobeApi : WardrobeService by buildService()

private fun buildService(): WardrobeService {
    val ok = OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(180, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        })
        .build()
    val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    return Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(ok)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()
        .create(WardrobeService::class.java)
}

// --------------- Export (binary download) ---------------

/**
 * 下载用户数据 ZIP 并保存到 Downloads 目录。返回保存的文件路径。
 */
suspend fun exportToDownloads(context: android.content.Context): java.io.File {
    return kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        val request = okhttp3.Request.Builder()
            .url("${BASE_URL}export")
            .get()
            .build()
        val client = OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(300, java.util.concurrent.TimeUnit.SECONDS)
            .build()
        val resp = client.newCall(request).execute()
        if (!resp.isSuccessful) {
            throw Exception("导出失败: HTTP ${resp.code}")
        }
        val body = resp.body ?: throw Exception("响应体为空")

        // 从 Content-Disposition 取文件名
        val cd = resp.header("Content-Disposition") ?: ""
        val filename = Regex("""filename="?(.+?)"?$""").find(cd)?.groupValues?.get(1)
            ?: "wardrobe-export.zip"

        // 保存到 app 私有 Downloads 目录（不需要权限）
        val dir = context.getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS)
            ?: throw Exception("无法访问存储目录")
        dir.mkdirs()
        val file = java.io.File(dir, filename)
        file.outputStream().use { out ->
            body.byteStream().use { it.copyTo(out) }
        }
        file
    }
}
