# gap-untested-module-622270566c — unit tests for `src/components/conversion/stepper.tsx`

**Risk class:** C · **Target:** `src/components/conversion/stepper.tsx` (named export
`ConversionStepper`, exported `Step` interface) · **Test file added:**
`tests/components/conversion/stepper.test.tsx`

## What the module is

A pure presentational React component that renders a wizard/progress stepper. Public surface:

- `Step` interface — `{ id, label, labelEn?, description?, status: 'pending'|'current'|'completed'|'error' }`
- `ConversionStepper({ steps, onStepClick?, allowNavigation?, orientation? })`
  - `allowNavigation` defaults to `false`; `orientation` defaults to `'horizontal'`.
  - The only behaviour (not just rendering) is `handleStepClick`: it calls
    `onStepClick(step.id)` **iff** `allowNavigation && step.status === 'completed' && onStepClick`.

## Coverage rationale

The component is a view function, so coverage = (a) every render branch and (b) the single
click-gating decision. The suite groups these into: horizontal default, circle content,
circle styling per status, label styling per status, connector rendering/coloring, vertical
orientation, click-navigation (horizontal + vertical), and fail-safe/boundary cases.

## Every assertion added (36 tests)

### Horizontal (default orientation)
1. Renders every step label in document order — `getAllByText` returns the 4 labels in source order.
2. Renders one `.rounded-full` circle indicator per step (`length === 4`).
3. Horizontal container present (`.w-full`), vertical container absent (`.space-y-4` is null).
4. Descriptions are **not** rendered in horizontal even when supplied (all three `queryByText` null).
5. Three `.mx-2` connector bars (N−1), none after the last step.

### Circle content — Check icon vs index number
6. Completed step → an `<svg>` (lucide `Check`) is rendered and the number `<span>` is absent.
7. Non-completed steps (current/pending/error) → `<span>` text is the 1-based index (`2`,`3`,`4`) and no `<svg>`.
8. A completed step at index 0 still renders the Check icon (guards the `index + 1` fallback path).

### Circle styling by status (`it.each` over the 4 statuses)
9–12. `completed`→`border-primary bg-primary text-primary-foreground`;
`current`→`border-primary bg-background text-primary`;
`error`→`border-destructive bg-destructive text-destructive-foreground`;
`pending`→`border-muted-foreground/30 bg-background text-muted-foreground`.

### Label styling by status
13. Current step label carries `text-foreground`; the other three carry `text-muted-foreground`.

### Horizontal connector coloring
14. Connector after a `completed` step is `bg-primary`; after `current`/`pending` is `bg-muted`.
15. A single step renders zero connectors.

### Vertical orientation
16. Vertical container present (`.space-y-4`), horizontal absent.
17. Descriptions **are** rendered in vertical mode.
18. A step without a description yields a text column with exactly one `<p>` (the label only).
19. Three `.h-12` vertical connector bars (N−1).
20. Vertical connector `bg-primary` when its step is completed, else `bg-muted`.
21. A single vertical step renders zero connectors.

### Click navigation (horizontal)
22. `allowNavigation` default `false` → clicking a completed step does **not** call `onStepClick`.
23. `allowNavigation` + completed step → `onStepClick` called once with the step `id`.
24. `allowNavigation` + non-completed (current/pending/error) → not called.
25. Mixed flow → fires only for completed steps, in click order, with correct ids.
26. `allowNavigation` with **no** `onStepClick` handler does not throw (the `&& onStepClick` guard).
27. Exactly one `.cursor-pointer` affordance (the single completed step) when navigation is allowed.
28. Zero `.cursor-pointer` affordances when navigation is disabled.

### Click navigation (vertical — mirrors the key gating logic)
29. Completed step click in vertical → `onStepClick('mapping')`.
30. `allowNavigation=false` in vertical → not called.
31. Exactly one `.cursor-pointer` affordance in vertical.

### Fail-safe & boundary
32. Empty `steps` array renders without crashing (horizontal): 0 circles, 0 connectors.
33. Empty `steps` array renders without crashing (vertical): 0 circles, 0 connectors.
34. Single step: one circle, number `1`, no connector.
35. Accepts the full `Step` shape (incl. optional `labelEn` / `description`) without breaking.
36. Long mixed flow is deterministic: 2 `cursor-pointer` (the two completed), 4 connectors, and
    navigation fires only for the completed steps in click order.

## Notes / observations

- **`labelEn` is dead.** The `Step` interface declares `labelEn?: string` but the component never
  renders it (unlike `description`, which is rendered in vertical mode). It is covered only as a
  fail-safe input (assertion 35 confirms it is accepted without error), **not** asserted as visible,
  to avoid locking in what is most likely an oversight. Flagging for a future fix; not in scope here.
- No new test-framework dependencies; the suite uses the repo's existing Vitest + @testing-library/react
  + jsdom stack and follows the class-assertion idiom of `confidence-indicator.test.tsx`. No Radix
  portals are involved (the component uses native `div` + `onClick`), so `fireEvent.click` on the
  label text drives the handler directly.

## Quality gate

- `vitest run tests/components/conversion/stepper.test.tsx` → **36 passed**.
- `eslint tests/components/conversion/stepper.test.tsx --max-warnings=0` → **clean**.
- `tsc --noEmit` (full repo, after `pnpm db:generate`) → **0 errors**.
