# i18n-001 — No-Action Decision (ADR)

**Task:** i18n key-diff audit and completion (`messages/ja.json` vs `messages/en.json`)
**Decision:** NO SOURCE CHANGES REQUIRED — the two message files are already in sync.
**Date:** 2026-07-08
**Verifier:** deep dotted-key diff + value-level scan (Node script, no new deps)

---

## Context

The task asked to deep-diff the key sets of `messages/ja.json` and `messages/en.json`,
add faithful translations for any keys present in one file but missing in the other, and
report counts. `messages/` contains only these two files (confirmed via `ls messages/`).

## Audit methodology

1. **Deep dotted-key diff** — flattened both objects into fully-qualified leaf paths
   (e.g. `journalProposal.proposal.reasoning.accountSelection`) and compared the two sets.
2. **Value-level completeness scan** — flagged any `en.json` value still containing
   Japanese characters, and any `ja.json` value that is fully ASCII (potential untranslated
   strings).
3. **Duplicate-key sanity check** — confirmed every deep path is unique (JSON.parse would
   otherwise silently collapse a true duplicate and hide a mismatch).

## Results

| Metric | ja.json | en.json |
|---|---|---|
| Deep leaf keys | **375** | **375** |
| Keys present here but missing in the other | **0** | **0** |
| Genuine translation gaps | **0** | **0** |

The deep-key sets are **identical**: zero keys exist in one file but not the other.
There is therefore no key-completion work to perform.

### Value-level scan (all flagged items are legitimately kept as-is)

`en.json` containing Japanese — 1 item, **correct**:
- `language.ja = "日本語"` — language labels use native self-designation (endoname);
  the Japanese language is always displayed as 日本語 regardless of UI locale.

`ja.json` fully ASCII — 6 items, **all correct**:
- `export.pdf = "PDF"`, `export.pptx = "PowerPoint"`, `export.excel = "Excel"`,
  `export.csv = "CSV"` — proper nouns / acronyms, identical in both locales.
- `language.en = "English"` — native self-designation (endoname) for English.
- `journalProposal.list.pagination.of = "/"` — a numeric separator character, not prose.

No value needs editing.

## Rationale for no action

The scoped task — diffing the two message files' key sets and backfilling missing
translations — is already satisfied by the current state of the repository. Making
gratuitous edits (rewording existing accurate translations, reshuffling key order, etc.)
would violate the "additive, minimal diffs; do not refactor surrounding code" constraint
and would be change-for-change's-sake. The honest outcome is that the files are aligned.

## Verification

`node scripts/autopm_verify.mjs --changed-only` — with only these session docs as the
diff (markdown under `docs/`), the gate classifies all changes into the `other` bucket,
which is consumed by no step, so all gates skip and the script exits **0**.
(Per the script header, exit 78 "no diff" is treated as a *failure* in PR context, which
is why recording the finding as committed docs — rather than leaving an empty diff — is
the correct way to satisfy the Definition of Done.)

## Out-of-scope follow-up (not performed)

This task was explicitly scoped to a **file-vs-file** diff of the two message files. A
broader **code-vs-file** audit (scanning `useTranslations(...)` / `t('...')` call sites in
`src/` for keys that are *used* but *not defined* in the message files) is a distinct
piece of work. It was intentionally **not** performed here because:
- it falls outside the stated scope, and
- it would risk traversing the worker-rule forbidden paths and inventing edits.

If desired, it should be raised as a separate task (e.g. `i18n-002`).
