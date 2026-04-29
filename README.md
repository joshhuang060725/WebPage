# Josh Huang Personal Portal

這是一個部署在 GitHub + Cloudflare Pages 的純靜態個人網站。第一版目標不是完整內容網站，而是建立一個可公開搜尋、可持續擴充、風格明確的個人門戶。

Production domain:

```text
https://joshhuang.ccwu.cc/
```

## Current Direction

首頁是個人宣傳與 JATS 入口。`JATS` 是固定品牌標題，不跟語言切換：

```text
JATS
Josh Auxiliary Terminal System
```

目前網站提供：

- 公開個人形象首頁
- Profile / Projects / Quick Links / Tools 的獨立頁面
- 深色簡約工業風 UI
- 本地 JSON 內容資料
- IP 估算位置與即時天氣模組
- `zh-TW` / `zh-CN` / `en` 本地多語系
- 未來 API、工具模組與 Cloudflare Pages Functions 的預留結構

## Architecture

此專案不使用 Node build 流程。Cloudflare Pages 直接部署 repository root。

```text
WebPage/
|-- index.html                  # 首頁：JATS 終端式個人宣傳入口
|-- profile.html                # 個人介紹與公開聯絡方式
|-- wallpapers.html             # 動態桌布預覽與切換頁
|-- projects.html               # 專案展示頁
|-- links.html                  # 公開安全快速連結
|-- youtube.html                # YouTube 搜尋、嵌入播放器與側邊標題 ticker
|-- tools.html                  # Exchange / Compute Lab / UX Lab 入口
|-- styles.css                  # 全站 UI token、layout、components
|-- js/
|   |-- data-loader.js          # JSON-first data source，未來可切 API
|   |-- main.js                 # i18n、clock、資料渲染、fallback
|   `-- youtube.js              # YouTube 搜尋 UI、播放器、ticker、本機快取
|-- functions/
|   `-- api/youtube/search.js   # Cloudflare Pages Function proxy，不暴露 API key
|-- data/
|   |-- profile.json            # 個人資料與公開聯絡資訊
|   |-- projects.json           # 專案卡片資料
|   |-- shortcuts.json          # 公開快速連結
|   |-- tools.json              # 工具入口狀態
|   |-- wallpapers.json         # 動態桌布清單與素材路徑
|   `-- i18n.json               # zh-TW / zh-CN / en 字典
|-- favicon.svg
|-- og-image.svg
|-- robots.txt
|-- sitemap.xml
`-- docs/
    |-- DEVELOPMENT_GUIDELINES.md
    `-- DEVELOPMENT_LOG.md
