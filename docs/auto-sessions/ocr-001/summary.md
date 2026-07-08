# OCR-001 — pytest skeletons for ocr-server (FastAPI)

## Outcome
`ocr-server/main.py` previously had zero tests. Added
`ocr-server/tests/conftest.py` (path bootstrap) and
`ocr-server/tests/test_main.py` — **17 tests, all passing** against the real
module (no real OCR models invoked).

## Scope of new files
| File | Purpose |
|------|---------|
| `ocr-server/tests/conftest.py` | Inserts `ocr-server/` onto `sys.path` so `import main` resolves. Minimal, no behavior change. |
| `ocr-server/tests/test_main.py` | The pytest suite. |

No production code changed (`main.py`, `requirements.txt`, `Dockerfile` untouched).
Changes stay strictly inside `ocr-server/tests/`. No path under any forbidden
tree was touched.

## What the tests cover
- **Import / app-construction smoke (3)** — `app` is a `FastAPI` instance;
  `app.title == "YomiToku OCR Server"`; `app.openapi()` builds and exposes the
  `/health` and `/ocr` paths (proves the route objects are well-formed).
- **Route registration (2)** — `/health` and `/ocr` are present in
  `app.routes`.
- **`/health` over TestClient (1)** — GET returns 200, `status == "healthy"`,
  and `yomitoku_available` is consistent with the actual module-level `ocr`
  (`main.ocr is not None`), so the assertion holds whether or not YomiToku is
  installed.
- **`/ocr` 503 boundary (1)** — `monkeypatch.setattr(main, "ocr", None)` forces
  the unavailable branch, then a multipart POST asserts 503 +
  `"YomiToku not available"`. This exercises the real route end-to-end through
  FastAPI (UploadFile dependency injection included) without loading any model.
- **`extract_structured_data` pure-function tests (10)** — keys/shape,
  `rawText` round-trip, Japanese date (`2024年03月15日`) and slash date
  (`2024/03/15`) extraction, `date is None` when absent, single amount, max
  amount across multiple amounts, `totalAmount is None` when no digits, ¥-symbol
  stripping, and the constant `confidence == 0.85`.

## Decisions (ADR-style)
- **No real models.** YomiToku is never imported in the test process; the only
  boundary touched is the module-level `ocr` handle. The success path of `/ocr`
  (`PdfData` / `ImageData` / `ocr(data)`) is intentionally **not** exercised —
  it requires loading YomiToku and writing/parsing a real temp file, which the
  brief forbids ("Do NOT invoke real OCR models"). The 503 branch is covered
  deterministically instead, and the pure parsing logic is covered in isolation.
- **Deterministic, not installation-dependent.** The `/health` test asserts
  `yomitoku_available == (main.ocr is not None)` rather than a hard-coded
  boolean, and the `/ocr` 503 test force-sets `main.ocr = None`. Both pass
  whether or not YomiToku is installed; no `pytest.skip` / conditional guards.
- **Lazy `TestClient` import.** `from fastapi.testclient import TestClient`
  (needs `httpx`) is imported inside the two endpoint tests, not at module top.
  If `httpx` is ever absent, the 10 pure-function tests still collect and pass
  instead of the whole file erroring. No inline comment per the repo's no-comment
  rule; rationale recorded here.
- **Result/Zod rule not applicable.** The worker rule ("any new helper returns
  `Result<T,E>`; inputs validated with Zod `safeParse`") targets TypeScript
  business-logic helpers. These are Python test skeletons — no production helper
  is added, nothing throws in the test layer, and `main.py` is unchanged.
- **No new dependencies.** `pytest` / `httpx` are standard test tooling already
  installed; `fastapi` is the app's existing runtime dependency. `requirements.txt`
  is untouched.

## Verification
- `python -m pytest tests/` (from `ocr-server/`) → **17 passed** (Python 3.14.4,
  pytest 9.0.3; YomiToku absent, matching the `ocr is None` runtime).
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0**. `ocr-server/**`
  files fall into the verify gate's `other` bucket (no gate step acts on them;
  pytest is scoped to `python-service/` only), so the gate is green as long as
  the diff stays in scope — which it does.

## Notes / limitations (honest)
- `main.py` instantiates `Yomitoku(...)` at **import time** when the package is
  installed. In an environment where YomiToku *is* present, importing `main`
  loads models before any test runs. This is the app's existing behavior and is
  outside the "don't refactor surrounding code" constraint; the tests themselves
  add no model loading. In the tested environment YomiToku is absent, so import
  is cheap and `ocr` is `None`.
- The success path of `/ocr` (200) is out of scope for the reason above; it is
  noted here rather than forced.
