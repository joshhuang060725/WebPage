# Development Log

## 2026-05-01 - Formula Derivation Area

### Context

User provided two WebMatlab-style reference files: one for a formula index and one for an interactive second-order damping response derivation. The requested structure is hierarchical: enter the formula area from navigation, choose a formula, then open a derivation and display module.

### Decisions

1. Add a dedicated `formulas.html` index page named `公式推導區`.
2. Add a shared `formula.html?id={formulaId}` renderer for formula detail pages.
3. Keep formula content in `data/formulas.json` for easier backend/admin maintenance.
4. Use frontend JavaScript calculations for v1.
5. Use KaTeX and Plotly from CDN for formula rendering and graphs.
6. Add local-only Admin support with form fields for metadata and JSON fields for flexible derivation/interactivity data.

### Implemented

- Added `data/formulas.json`.
- Added `formulas.html` and `formula.html`.
- Added `js/formulas.js` for category filtering, search, and formula card rendering.
- Added `js/formula-detail.js` for shared formula detail rendering, KaTeX rendering, Plotly plotting, and second-order response calculation.
- Added the formula area to public navigation and sitemap.
- Added Formulas management to `WebPageAdmin`.
- Updated Admin publish/check coverage so static page, CSS, JS, Function, data, docs, and sitemap changes are all included.

### UI/UX Notes

- Formula index follows the existing JATS modular card style.
- Formula detail behaves like a WebMatlab panel: symbolic derivation on the left, interactive computation on the right.
- Draft formulas are visible but disabled as coming-soon cards.
- Public website remains read-only.

### Verification

- JSON parse passed for `data/formulas.json`, `data/i18n.json`, and `data/files.json`.
- JavaScript syntax passed for `js/data-loader.js`, `js/main.js`, `js/formulas.js`, `js/formula-detail.js`, and `js/youtube.js`.
- Admin syntax passed for `public/app.js`, `src/config.js`, `src/git.js`, and `src/server.js`.
- `git diff --check` passed.
- Local HTTP route check passed for `/formulas.html`, `/formula.html?id=second-order-damping`, `/data/formulas.json`, `js/formulas.js`, and `js/formula-detail.js`.
- Headless Edge check passed:
  - formula index rendered 4 cards and 5 filters.
  - formula detail rendered 2 derivation sections, 2 sliders, and a Plotly container.
  - desktop and mobile checks had no horizontal overflow.

### Git State

Local working tree only. Not committed and not pushed.

此文件記錄重要設計決策、實作內容、驗證結果與 Git 狀態。每次較大的架構或 UI 調整都應更新。

## 2026-04-30 - Day Mode Palette Reset and Performance Pass

### Context

The previous day mode moved too far into saturated blue glass and felt visually uncomfortable. A later experiment also used SVG displacement filtering from a Liquid Glass demo, but the interaction cost was too high on desktop.

### Decisions

1. Keep night mode unchanged.
2. Reset day mode to a light ice-blue glass system instead of a dark blue glass system.
3. Use Active Blue only for selected navigation, active controls, and emphasis.
4. Use deep blue-gray text for readability; reserve gradient text for headings and the homepage JATS lockup.
5. Avoid SVG displacement filters and heavy `backdrop-filter: url(...)` on repeated components.
6. Keep day and night tokens separated through explicit `body[data-theme="dark"]` and `body[data-theme="light"]` sections as the first step toward separate theme files.

### Implemented

- Added explicit dark-theme token block to preserve the existing JATS industrial night style.
- Rebuilt day-theme tokens around light ice-blue background, translucent white-blue glass cards, softer shadows, and blue-gray text.
- Reduced day-mode glass cost by removing the SVG displacement filter path and using lighter blur/saturate filters.
- Updated day-mode heading and JATS lockup gradient colors after manual tuning.
- Updated README and development guidelines to match the current day-mode design and performance constraints.

### UI/UX Notes

- Day mode should feel like a readable light interface first, glass effect second.
- Large surfaces should stay low saturation and high readability.
- Glass is expressed through transparency, specular edges, inset highlights, and soft shadows rather than expensive pixel-level refraction.

### Verification

- `node --check js/main.js` passed.
- `git diff --check` passed.
- Visual review is user-led for this pass.

