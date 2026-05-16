# Formula Lab Maintenance

The formula lab is data-driven. Public pages read `data/formulas.json`; the local Admin tool edits the same structure and validates it before saving.

## Content Model

Each formula item must include:

- `id`, `number`, `category`, `status`, `route`
- `title`, `description`, `summary` with `en`, `zh-TW`, and `zh-CN`
- `formula` as a compact TeX expression for cards
- `sections[]`, each with `id`, `eyebrow`, localized `title`, and `elements[]`

Supported element types:

- `text`: localized paragraph text.
- `math`: localized or shared TeX block.
- `step`: localized title/body plus an optional `equation`.
- `definition`: localized term/body plus an optional `equation`.
- `note`: localized engineering note, limit, or warning.
- `table`: localized caption, localized headers, and row cells.
- `variable-table`: symbol, physical quantity, unit, and engineering meaning rows for the opening legend.
- `derivation-step`: localized title/body, TeX equation, and a short logic note for no-skip derivations.
- `boundary-case`: limiting condition, formula behavior, and engineering interpretation.
- `design-rules`: ordered practical recommendations for implementation and measurement.
- `code`: copyable MATLAB/Python-style algorithm snippet.
- `matrix`: localized caption and a two-dimensional value grid.
- `comparison`: localized caption and `{ label, value }` cards.
- `image`: public image URL with localized alt/caption.
- `plot`: reusable browser-side visualization with a preset `handler`.

## Translation Rules

- Keep all three languages semantically equivalent; do not add a technical claim in only one language.
- Use Traditional Chinese engineering terms for `zh-TW`: 訊號, 取樣, 迴路, 品質因子, 影像.
- Use Simplified Chinese engineering terms for `zh-CN`: 信号, 采样, 回路, 品质因子, 图像.
- Keep mathematical symbols, TeX identifiers, and units identical across languages.

## Interactive Module Rules

Add a plot only when it makes the derivation easier to inspect, compare, or tune. Good uses include pole movement, Bode response, sampling aliasing, kernel shape, histogram remapping, PID response, Kalman estimation, and phase portraits.

Use `expressionPlot` for generic functions. Use a dedicated handler only when the topic needs domain-specific traces or metrics. Keep handlers deterministic and browser-only; public formula pages must not require backend computation.

## Admin Workflow

1. Open `WebPageAdmin` and enter the Formulas section.
2. Pick a formula or create a new one.
3. Fill all localized fields before saving.
4. Add sections and elements using the preset buttons.
5. For plots, choose a handler preset and define parameters/metrics.
6. Save Formulas. The Admin tool validates duplicate ids, missing languages, unknown categories, unknown element types, and unknown plot handlers.
7. Preview `/formulas.html` and at least one `/formula.html?id=<id>` route before publishing.

To rebuild the first-pass 20-topic dataset from the DOCX-derived plan, run:

```powershell
node scripts\build-formulas-data.js
```
