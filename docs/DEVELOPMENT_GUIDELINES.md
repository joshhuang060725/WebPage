# Development Guidelines

本文是 Josh Huang Personal Portal 的開發準則。目標是讓網站在內容、UI、資料來源與未來功能擴充上保持高可維護性。

## Core Principles

- Static first: 第一版保持純 HTML/CSS/JS，不引入 build dependency。
- Data separated from UI: 可變內容放在 `data/*.json`，不要把專案、連結、工具清單硬寫進 HTML。
- Public by omission: 只公開明確安全的內容；私密入口不以 hidden link 方式存在於前端。
- Page based navigation: 功能區塊用獨立頁面承載，不把所有能力塞進首頁。
- API ready, API optional: 資料形狀先用 JSON 固定，未來 API 必須兼容目前 shape。
- Small modules: 每個 JS render function 只負責一種資料，例如 profile、projects、shortcuts、tools。

## File Ownership

### `index.html`

用途：

- 首頁入口。
- SEO / Open Graph / Twitter Card / JSON-LD。
- JATS 品牌 lockup。
- 首頁 dashboard 模組。

規則：

- `JATS` 與 `Josh Auxiliary Terminal System` 固定寫在 HTML，不使用 i18n。
- 首頁只放宣傳、入口與狀態，不放完整工具功能。
- 搜尋框目前是介面預留；不得連到私密後台或內部搜尋。
- 改首頁導航時，同步檢查 sitemap、README 與其他頁面的 nav。

### Content Pages

用途：

- `profile.html`: 個人資料與公開聯絡方式。
- `wallpapers.html`: 動態桌布預覽與切換，不提供公開上傳。
- `projects.html`: 專案展示。
- `links.html`: 公開安全快速連結。
- `youtube.html`: YouTube 搜尋、播放器與側邊標題 ticker。
- `tools.html`: 工具入口與狀態。
- `files.html`: 公開下載頁，只讀取 `data/files.json`。

規則：

- 每頁都使用同一套 nav、language selector、data loader 與 main script。
- 每頁都保留 canonical、description、robots。
- 新增頁面時，必須更新 `sitemap.xml`、README 與 nav。

### `styles.css`

用途：

- 設計 token。
- 全站 layout。
- 共用 component。
- responsive behavior。

規則：

- 優先使用 `:root` token，不要在各處散落新 hex color。
- 新增 component 時命名要描述用途，例如 `.terminal-home`、`.dash-module`。
- 避免過度裝飾；此站的方向是 restrained industrial，不是華麗 landing page。
- 改 mobile layout 必須檢查 360px、768px、desktop。
- 文字不可依 viewport 無限制縮放；使用 `clamp()` 時要設合理上下限。

### `js/data-loader.js`

用途：

- 集中處理資料來源。
- 目前讀本地 JSON。
- 未來可切換 API。

規則：

- 不要在 page script 裡直接 fetch 多個資料檔。
- API 版本必須輸出與目前 JSON 相同的資料 shape。
- 若 API 失敗，UI 仍需有 fallback。

### `js/main.js`

用途：

- 語言偵測與切換。
- 時間更新。
- JSON 資料渲染。
- fallback rendering。

規則：

- 新功能用獨立 `renderX()`，不要塞進單一大型 function。
- DOM selector 必須容忍元素不存在，因為不同頁面只會有部分容器。
- 不要在前端儲存或組合敏感 URL。
- i18n 文字用 `data-i18n` 或 `data-i18n-placeholder`。

### `js/youtube.js`

用途：

- YouTube 搜尋表單。
- YouTube IFrame Player API 控制。
- 搜尋結果列表與側邊 ticker。
- 同一查詢 1 小時 localStorage 快取。

規則：

- 只有使用者提交搜尋時才能呼叫 `/api/youtube/search`。
- 不做自動輪詢、不做自動推薦鏈。
- 不在前端放 `YOUTUBE_API_KEY` 或任何 API secret。
- API 失敗時顯示狀態文字，不能讓頁面壞掉。

### `data/*.json`

用途：

- 公開內容資料源。

規則：

