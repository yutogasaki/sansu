# Multi-digit written arithmetic

User goal: 二桁以上の掛け算や割り算のUIが悩ましいので、良いのにして。

## Scope

Shared written arithmetic in Study / Island / Park: aligned partial products, conventional long division, current-step guidance, responsive input and safe resume. Governing contract: `docs/product/06_screen_specs.md`「多桁の筆算」.

## Completed

- Versioned pure layout/step generators implement partial products, shifted tens, quotient placement, multiplication/subtraction/bring-down, zeros and remainders.
- Shared readable grid and input corrections preserve old saved slots. New Study/Park current cells and full keypad measure at least44px at390×844 and768×1024.
- Verified core checks and rendered calculations, wrong/retry, physical/touch keys, persisted steps and final-only learning completion.

## Verification

- Review By: 2026-09-14

## Docs To Touch

- `docs/product/06_screen_specs.md`
- `docs/ai/verification_matrix.md`

## Verification status

PASS. `verify:core` (1,405 tests), smoke, classic/Island/Park PWA, Island/Park existing flows; final targeted64 tests, typecheck/lint/build; production9 scenarios /45 steps, Study/Park13 scenarios, real hook33 scenarios.

Changes do not alter routes, schema, world artwork, reward rules or SRS algorithms. Final arithmetic sources match fixed artifact `aa36adad7dcc-written-40b72d6bce2c`; parallel updates to three-dimensional resident/navigation code are recorded separately. No public deployment, commit or push was performed.

[Runtime gallery and detailed evidence](../../design/audits/2026-09-07-written-arithmetic/README.md).
