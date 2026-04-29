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

關鍵字：

- dark
- industrial
- terminal-like
- modular
- public but personal
- precise

核心色：

- `#FFD900`: JATS yellow，品牌重點與主 CTA。
- `#2AAACE`: 資訊藍，時間與系統狀態。
- `#202020`: 深色基底。
- `#333333`: 次級表面。
- `#D6D8D9`: 邊框與弱文字。
- `#E5622B`: warning / coming soon。

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