### Git State

Local working tree only. Not committed and not pushed.

## 2026-04-30 - Day Mode Liquid Glass Revision

### Context

User provided `Liquid Glass 網頁設計指南.docx` and asked to rethink the day display mode using Apple Glass / Liquid Glass references. The hard constraint for this pass is to avoid changing any night mode content.

### References

- Apple Developer Documentation: Liquid Glass.
- Apple Human Interface Guidelines: Materials.
- Local DOCX notes: 5-layer optical model, blur plus saturation, Fresnel-like edge highlights, multi-shadow depth, subtle grain, and legibility safeguards.

### Decisions

1. Keep night mode as the primary JATS dark industrial terminal visual language.
2. Limit implementation changes to `body[data-theme="light"]` selectors and documentation.
3. Treat day mode as a functional glass layer over a light technical background, not as a separate brand.
4. Use Liquid Glass primarily for navigation, controls, and modular cards, while keeping content hierarchy explicit.
5. Improve day mode depth with stronger blur, saturation compensation, specular borders, inset highlights, soft environment shadows, and subtle grain.
6. Update day mode to the user-provided blue Apple Glass palette: Active Blue `#4971F2`, Glass Base `rgba(220, 234, 236, 0.45)`, Text Primary `#F5F7FB`, Text Secondary `rgba(255, 255, 255, 0.4)`, Inactive Gray `#3A3A3C`, and Specular `rgba(255, 255, 255, 0.4)`.

### Implemented

- Revised light theme background into a brighter cold/warm mesh with fine grid structure.
- Revised light theme again into the requested blue Apple Glass direction.
- Added light-only grain and glow overlay through `body[data-theme="light"]::before`.
- Upgraded light-only navigation and mobile header glass material.
- Expanded light-only glass treatment to page hero, dashboard modules, overview cards, hero/status panels, project cards, shortcut cards, tool cards, file cards, and contact panels.
- Added light-only control/tag material treatment and restrained hover response.
- Replaced day-mode yellow emphasis with Active Blue while leaving night-mode yellow unchanged.
- Updated README UI design notes.
- Updated development guidelines with explicit Night Mode and Day Mode rules.

### UI/UX Notes

- Night mode is unchanged in this pass.
- Day mode emphasizes blue translucency, depth, and clear functional layering, but content remains modular and readable.
- Glass opacity is intentionally thicker than decorative glass because the site contains text-heavy cards and navigation.

### Verification

- `node --check js/main.js` passed.
- `git diff --check` passed.
- Local headless Edge light-mode check was not run after the blue Apple Glass palette update because browser launch permission was not granted in this pass.

### Git State

Local working tree only. Not committed and not pushed.

## 2026-04-29 - Static Personal Portal Foundation

### Context

使用者希望先建立基本公開網站，其餘內容後續再迭代。網站需要能部署到 GitHub + Cloudflare Pages，並可被搜尋引擎索引。

### Decisions

1. 採用純靜態架構，避免第一版引入 build 流程。
2. 使用 `index.html`、`styles.css`、`js/main.js`、`js/data-loader.js`。
3. 內容資料放入 `data/*.json`，為未來 API 替換預留。
4. SEO 保留 canonical、robots、Open Graph、Twitter Card、JSON-LD。
5. 私人功能不在公開網站暴露，只顯示 locked / planned / coming soon 狀態。

### Implemented

- 建立首頁。
- 建立資料檔：
  - `data/profile.json`
  - `data/projects.json`
  - `data/shortcuts.json`
  - `data/tools.json`
  - `data/i18n.json`
- 建立 `robots.txt`、`sitemap.xml`、`favicon.svg`、`og-image.svg`。
- 建立資料載入與多語系渲染。

### UI/UX Notes

- 第一版以深色簡約工業風為方向。
- 以公開個人形象、專案、工具入口為主。
- 避免把私人管理能力放進公開頁。

### Verification

- JSON parse passed.
- JavaScript syntax passed.
- Local HTTP route check passed.
- Desktop/mobile layout checked.
- Language switching checked.

### Git State

Local commit only. Not pushed by user request.

## 2026-04-29 - Multi Page Portal Structure

### Context

