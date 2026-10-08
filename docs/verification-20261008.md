# Verification — 8 October 2026

- 43 unit tests passed across 10 files; TypeScript and production build passed.
- 9 browser tests passed: adjacent chart details, regional milestone/Done dialog, role-scoped views, theme persistence, grouped view-as picker, and responsive upload worker.
- PPTX and DOCX export smoke tests passed for IJR, Regional, Corporate Non Piloting and Corporate Piloting.
- Parser tested with 100,000 reordered CSV rows, headers after row 100, multiple compatible sheets, blank rows, invalid dates, and conflicting AT registers. AT also reads every compatible sheet.
- Database transaction tests verified 100,000 source rows (99,998 valid plus 2 diagnosed), idempotent commit, status/date refresh, preservation of ambiguous existing rows, and application Done precedence. Tests rolled back; operational record count remained 13,728.
- Live database role test verified Regional individual sees only their mapped job, cannot upload, can mark their job Done, stores Jakarta Done date, preserves document-complete date, and emits a realtime revision event. Test rolled back.

## Data and calculation boundaries

- Source AT workbook with 258 rows contains 257 unique registers: Excel rows 186 and 254 share a register but differ in status, dates and other fields. Both conflicting rows are diagnosed rather than choosing a winner silently. The revised source workbook has 257 rows.
- Existing ambiguous identities and missing identity keys are preserved. Incoming matches to ambiguous identities require correction and expose source-row reasons.
- Calendar calculations include weekends, Indonesian national holidays and collective leave for 2025–2026. Dates outside the available calendar are explicitly unmeasured rather than receiving an invented SLA.
- IJR uses Total Day TBS and AT uses source Hari Penyelesaian; these supplied durations are not silently recomputed. Reject is excluded from AT SLA.
- PM duration separation from AT remains deferred pending source data, as requested.
- No operational records were reset or deleted during verification. Changes are limited to the requested upload, SLA, role-scoped diagnostics and reports.