```

## Runtime Flow

1. Browser 載入 `index.html` 或其他頁面。
2. `styles.css` 提供同一套設計語言與 responsive layout。
3. `js/data-loader.js` 讀取 `data/*.json`。
4. `js/main.js` 偵測語言、更新時間、套用翻譯並渲染資料卡片。
5. 如果 JSON 載入失敗，`main.js` 使用內建 fallback，頁面仍可顯示基本內容。

未來若要接 API，只需優先修改 `js/data-loader.js` 的資料來源，UI 層不應大改。

## UI Design

設計方向：深色、簡約、工業終端、模組化。

核心色票：

| Token | Hex | Usage |
| --- | --- | --- |
| Core Yellow | `#FFD900` | 品牌重點、狀態標籤、主要 CTA |
| Info Blue | `#2AAACE` | 時間、資訊狀態、技術感提示 |
| Base Black | `#202020` | 深色基底 |
| Surface Gray | `#333333` | 次級介面表面 |
| UI Gray | `#D6D8D9` | 邊框、弱提示文字 |
| Notice Orange | `#E5622B` | planned / coming soon |
| White | `#FFFFFF` | 高對比主文字 |

首頁 UX：

- 左側固定導航：保留「控制台」感，讓使用者知道還有其他頁面可跳轉。
- 首頁主畫面：使用單一大型終端面板，不做傳統 landing page。
- 左側 dashboard rail：放時間、位置、天氣預留、GitHub、Ping、Tool，對應使用者草圖中的資訊模組。
- 位置與天氣：位置用使用者 public IP 做城市級估算；天氣用估算座標查詢當前天氣。
- 右側 JATS lockup：固定顯示 `JATS / Josh Auxiliary Terminal System`，作為第一視覺焦點。
- 介紹文字縮小：首頁概要文字比標題與 motto 小，避免壓過品牌區。
- 搜尋框：第一版作為入口介面與未來功能預留，不暴露私密搜尋或後台能力。

## Page Strategy

網站採用跳轉不同頁面的方式，而不是把所有內容塞在首頁：

- `index.html`: 個人宣傳首頁與 JATS portal。
- `profile.html`: 公開個人介紹、技能標籤、公開聯絡方式。
- `wallpapers.html`: 動態桌布預覽與切換，真實素材後續放入 JSON。
- `projects.html`: 專案展示，後續可擴充案例研究。
- `links.html`: 只放公開安全連結。
- `youtube.html`: YouTube 搜尋、嵌入播放與側邊標題 ticker，介於 Quick Links 與 Tools 之間。
- `tools.html`: 工具模組入口，未完成前只顯示狀態。

這樣可以維持首頁清楚，也讓後續每個功能區塊能獨立演化。

## Public / Private Boundary

公開網站可以放：

- 個人介紹
- 公開專案
- 公開聯絡方式
- GitHub profile
- 未來工具的公開入口與狀態
- 使用者 public IP 推算出的城市級位置與天氣顯示

公開網站不放：

- API key / token / secret
- 私人後台 URL
- Cloudflare Tunnel 私有服務入口
- 管理頁、資料上傳頁、網站編輯入口
- 本地 IP、內網位置、敏感檔案路徑

私人功能若未來需要瀏覽器入口，應另外使用 Cloudflare Access 或獨立受保護路由。

## External Public APIs

首頁使用兩個前端公開 API：

- IP location: `https://ipapi.co/json/`
- Weather: `https://api.open-meteo.com/v1/forecast`
- YouTube Data API: only through Cloudflare Pages Function `/api/youtube/search`

注意：

- IP 位置是城市級估算，不代表精準地址。
- 這些請求由使用者瀏覽器直接發出，網站本身不儲存 IP 或天氣資料。
- API 失敗時頁面會顯示 unavailable，不影響其他模組。
- YouTube API key 只能設定在 Cloudflare Pages 環境變數 `YOUTUBE_API_KEY`，不可寫入前端或 GitHub repo。

## Local Development

此專案可直接用靜態 server 檢查：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4173/
```

不建議只用 `file://` 測試，因為瀏覽器可能阻擋 JSON `fetch()`。

## QA Checklist

提交前檢查：

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

瀏覽器檢查：

- `/`
- `/profile.html`
- `/wallpapers.html`
- `/projects.html`
- `/links.html`
- `/youtube.html`
- `/tools.html`
- Desktop / tablet / mobile 不重疊
- 語言切換可用
- JATS lockup 不隨語言切換
- JSON 載入失敗時仍有 fallback

## Cloudflare Pages Settings

建議設定：

```text
Framework preset: None
Build command: leave empty
Build output directory: /
Production branch: main
```

YouTube Function environment variable:

```text
YOUTUBE_API_KEY=<set in Cloudflare Pages, never commit this value>
```

自訂網域：

```text
joshhuang.ccwu.cc
```

## YouTube Browser Architecture

`youtube.html` is a public browser-style media page. It provides manual search, embedded playback, a result list, and a side ticker of video titles.

Core flow:

```text
youtube.html
|-- js/youtube.js
|   |-- reads query from search form
|   |-- checks localStorage cache for 1 hour
|   |-- calls /api/youtube/search only after user submission
|   `-- controls YouTube IFrame Player API
`-- functions/api/youtube/search.js
    |-- validates q, lang, and region
    |-- reads env.YOUTUBE_API_KEY
    |-- calls YouTube Data API search.list
    `-- returns sanitized JSON without secrets
```

Quota posture:

- No auto polling.
- No automatic recommendation chain.
- `search.list` is called only when the user submits a query.
- Repeated queries are cached in the browser and at the Function response layer for 1 hour.

## Wallpaper Interface Architecture

`wallpapers.html` is treated as a dedicated desktop-surface application, not a normal content page.

Core structure:

```text
wallpaper-viewport
|-- wallpaper-track
|   |-- wallpaper-screen-terminal  # clean terminal-style screen
|   `-- wallpaper-screen-links     # same background + search + 18 shortcut tiles
|-- wallpaper-panel-switch         # explicit left/right selector
`-- wallpaper-bg-dock              # bottom drawer for background presets
```

Interaction model:

- Desktop: mouse wheel switches between the two screens.
- Mobile / iPad: horizontal swipe switches between the two screens.
- The track only snaps to screen `0` or screen `1`; there is no resting state in the middle.
- The bottom background drawer expands on hover, focus, or click/touch.
- Selecting a background writes CSS variables on `#wallpaper-viewport`, so both screens update together.

Data model:

```text
data/wallpapers.json
|-- backgrounds[]  # future image/video/css background presets
`-- links[]        # public shortcut set rendered as the 6 x 3 grid
```

Public boundary:

- Shortcut tiles must remain public-safe.
- Do not add private dashboards, tunnel URLs, admin panels, tokens, or local network addresses.
- Future image/video assets should be referenced by public static paths only, for example `/assets/wallpapers/name.webp`.

## Maintenance Rule

目前依使用者要求：本地完成並確認後，等待明確指令才 push 到 GitHub。

維護順序：

1. 改資料優先改 `data/*.json`。
2. 改文字優先改 `data/i18n.json`。
3. 改版面才動 `index.html` / page html。
4. 改視覺集中在 `styles.css`。
5. 改資料來源集中在 `js/data-loader.js`。
6. 每次重要調整更新 `docs/DEVELOPMENT_LOG.md`。