- JSON 必須可被 `python -m json.tool` 驗證。
- 多語內容格式優先使用：

```json
{
  "en": "...",
  "zh-TW": "...",
  "zh-CN": "..."
}
```

- 至少保留 `en` fallback。
- 不存放 secret、token、私人 URL、內網資訊。

## UI/UX Standards

### Visual Direction

整體關鍵字：

- dark
- industrial
- terminal-like
- modular
- public but personal
- precise

Night mode 是主視覺，不要在沒有明確需求時修改。Day mode 是同一個 JATS 系統的透明玻璃外觀，不是新的品牌方向。

核心色：

- `#FFD900`: JATS yellow，品牌重點與主 CTA。
- `#2AAACE`: 資訊藍，時間與系統狀態。
- `#202020`: 深色基底。
- `#333333`: 次級表面。
- `#D6D8D9`: 邊框與弱文字。
- `#E5622B`: warning / coming soon。

### Theme Mode Rules

#### Night Mode

- 保持目前的 JATS dark industrial terminal 設計。
- 不修改夜間模式的 `:root` token、暗色背景、暗色卡片材質與 terminal grid，除非使用者明確要求。
- 黑灰基底、`#FFD900`、`#2AAACE` 與高對比白字是夜間模式的基本識別。
- 新增元件時先在 night mode 中遵守既有 panel/card/button 結構，不額外創造一套暗色視覺語言。

#### Day Mode

- Day mode 只透過 `body[data-theme="light"]` 相關 selector 調整，避免影響 night mode。
- 視覺參考 Apple Liquid Glass / HIG Materials：玻璃效果應建立功能層級，主要放在 navigation、controls、cards 等浮動功能層。
- Day mode 主色規則：
  - Active Blue: `#3F7DF6` / nearby blue values，僅用於活動導航、開關狀態與核心控制。
  - Background: `#EDF6FB` 為基底，搭配低飽和冰藍/霧白 mesh。
  - Glass Base: `rgba(247, 252, 255, 0.72)` 附近，用於資訊承載層。
  - Text Primary: 深藍灰系，例如 `#1B2B41`、`#16243A`。
  - Text Secondary: 藍灰系，例如 `#50667C`、`#53677C`。
  - Specular: 高透明白色，例如 `rgba(255, 255, 255, 0.82)`，用於玻璃邊緣高光。
- 背景層使用淺色冰藍到霧白的光學 mesh、細網格與柔和環境光，保留 JATS 技術感但避免大面積深藍。
- 玻璃層使用輕量 `backdrop-filter: blur(...) saturate(...) contrast(...)`，並搭配 Glass Base 半透明填色、1px specular 高光邊界、多層內陰影與極低透明度紋理。
- 文字可讀性優先。正文、按鈕與 nav 文字不得因透明材質而低對比；標題可以使用藍色漸層文字，但要保持深色端足夠清楚。
- 效能優先。不要在大量卡片上使用 SVG `feDisplacementMap` 或 `backdrop-filter: url(#filter)`；此類折射效果只可作為少量 hero/展示元件實驗，且必須經過互動流暢度確認。
- 避免把 Liquid Glass 用成內容背景的大面積裝飾。內容模組仍需清楚分區，互動元素才使用更明顯的玻璃與高光。
- Hover/active 只做微幅放大、陰影與高光變化，不做大幅位移或誇張動畫。

### Layout Logic

- Desktop 使用左側導航，主內容區保持寬畫布。
- Mobile 使用 sticky top header，不顯示左側導航。
- 首頁使用大型 terminal board，避免傳統 hero + marketing card。
- 首頁資訊必須模組化，每個區塊用獨立方框隔離，避免自由散落在畫布上。
- Profile / Projects / Links / Tools 使用獨立頁面，讓後續功能可各自擴充。
- 卡片只用於重複資料項目，不做多層卡片嵌套。

### Homepage Logic

首頁要回答三件事：

1. 這是誰：Josh Huang。
2. 這是什麼：JATS / Josh Auxiliary Terminal System。
3. 可以去哪：Profile、Projects、Quick Links、Tools。

草圖轉換為實作：

