# Regression Test Plan (Phase 0)

Status: a zero-dependency Node characterization harness and synthetic fixtures/goldens now cover TEST-001–016 partially. TEST-001–016 pass for the specific paths listed in tests/characterization.test.cjs; uncovered branches remain pending. TEST-017–022 and extended golden/security cases are planned but not run. Fixtures are synthetic. Before business logic change, expand baseline coverage; retain actual behavior, not guessed business rules.

## TEST-001–004: plot lookup/owners
- TEST-001 existing synthetic plot in each source path.
- TEST-002 missing plot behavior for each entrypoint.
- TEST-003 exactly one synthetic owner.
- TEST-004 multiple owners and selection/order.
- Record differences between index, JSON payment/admin and finance panel; do not impose one result.

## TEST-005–014: calculation characterization
- TEST-005 positive debt and category allocation.
- TEST-006 electricity amount using current source behavior.
- TEST-007 previous meter reading.
- TEST-008 current meter reading.
- TEST-009 positive consumption.
- TEST-010 decreasing reading; public formula clamps to zero, capture other paths separately.
- TEST-011 zero consumption.
- TEST-012 tariff configuration is shared by every entrypoint; legacy localStorage values are ignored and preserved.
- TEST-013 membership fee and area conversion.
- TEST-014 target fee and total composition, including balance/overpayment.
- Include decimal/missing/null/text inputs and rounding boundaries as synthetic values; never rewrite real plotData during calculation checks.

## TEST-015–016: QR
- TEST-015 capture payload per existing implementation and generated matrix for synthetic data/requisites.
- TEST-016 exact purpose, field order, character/byte length boundary, delimiter replacement, Cyrillic encoding, amount rounding and optional KPP.
- Keep QR-A/QR-B/QR-C golden results separate; not visual-only comparison.

## Coverage status for implemented harness

- TEST-001/002: synthetic base ODS present/missing lookup PASS.
- TEST-003/004: payment app one/multiple-owner branch selection PASS (DOM behavior stubbed).
- TEST-005: public debt parser fields/categories PASS.
- TEST-006–011: public electricity parser tariff/readings/consumption branches PASS; this does not verify payment amount multiplication in every UI.
- TEST-012: previous stored-tariff precedence characterization is superseded by tariffs.js; verify legacy keys are ignored and retained.
- TEST-013: debt category separation PASS; membership rate/area conversion remains pending.
- TEST-014: checked-component total in payment form PASS; balance/overpayment remains pending.
- TEST-015: public QR payload order/string PASS; no QR matrix and other variants pending.
- TEST-016: finance QR purpose suffix/length PASS; UTF-8 byte boundary and all QR variants pending.

## TEST-017–019: print/import/export
- TEST-017 print receipt and mass print output structure.
- TEST-018 valid XLSX import/export round trip with synthetic data, missing/extra fields and accepted header aliases.
- TEST-019 invalid workbook, corrupt ZIP, unexpected types, missing fields, oversized file and duplicates. Determine current partial-write behavior. Do not add parse/validate/normalize/preview/commit before characterization.

## TEST-020–022: PWA/service worker
- TEST-020 install and offline shell; record exact precache list.
- TEST-021 online -> offline -> online, cache entries and stale-data behavior.
- TEST-022 SW update/version activation, cleanup, failed-network recovery and whether private/API responses cache.
- Use disposable profile and synthetic endpoints; do not clear real user storage.

## Additional characterization
Auth default/fallback/expiry; users.json fallback; sessionStorage role tampering; token persistence/API authorization; synthetic HTML injection; SW cache inspection; import atomicity. No real secrets or personal data in fixtures/logs.

## Harness and acceptance
Workspace has no package/build configuration. A zero-dependency Node harness extracts selected existing pure/nested functions and runs without browser globals/CDN. Extend it or add a disposable browser harness only with synthetic fixtures. Required patch gates: syntax, unit, characterization, golden, security, build (if available), smoke. Current project has no build command: mark NOT AVAILABLE, not pass. Current execution: `node --test tests/characterization.test.cjs` passed 10/10 subtests (covering behavior IDs TEST-001–016 in a subset); syntax checks passed for all six standalone JS files. Import/export, print, full QR byte/matrix output, PWA/browser and server behavior remain NOT RUN. Phase 0 changed docs/test artifacts/Git metadata only; application behavior unchanged.