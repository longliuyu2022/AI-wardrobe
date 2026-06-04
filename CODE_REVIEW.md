# 代码审查报告

> **审查日期**:2026-06-04
> **审查范围**:`backend/`(FastAPI)、`ai/`(AI 推理服务)、`web/`(Next.js 前端)、`android/`(Kotlin 客户端)全部源码
> **审查方式**:人工逐文件审查 + 子代理辅助审查 + 关键发现逐条回源码核实
> **代码规模**:后端 ~1150 行 · AI ~600 行 · Web ~3300 行 · Android ~2200 行

## 总览

项目整体质量不错:架构清晰、前后端分离;**后端各业务端点的用户隔离(`user_id` / `sid` 过滤)一致且正确,未发现越权漏洞**——这是最关键的安全面,做对了。Web 健壮性高于一般项目(每个 fetch 检查 `res.ok`、上传带重试与轮询恢复、token 走 httponly cookie、无 XSS 面)。

下表是值得修复的问题,按优先级排列。位置均已回源码核实。

---

## 🔴 高优先级(建议公开发布前修复)

### H1. 管理员认证把明文密码当 token
- **位置**:`backend/src/wardrobe_api/routers/admin.py:40`(`_check_admin` 配套于 :21-25)
- **问题**:登录成功后 cookie 直接存 `value=settings.admin_code`(密码原文),校验时比较 `cookie == admin_code`。等于把长期密码当 bearer token:无签名、服务端不校验过期,cookie 一旦泄漏即等于永久管理员权限(直到手改配置)。
- **修复**:登录成功后用 `itsdangerous` 签发带时效的 token(复用 `security.py` 中 `issue_session` 的模式),cookie 存签名 token 而非密码;校验时验签 + 校验 max_age。

### H2. 默认签名密钥可能被带入生产
- **位置**:`backend/src/wardrobe_api/settings.py:28`(`oss_secret_key` :17 同理)
- **问题**:`session_secret` 默认值是公开的占位串,且用于 `itsdangerous` 签 session。部署者忘改,攻击者即可用公开默认值**伪造任意用户的登录态**。
- **修复**:启动时若 `debug=False` 而 `session_secret` 仍为默认值,直接 fail-fast 拒绝启动并提示。

### H3. `imghdr` 在 Python 3.13 已被移除
- **位置**:`backend/src/wardrobe_api/routers/garments.py:5,31`;`pyproject.toml` 声明 `requires-python = ">=3.11"`
- **问题**:`imghdr` 在 3.11/3.12 已弃用、3.13 整个模块删除。任何人用 Python 3.13 运行时 `import imghdr` 直接崩溃。
- **修复**:改用 Pillow 自身识别格式(`Image.open(...).format`),或引入 `filetype` 库;不再依赖标准库 `imghdr`。

---

## 🟠 确定的功能 Bug(改动小、收益明确)

### B1. 衣物列表的季节过滤发生在分页之后
- **位置**:`backend/src/wardrobe_api/routers/garments.py:62-64`
- **问题**:先 `.limit(50).all()` 取最新 50 件,再在 Python 内存里按 `season` 过滤。衣物 >50 且按季节筛选时会漏掉排在 50 名之后的符合项。
- **修复**:把 season 过滤下推到 DB 查询、`limit` 之前(SQLite/MySQL 可用 JSON 包含查询,或用 `LIKE` 兜底)。

### B2. 首页颜色标签显示英文(死代码三元)
- **位置**:`web/app/page.tsx:164`
- **问题**:`{zhCategory(c) ? c : c}` 两个分支都返回 `c`,且对颜色值误用了类目翻译函数,导致颜色标签显示英文原文(如 "white")。
- **修复**:改为 `{zhColor(c)}`(项目其余页面均用 `zhColor`,此处为笔误)。

### B3. "清空材质/风格"失效、会存空串
- **位置**:`web/app/wardrobe/[id]/page.tsx:146-147`
- **问题**:`MATERIAL_REV[material.trim()] ?? material.trim() ?? null` —— 当 `material.trim()` 为 `""` 时,`""` 不是 null/undefined,`?? null` 不会触发回退,最终发送空字符串而非 null,清空意图无法达成。
- **修复**:改为 `material.trim() ? (MATERIAL_REV[material.trim()] ?? material.trim()) : null`,`style` 同理(与同文件其他字段的 `|| null` 写法保持一致)。

---

## 🟠 中等(安全 / 健壮性)

### M1. 登录端点无限流 / 防爆破
- **位置**:`backend/.../routers/auth.py`(login)、`admin.py`(login)
- **说明**:bcrypt 提供一定缓解但不足以防在线爆破。建议加 `slowapi` 限流或失败次数锁定。

### M2. AI 服务全部端点无鉴权
- **位置**:`ai/src/wardrobe_ai/main.py`
- **说明**:生产 `docker-compose.prod.yml` 中 AI 服务在内网、未暴露端口(✅ 已缓解);但一旦误暴露端口,任何人可消耗付费 quota / 上传任意图。建议加 backend↔ai 的内部共享 token 校验。