- 左側 module list: Time、Place、Weather、GitHub、Ping、Tool。
- 右側 identity area: JATS、Josh Auxiliary Terminal System、Josh、motto、search box。
- 下方 footer line: JATS Josh Auxiliary Terminal System。
- Place 使用 public IP 做城市級估算。
- Weather 使用 Place 得到的座標查詢當前天氣。
- IP/weather API 失敗時只降級顯示 unavailable，不能讓首頁空白或報錯。

## Internationalization

語言規則：

- `zh-TW` / `zh-HK` / `zh-MO` 對應繁體。
- 其他 `zh-*` 對應簡體。
- 其他語言預設英文。
- 使用者手動切換後存入 `localStorage`。

實作規則：

- 翻譯字串集中在 `data/i18n.json`。
- JATS lockup 不翻譯。
- 每個翻譯 key 至少提供英文。
- placeholder 使用 `data-i18n-placeholder`。

## API Readiness

未來可以將：

```text
data/profile.json
data/projects.json
data/shortcuts.json
data/tools.json
data/files.json
data/i18n.json
```

替換為：

```text
GET /api/profile
GET /api/projects
GET /api/shortcuts
GET /api/tools
GET /api/i18n
```

但 API response 必須維持同樣 shape，避免 UI 層重寫。

YouTube 搜尋是目前唯一已預留的 Cloudflare Pages Function：

```text
GET /api/youtube/search?q={query}&lang={language}
```

Function 規則：

- 從 Cloudflare Pages 環境變數讀 `YOUTUBE_API_KEY`。
- 僅回傳整理後的影片 id、title、channelTitle、thumbnail、publishedAt。
- 不回傳 API key、完整 Google API payload 或不必要的私密錯誤內容。
- `q` trim 後限制 1-80 字。
- YouTube API 錯誤要轉成可讀 JSON error。

## Wallpaper Page Standards

`wallpapers.html` is an application-like page with two full-screen panels:

- Panel 0: a clean terminal wallpaper surface.
- Panel 1: the same wallpaper surface plus browser search and a fixed 6 x 3 shortcut grid.

Implementation rules:

- Keep both panels inside one `.wallpaper-track`.
- Change panels only through `setWallpaperPanel(0 | 1)`.
- Do not allow a resting state between panels.
- Desktop input uses wheel gestures; touch devices use horizontal swipe.
- Background presets are stored in `data/wallpapers.json` under `backgrounds`.
- Shortcut tiles are stored in `data/wallpapers.json` under `links` and must remain public-safe.
- A selected background updates CSS variables on `#wallpaper-viewport`, so both panels stay synchronized.
- Future images/videos should be referenced by public static paths. Do not add upload, admin, token, tunnel, or local LAN features to this public page.

## File Upload Standards

Personal file uploads are managed by the local-only `WebPageAdmin` tool, not by the public website.

Website storage:

```text
assets/files/*
data/files.json
```

Rules:

- Supported public file types: `.zip`, `.pdf`, `.doc`, `.docx`, `.cpp`, `.c`, `.h`, `.hpp`, `.txt`, `.py`, `.md`, `.json`, `.csv`.
- Every entry in `data/files.json` must include `id`, `name`, `description`, `path`, `extension`, `size`, and `uploadedAt`.
- Sort file entries by latest `uploadedAt`.
- Cloudflare Pages rejects any single static asset larger than 25 MiB. Keep files under 25 MiB, compress them before publishing, or move larger assets to external object storage such as Cloudflare R2 and link them from metadata.
- Do not upload secrets, API keys, private documents, or local-only paths.
- Do not implement public browser upload or delete endpoints on the Cloudflare Pages site.
- Public downloads are rendered through `files.html`; upload/delete remains local-admin only.

## Formula Derivation Standards

Formula modules are data-driven and public-read-only.

Website storage:

```text
data/formulas.json
formulas.html
formula.html
js/formulas.js
js/formula-detail.js
```

Rules:

