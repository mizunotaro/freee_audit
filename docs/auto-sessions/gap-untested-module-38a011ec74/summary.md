# gap-untested-module-38a011ec74 — Unit tests for `OcrPreview.tsx`

**Risk class:** C · **Target:** `src/app/[locale]/(authenticated)/journal-proposal/components/OcrPreview.tsx`
**Test file:** `tests/app/[locale]/(authenticated)/journal-proposal/components/OcrPreview.test.tsx`
**Result:** 26 tests, 26 passing · ESLint 0 warnings · `tsc --noEmit` 0 errors (repo-wide)

## What the module is

`OcrPreview` is a pure presentational React component. It takes a single prop
`ocrResult: OCRAnalysisResult` (plus optional `className`) and renders a Card with:

- a title and a `ConfidenceIndicator` (child component) driven by `ocrResult.confidence`
- a 2-column grid of extracted-info tiles (date / vendor / totalAmount / taxAmount /
  taxRate / paymentMethod), each rendered **only when its field is present**
- a line-items list, rendered only when `extractedInfo.items` is a non-empty array
- the `rawText`, colorized by an internal `highlightKeywords`/`highlightPattern` pair
- a warnings list (Badges), rendered only when `warnings.length > 0`

It has one public export — the `OcrPreview` component. The two formatting/highlight
helpers are internal closures, exercised through the rendered output.

## Test design decisions

- **Mock `next-intl`** with the real `journalProposal.ocr` labels from `messages/ja.json`,
  so assertions verify the component requests the *correct* translation keys (not just
  that *some* string rendered). This is the same mocking style as the sibling
  `tests/unit/app/[locale]/(authenticated)/journal-proposal/page.test.tsx`.
- **Render real child components** (`Card`, `Badge`, `ConfidenceIndicator`) rather than
  mocking them — they are pure/presentational with no external collaborators, matching
  the convention in `tests/components/journal-proposal/confidence-indicator.test.tsx`
  and `tests/components/import/ImportPreview.test.tsx`. This also lets the test assert
  that `OcrPreview` correctly forwards `confidence` into the progressbar's `aria-valuenow`.
- **Determinism:** no network, clock, or unseeded randomness. `toLocaleString()` output is
  locale-dependent, so amount assertions use a locale-tolerant regex (`/^¥1[.,]?234$/`)
  — except `totalAmount: 0`, which is `¥0` in every locale and is asserted exactly.
- A `valueNextTo(label)` helper reads the value `<span>` adjacent to each label, which also
  pins the DOM structure (label + sibling value) the component emits.

## Assertions added (26 tests / 5 groups)

### Structure — happy path (7)
1. Renders the `OCR結果` title.
2. Renders a `progressbar` with `aria-valuenow="85"` for `confidence: 0.85` (confidence forwarded to `ConfidenceIndicator`).
3. Renders the `信頼度` confidence label in the header.
4. Renders the `抽出情報` section and every populated info tile (`日付`, `取引先`, `支払方法` with their values).
5. Renders the `明細` items header and every line item (`商品A`, `商品B`).
6. Renders the `抽出テキスト` raw-text header.
7. Renders the `警告` header and every warning string.

### Conditional rendering — edge cases (6)
8. Omits the amount tile when `totalAmount` is absent (date tile still shown).
9. Omits the items section when `items: []`.
10. Omits the items section when `items` is `undefined`.
11. Omits the warnings section when `warnings: []`.
12. Renders only the tiles for fields present in a sparse `extractedInfo` (absent fields are `null`).
13. **Fail-safe:** a minimal valid result (`rawText: ''`, empty `extractedInfo`, `confidence: 0`, `warnings: []`) renders the title, reports `aria-valuenow="0"`, and renders no info tiles / items / warnings.

### Value formatting (8)
14. `totalAmount: 1234` → yen-prefixed, locale-grouped (`/^¥1[.,]?234$/`).
15. `totalAmount: 0` → `¥0` exactly.
16. `taxAmount: 112` → `/^¥1[.,]?12$/`.
17. `taxRate: 0.1` → `10%`.
18. `taxRate: 0.08` → `8%` (guards the `(rate*100).toFixed(0)` float-rounding path — `0.08*100 = 8.000…002`).
19. Tax-rate boundaries: `0` → `0%`, `1` → `100%`.
20. Line-item `amount: 1000` → `/^¥1[.,]?000$/`.
21. Line-item with `amount` undefined → no amount element next to the item name.

### Raw-text keyword highlighting (4)
22. `¥1,234` in raw text is wrapped in a green (`text-green-600`) span.
23. Two yen amounts (`¥1,000 と ¥2,000`) produce exactly two green spans, one per amount.
24. Raw text with no amount-like token produces zero green spans (no spurious highlight).
25. The full raw text content is preserved verbatim for the user (multi-line + the matched token).

### className prop (1)
26. The `className` prop is forwarded to the Card root (custom marker present and the root retains `rounded-lg`).

## Coverage rationale

The component's surface is rendering logic with several independently-conditional regions
(info tiles, items, warnings) and several formatting rules (`¥` + `toLocaleString` for
amounts, `*100` + `toFixed(0)` for tax rate). The suite covers each conditional branch
(present/absent), the formatting boundaries (`0`, `0.08`, `1`), and a fail-safe minimal
input. Internal helpers (`highlightKeywords`/`highlightPattern`) are covered through their
observable effect on the DOM rather than direct calls, since they are not exported.

## Observation (not a code change — for awareness)

While characterizing `highlightKeywords`, I found that **only the first highlight pattern
(yen `¥[\d,]+`) ever takes effect.** `highlightPattern` returns an array once its input is a
string (via `parts.reduce`), so after the first `forEach` iteration the accumulator is an
array; every subsequent pattern hits the `typeof input === 'string'` guard, returns the
input unchanged, and never splits/matches. Consequently the date (`\d{4}[-/]\d{2}[-/]\d{2}`),
Japanese-yen (`\d{1,3}(,\d{3})*円`), and tax (`10%|8%|消費税`) color rules are effectively
unreachable.

This was **not fixed** — the task is to add tests for the existing module, and no source
edit was requested. The suite deliberately asserts only the *stable* highlighting behavior
(yen spans; no spans for token-free text) and does **not** lock in the unreachable-pattern
state, so a future fix that makes all four patterns apply would not break these tests. The
assertions are therefore characterization-style for the working path only.