### M3. AI 服务无文件大小 / 类型限制
- **位置**:`ai/src/wardrobe_ai/main.py:37-48`
- **说明**:直接 `read()` 入内存 + PIL 打开(解压炸弹风险)。backend 有 20MB 限制,但 AI 服务自身没有;若被直连可致 OOM。建议 AI 侧也加大小上限并设置 `Image.MAX_IMAGE_PIXELS`。

### M4. Web 多处 useEffect 异步 setState 无防护
- **位置**:`web/lib/auth-gate.tsx`、`web/app/calendar/page.tsx:21-29`、`wardrobe/*` 等
- **说明**:组件卸载后 setState、以及快速切换时 `Promise.all` 旧响应覆盖新状态的竞态。建议用 `ignore` 标志或 `AbortController` 收口;`calendar` 翻月时把与月份无关的 stats/garments 拆到 `[]` 依赖的独立 effect。

### M5. Android 全局允许明文 HTTP
- **位置**:`android/app/src/main/AndroidManifest.xml:13`(`usesCleartextTraffic="true"`)
- **说明**:生产应全程 HTTPS。建议用 `network_security_config` 仅对本地调试域名放行,或仅 debug build 开启。

### M6. Android FileProvider 路径过宽
- **位置**:`android/app/src/main/res/xml/file_paths.xml:3`(`<cache-path path="/" />`)
- **说明**:暴露整个 cache 根目录。provider `exported=false`(✅ 仅显式 grant 可达),仍应收窄到具体子目录(如 `path="camera/"`)。

> **对子代理评级的两处纠正**:
> - **CSRF**:Web 子审查曾列为头号风险,但后端 cookie 已设 `samesite="strict"` + `secure=True`(`auth.py:48`/`admin.py:44`),CSRF 已被缓解,**非高危**。
> - **Android CookieJar**(`ApiClient.kt:171` 按 host 整表覆盖):对本项目单一 session cookie 能正常工作,实现不通用但**仅低危**。

---

## 🟡 低 / 代码质量

- **死代码**:`settings.py:31-33` 的 JWT 配置、`schemas.py` 的 `PhoneLoginRequest`/`AuthToken` 全程未用;`python-jose` 依赖也未使用(且有历史 CVE)——建议移除。
- `auth.py:65-78` register 无 `IntegrityError` 兜底,并发同名注册会 500 而非 409。
- `garments.py:301` 删除衣物只删原图、不删 `_thumb.jpg`,缩略图文件泄漏堆积。
- `datetime.utcnow()` 多处已弃用(auth / garments / wearlog / export),建议 `datetime.now(UTC)`(`health.py` 已是正确写法)。
- `export.py:71` 导出图片名写死 `.jpg`,png/webp 原图会名不副实。
- `GarmentUpdate` 允许客户端经 PATCH 任意覆盖 `wear_count`,可与 `WearLog` 不一致。
- `admin.py` 用 `next(get_db())` 手动管理 session,与其他 router 的 `Depends(get_db)` 风格不一致。
- AI `vlm.py:32`:配了 `doubao_api_key` 但未配 sensenova 时会 `raise NotImplementedError`;都未配时返回 `["_stub_tag"]` 会污染真实标签。
- Android `ApiClient.kt:22-23` 域名为占位符需改源码重编译;`IMAGE_BASE_URL` 末尾再拼后端返回的 `/api/backend/uploads/...` 可能产生重复 `/api/backend`,建议核对。

---

## ✅ 做得好的地方

- 后端授权隔离(每个端点 `filter(user_id == sid)` / 检查 `g.user_id != sid`)一致且正确,无越权。
- StaticFiles 路径穿越由 Starlette 兜底;落盘文件名用 uuid、不可被用户控制。
- 上传用 magic bytes 推扩展名(不信任 `content_type`)、有 20MB 上限、强制图片扩展名。
- Web 无 `dangerouslySetInnerHTML`,token 走 httponly cookie 而非 localStorage。
- 全身照原图"只在内存处理、不落盘"的隐私设计贯彻到位(`del image_bytes` + 注释)。

---

## 修复优先级

1. **H1** 管理员 token 改签名
2. **H2** 启动 fail-fast 校验默认密钥
3. **H3** `imghdr` 替换
4. **B1 / B2 / B3** 三个功能 Bug
5. **L** 清理 JWT / python-jose 死代码
6. 其余中 / 低项按需推进

---

## 附:审查覆盖文件

- **backend**:`main.py` `db.py` `models.py` `schemas.py` `security.py` `settings.py` + `routers/{auth,garments,outfits,wearlog,export,admin,health}.py`
- **ai**:`main.py` `settings.py` + `clients/{sensenova,vlm,viapi,segmentation}.py` + `pipelines/{single_item,full_body}.py`
- **web**:`lib/{api,auth-gate,i18n}.ts(x)` + `app/**/*.tsx` + `components/*.tsx` + `next.config.mjs`
- **android**:`AndroidManifest.xml` `file_paths.xml` `data/ApiClient.kt` + UI 屏幕
- **部署**:`docker-compose.yml` `docker-compose.prod.yml` `Caddyfile`