- Use `formulas.html` as the formula index and `formula.html?id={formulaId}` as the shared detail renderer.
- Important modules may receive a dedicated entry route later, but they must still use the shared renderer and `data/formulas.json`.
- Keep title, category, status, tags, summary, TeX formula strings, derivation sections, and interaction settings in `data/formulas.json`.
- Do not hard-code formula content into page HTML.
- Static derivation modules only need JSON updates.
- Interactive modules must add a named calculation handler in `js/formula-detail.js`.
- Use frontend JavaScript for v1 calculations; do not add public write APIs or backend compute endpoints.
- KaTeX and Plotly are CDN dependencies for v1. If either CDN fails, the page must degrade with text and a visible fallback message.
- Admin editing remains local-only through `WebPageAdmin`; public users must not be able to upload, edit, or delete formulas.

QA additions:

```powershell
python -m json.tool data\formulas.json > $null
node --check js\formulas.js
node --check js\formula-detail.js
```

## Security Boundary

禁止進 repo 或公開前端：

- `.env`
- API key
- `YOUTUBE_API_KEY` value
- token
- private dashboard URL
- Cloudflare Tunnel 私人 URL
- 本地 IP / 內網位置
- 管理頁或資料上傳入口

允許公開：

- GitHub profile
- 公開 email 或公開社交連結
- 公開專案
- 工具狀態與 coming soon 說明
- public IP 推算出的城市級位置與天氣狀態

## QA Before Commit

```powershell
python -m json.tool data\profile.json > $null
python -m json.tool data\projects.json > $null
python -m json.tool data\shortcuts.json > $null
python -m json.tool data\tools.json > $null
python -m json.tool data\wallpapers.json > $null
python -m json.tool data\files.json > $null
python -m json.tool data\i18n.json > $null
node --check js\data-loader.js
node --check js\main.js
node --check js\youtube.js
node --check functions\api\youtube\search.js
```

Browser route check:

- `/`
- `/profile.html`
- `/wallpapers.html`
- `/projects.html`
- `/links.html`
- `/youtube.html`
- `/tools.html`
- `/files.html`

Responsive check:

- desktop
- tablet
- mobile

Content check:

- no secret
- no private URL
- no broken i18n
- no layout overlap
- no accidental language change for JATS lockup

## Deployment Rule

依目前使用者要求：本地可以 commit，但不能 push。只有在使用者明確說「上傳」、「push」、「up 到 GitHub」時才執行：

```powershell
git push origin main
```

## Maintenance Workflow

1. 修改內容資料。
2. 修改 i18n。
3. 調整 UI。
4. 跑 QA。
5. 更新 `docs/DEVELOPMENT_LOG.md`。
6. Commit 或 amend。
7. 等待使用者明確同意後才 push。

## Asset and Content Decoupling Rules

JATSWeb now follows an asset/data decoupling model. The public website stays static on Cloudflare Pages, while file metadata lives in `data/files.json` and larger assets move to Cloudflare R2.

Rules:

- Public file metadata must include `storage_provider`.
- Supported providers are `git` and `r2`.
- `git` means the file is stored in this repository, usually under `assets/files/`.
- `r2` means the file is stored in Cloudflare R2 and exposed through a public URL.
- Keep Git assets below 10 MiB by default.
- Never commit a single static asset above 25 MiB because Cloudflare Pages rejects it.
- Files above 10 MiB should go to R2.
- Files above 25 MiB must go to R2 or another external object store.
- Public pages only read `public_url`; they never receive upload permissions or credentials.
- The local Admin Tool is the only write surface for upload, metadata editing, preview, checks, commit, and push.

Required `data/files.json` fields:

```json
{
  "id": "file-id",
  "name": "Display name",
  "description": "Public description",
  "fileName": "example.pdf",
  "storage_provider": "git",
  "storage_key": "assets/files/example.pdf",
  "public_url": "/assets/files/example.pdf",
  "extension": "pdf",
  "size": 12345,
  "uploadedAt": "2026-05-02T00:00:00.000Z"
}
```

For R2:

```json
{
  "storage_provider": "r2",
  "storage_key": "documents/example.pdf",
  "public_url": "https://files.joshhuang.ccwu.cc/documents/example.pdf"
}
```

See `docs/CONTENT_ASSET_ARCHITECTURE.md` for the full architecture.