使用者希望不同區塊功能用跳轉不同頁面的方式實作。首頁只作為個人宣傳與入口，不承載完整內容。

### Decisions

1. 首頁改為個人宣傳 portal。
2. 新增獨立頁面：
   - `profile.html`
   - `projects.html`
   - `links.html`
   - `tools.html`
3. 左側導航改為頁面跳轉。
4. `JATS / Josh Auxiliary Terminal System` 作為固定品牌 lockup，不進 i18n。
5. Sitemap 新增所有公開頁。

### Implemented

- 新增四個內容頁。
- 更新 navigation。
- 更新 README 與 development guidelines。
- 更新 `sitemap.xml`。

### UI/UX Notes

- 首頁保持簡潔，讓使用者快速理解網站身份。
- 子頁面負責承載細節內容，方便後續擴充。

### Verification

- `/`
- `/profile.html`
- `/projects.html`
- `/links.html`
- `/tools.html`

以上路由本地 200。

### Git State

Local commit only. Not pushed by user request.

## 2026-04-29 - JATS Terminal Dashboard Homepage

### Context

使用者提供手繪草圖，希望首頁更像一個黑色終端面板：

- 左側仍保留主要導航。
- 首頁主畫面左側列出 Time、place、weather、GitHub、Ping、Tool。
- 右側大字 `JATS`。
- `JATS` 下方固定顯示 `Josh Auxiliary Terminal System`。
- 再放 Josh、格言、搜尋框與概要文字。
- 概要文字要比原先小幾個點。

### Decisions

1. 首頁使用單一大型 `.terminal-home` 面板。
2. 面板左側是 `.dashboard-rail`，每個資訊模組是獨立 `.dash-module` 方框。
3. 面板右側是 `.jats-console`，負責品牌、motto、search 和 CTA。
4. Search 第一版只作為 portal entry UI，action 指向公開安全的 `links.html`。
5. Place 使用 public IP 做城市級估算。
6. Weather 使用估算座標查詢當前天氣。
7. `JATS` lockup 不使用 `data-i18n`，確保切語言時不變。
8. 介紹文字使用 `.console-summary`，字級低於 motto 和品牌標題。

### Implemented

- 重構 `index.html` 首頁結構。
- 新增 terminal dashboard CSS。
- 將首頁模組改成彼此隔離的方框。
- 新增 IP geolocation 與 current weather 前端載入。
- 新增 search placeholder i18n 支援。
- 補齊 `data/i18n.json` 的首頁 dashboard key。
- 補回 Twitter metadata。
- 重寫 README、開發準則與開發日誌，確保文件可維護。

### UI/UX Notes

- 首頁從傳統 hero 轉為控制台式門戶。
- 左側資訊模組對應草圖中的快速狀態列。
- 每一個狀態區塊都隔離成卡片，降低資訊互相干擾。
- 右側保留強品牌視覺，讓第一眼看到 JATS。
- Search 與 Tool 都是未來功能入口，不暴露私密服務。
- IP 位置為城市級估算，只作為使用者所在地天氣查詢依據。

### Verification

- JSON parse passed.
- JavaScript syntax passed.
- Local HTTP route check passed for:
  - `/`
  - `/profile.html`
  - `/projects.html`
  - `/links.html`
  - `/tools.html`
  - `/data/i18n.json`
  - `/data/tools.json`
  - `/sitemap.xml`
  - `/robots.txt`
- Headless Edge desktop/tablet/mobile check passed.
- No layout overflow detected after module card adjustment.
- IP location module resolved to city-level location during local test.
- Weather module resolved current weather from estimated location during local test.
- Language switching verified; `JATS` remained unchanged.

### Git State

Local only. Not pushed by request.

## 2026-04-29 - Dual Panel Wallpaper Interface

### Context

User clarified that the wallpaper page should not be a normal preview/list page. It should behave like a dynamic desktop surface with two main screens: a clean terminal wallpaper and a browser/search shortcut wallpaper.

### Decisions

1. Replace the previous preview-card layout with a full-screen two-panel track.
2. Keep panel switching binary: the interface can only rest on the left screen or the right screen.
3. Use desktop wheel input for panel switching and touch swipe input for mobile/iPad.
4. Put background presets in a bottom drawer that expands on hover, focus, or click/touch.
5. Store both backgrounds and public shortcut links in `data/wallpapers.json`.
6. Keep shortcuts public-safe and avoid private/admin/tunnel/local service URLs.

### Implemented

- Rebuilt `wallpapers.html` around:
  - `.wallpaper-viewport`
  - `.wallpaper-track`
  - `.wallpaper-screen-terminal`
  - `.wallpaper-screen-links`
  - `.wallpaper-bg-dock`
- Added 4 placeholder background presets.
- Added 18 public shortcut tiles for the 6 x 3 grid.
- Added wheel, swipe, explicit panel button, and background switching logic in `js/main.js`.
- Added full-screen wallpaper CSS, responsive mobile sizing, bottom drawer behavior, and synchronized CSS variable background updates.
- Updated README and development guidelines with the wallpaper architecture and maintenance rules.

### Verification

- `node --check js\main.js` passed.
- `node --check js\data-loader.js` passed.
- `python -m json.tool data\wallpapers.json` passed.
- `python -m json.tool data\i18n.json` passed.
- Local HTTP route check passed for `/wallpapers.html`, versioned CSS/JS, and `/data/wallpapers.json`.
- Headless Edge render check passed:
  - 18 shortcut tiles rendered.
  - 4 background options rendered.
  - wheel input switched from panel 0 to panel 1.
  - background selection changed the active synchronized tone.
  - mobile viewport kept the search box and 18 tiles visible.

### Git State

Local working tree only. Not committed and not pushed by user request.

## 2026-04-29 - YouTube Browser Page

### Context

User requested a YouTube browser feature between Quick Links and Tools. The referenced DOCX suggested YouTube Data API plus IFrame Player API and a side scrolling title list. Current official API behavior was treated conservatively, so this version does not depend on deprecated recommendation parameters.

### Decisions

1. Add a dedicated `youtube.html` page instead of embedding the feature into the homepage.
2. Keep the page in the same JATS dark industrial visual system.
3. Use manual search only; no auto polling and no auto recommendation chain.
4. Keep `YOUTUBE_API_KEY` out of the frontend and GitHub by using a Cloudflare Pages Function.
5. Cache repeated searches for 1 hour in `localStorage` and through the Function response cache header.

### Implemented

- Added `youtube.html`.
- Added YouTube navigation between Quick Links and Tools.
- Added `js/youtube.js` for search submission, result rendering, side ticker, local cache, and IFrame Player control.
- Added `functions/api/youtube/search.js` for `/api/youtube/search`.
- Added YouTube i18n strings for English, Traditional Chinese, and Simplified Chinese.
- Added YouTube route to `sitemap.xml`.
- Updated README and development guidelines with architecture, security boundary, and QA rules.

### UI/UX Notes

- The player is the primary surface.
- Search only runs on explicit user action.
- Results are duplicated in the ticker for continuous scrolling; hover or focus pauses the ticker.
- Mobile keeps the player above the search/results stack to avoid cramped side-by-side layout.

### Verification

- JSON parse passed.
- JavaScript syntax passed for `js/data-loader.js`, `js/main.js`, `js/youtube.js`, and `functions/api/youtube/search.js`.
- Function behavior check passed:
  - missing `q` returns `missing_query`.
  - missing `YOUTUBE_API_KEY` returns `missing_api_key`.
  - normal mocked YouTube response returns sanitized JSON.
  - response body does not expose the API key.
- Local HTTP route check passed for `/youtube.html`.
- Headless Edge UI check passed with mocked API data:
  - search rendered 2 result cards.
  - ticker rendered duplicated title items for scrolling.
  - player title updated to the selected video.
  - desktop and mobile had no horizontal overflow.

### Git State

Local working tree only. Not committed and not pushed by user request.

## 2026-04-29 - Navigation Collapse and Wallpaper Grid Direction

### Context

User reported that after changing language or display mode in the left navigation, moving the mouse away did not collapse the rail. User also clarified that the wallpaper shortcut grid should be 6 x 3 instead of 3 x 6.

### Decisions

1. Treat the navigation issue as a focus retention bug: button focus inside the rail kept `:focus-within` active after mouse leave.
2. Clear button focus on mouse leave so pointer usage collapses naturally.
3. Keep keyboard focus behavior available through normal focus handling.
4. Change the wallpaper shortcut grid direction to 6 columns and 3 rows.

### Implemented

- Updated `setupNavigationRail()` to remove expanded state and blur focused buttons when the pointer leaves the side rail.
- Added focus-out cleanup for the navigation rail.
- Changed `.wallpaper-link-grid` to `repeat(6)` columns and `repeat(3)` rows.
- Updated README and development guidelines to document the 6 x 3 grid.

### Verification

- JavaScript syntax check passed.
- Wallpaper JSON parse passed.
- i18n JSON parse passed.
- Local route check passed for `/`, `/wallpapers.html`, versioned CSS/JS, and `/data/wallpapers.json`.
- Headless Edge verification passed:
  - desktop wallpaper grid rendered 18 tiles as 6 columns x 3 rows.
  - mobile wallpaper grid rendered 18 tiles as 6 columns x 3 rows.
  - wheel input switched the wallpaper panel from `0` to `1`.
  - side navigation expanded to 280px on hover, then collapsed to 74px after clicking DAY and moving the pointer away.
  - focus returned to `body` after pointer leave, preventing `:focus-within` from keeping the rail expanded.

### Git State

Local working tree only. Not committed and not pushed by user request.

## Log Template

## 2026-04-30 - Local Admin File Manager

### Context

User requested a personal file upload and delete feature with backend upload interface support, common file-type handling, descriptions, upload dates, latest-upload sorting, and a capacity summary.

### Decisions

1. Keep upload/delete inside the local-only `WebPageAdmin` backend instead of exposing public website upload endpoints.
2. Store uploaded public files under `assets/files/`.
3. Store metadata under `data/files.json`.
4. Sort by `uploadedAt` descending.
5. Add file count and total byte size summary to the admin left rail.
6. Ignore `YoutubeKey.txt` to reduce accidental secret commits.

### Implemented

- Added `data/files.json`.
- Added `assets/files/.gitkeep`.
- Added `.gitignore` rule for `YoutubeKey.txt`.
- Extended `WebPageAdmin` backend with:
  - `GET /api/files`
  - `POST /api/files/upload`
  - `PUT /api/files/:id`
  - `DELETE /api/files/:id`
- Added File Manager UI below Tools in `WebPageAdmin`.
- Added upload metadata fields: name, description, extension, size, public path, upload date.
- Updated admin publish/check logic to include `data/files.json` and `assets/files/`.

### Verification

- Admin JavaScript syntax check passed.
- Website `data/files.json`, `data/i18n.json`, and `data/wallpapers.json` parse checks passed.
- Local admin API smoke test passed:
  - `GET /api/files` returned empty summary.
  - `POST /api/files/upload` accepted a `.txt` file and created metadata.
  - capacity summary changed from `0 B` to `21 B`.
  - `DELETE /api/files/:id` removed the test file and restored summary to `0 B`.
  - `data/files.json` returned to an empty array after cleanup.

### Git State

Local working tree only. Not committed and not pushed by user request.

## 2026-04-30 - Public Files Download Page

### Context

User clarified that uploaded files also need a corresponding download surface on the public website.

### Decisions

1. Add a dedicated `files.html` page instead of mixing downloads into Tools.
2. Public site only reads `data/files.json`; upload/delete remains local-admin only.
3. File entries are sorted by latest `uploadedAt`.
4. Each card displays name, description, type, size, upload date, and open/download actions.

### Implemented

- Added `files.html`.
- Added Files navigation entry under Tools.
- Added `data/files.json` loading to `js/data-loader.js`.
- Added `renderFiles()` to `js/main.js`.
- Added Files i18n keys.
- Added file card styling and responsive layout.
- Added `/files.html` to `sitemap.xml`.
- Updated README and development guidelines.

### Verification

- JSON parse passed for all data files, including `data/files.json`.
- JavaScript syntax passed for `js/data-loader.js`, `js/main.js`, `js/youtube.js`, and the YouTube Function.
- `git diff --check` passed.
- Headless Edge public page check passed with mocked file data:
  - 2 file cards rendered.
  - newest `uploadedAt` sorted first.
  - summary rendered total file count and size.
  - download link pointed to the public asset path.
  - desktop and mobile had no horizontal overflow.

### Git State

Local working tree only. Not committed and not pushed by user request.

## 2026-04-29 - Asset Cache Busting

### Context

After deployment, mobile and iPad rendered correctly, but the development PC showed the new HTML with stale or missing desktop UI styles. Direct network checks confirmed Cloudflare was serving the new `styles.css`, and a clean Edge headless profile rendered correctly. The issue was isolated to the active desktop browser profile cache/resource state.

### Decisions

1. Add version query strings to CSS and JS asset URLs.
2. Add Cloudflare Pages `_headers` rules for CSS, JS, and JSON assets.
3. Keep HTML cache behavior default while making static assets revalidate.

### Implemented

- Updated all public HTML pages to use:
  - `/styles.css?v=20260429-2`
  - `/js/data-loader.js?v=20260429-2`
  - `/js/main.js?v=20260429-2`
- Added `_headers` with `Cache-Control: public, max-age=0, must-revalidate`.

### Verification

- Local route check passed for versioned CSS/JS paths.
- Live network check confirmed Cloudflare served current `styles.css`.
- Clean Edge headless profile rendered the live site correctly before this patch, confirming the active Edge profile was the likely stale-resource source.

### Git State

Pending push with the next feature commit.

## 2026-04-29 - Navigation, Theme, and Network Modules

### Context

User requested three interaction upgrades:

- Collapse the desktop side navigation to the `J` mark by default, then expand on hover or click.
- Add a day mode based on Apple transparent glass guidance, defaulting to time-based auto switching with manual controls.
- Replace the static Ping card with current-device latency and show the current network provider.

### Decisions

1. The desktop sidebar defaults to a narrow rail and expands through `:hover`, `:focus-within`, or a click-toggled class.
2. Theme mode supports `auto`, `light`, and `dark`; `auto` resolves by local time.
3. Day mode uses a translucent, blurred material layer for navigation and controls, following Apple HIG guidance that glass/material effects should support hierarchy and legibility.
4. Browser JavaScript cannot perform ICMP ping, so the site measures HTTP round-trip latency to `/robots.txt` as a practical approximation.
5. Network provider is taken from the IP geolocation response when available.

### Implemented

- Added theme controls to desktop and mobile navigation.
- Added theme state management in `js/main.js`.
- Added light-theme material styling in `styles.css`.
- Added collapsible desktop sidebar behavior.
- Added latency measurement and ISP display in the Ping module.

### Verification

- JavaScript syntax passed.
- i18n JSON parse passed.
- Local route check passed for versioned CSS/JS paths.
- Desktop Edge headless check passed:
  - collapsed sidebar width: 74px
  - expanded sidebar width: 280px
  - light/dark/auto theme controls updated `body[data-theme]`
  - Ping module reported HTTP latency
  - ISP text rendered from geolocation data
- Tablet/mobile Edge headless check passed with no horizontal overflow.

### Git State

Pending commit and push.

## 2026-04-29 - Wallpaper Page

### Context

User requested a new dynamic wallpaper page. The page should be accessible from the left navigation between Bio and Projects. Real wallpaper assets will be uploaded later, so this version only needs the switching structure.

### Decisions

1. Add `wallpapers.html` as a dedicated page instead of placing wallpaper controls on the homepage.
2. Add `data/wallpapers.json` so future images or video loops can be registered without editing page markup.
3. Keep the first version public and asset-safe: no private storage paths, no upload surface, no admin controls.
4. Provide a preview stage and selectable wallpaper cards using CSS placeholders until real assets are added.

### Implemented

- Added `wallpapers.html`.
- Added `data/wallpapers.json`.
- Added `nav.wallpapers` i18n strings.
- Added wallpaper rendering and selection logic in `js/main.js`.
- Added wallpaper preview/list styling in `styles.css`.
- Added the page to all desktop side navigation entries.
- Added the page to `sitemap.xml`.

### Verification

Pending local verification.

### Git State

Pending commit. Not pushed by request.

```markdown
## YYYY-MM-DD - Title

### Context

### Decisions

### Implemented

### UI/UX Notes

### Verification

### Git State
```
