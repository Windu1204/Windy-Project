# Corporate Non Piloting upload

This change applies only to Corporate Non Piloting. Dashboard columns, detail fields, report sections, role restrictions, and working-day calculations remain unchanged. Piloting AT retains its existing parser and SLA mapping.

## Source columns

Columns are matched by header, ignoring case, spacing, punctuation, and underscores. Their physical position does not matter. All compatible worksheets are read.

| Source header examples | Existing application field |
| --- | --- |
| No. Register, No Reg, Nomor Registrasi | noreg |
| Nama Perusahaan, Company | company |
| Jenis Produk, Produk, Product | product |
| Status Onboard, Status, Current Stage, Current State | status |
| Kelompok, Segmen, Segment | segment |
| Jenis Formulir, Form Type | formType |
| Jenis Permintaan, Request Type | requestType |
| Tanggal Submit, Tgl Submit, Submit Date | submitDate |
| Tanggal Assign, Tgl Assign, Assign Date | assignDate |
| Tanggal Progress, Tgl Progress, Progress Date | progressDate |
| Tanggal Done, Tgl Done, Done Date | doneDate |
| Keterangan SIL, Keterangan, Remarks | remarks |

An absent Create Date is not replaced by Submit or Assign. Clear New/Maintenance form labels can populate the existing project type field. Unrecognized or ambiguous labels remain unclassified. Extra source columns are archived internally, never added to dashboard/report/export columns.

## Completeness and SLA

Every nonblank source job is retained, including jobs without a product, status, register, or valid milestone date. Empty worksheet rows are counted separately in the existing upload issue list.

An absent register receives a stable internal reference based on the available identifying source values. The visible register remains empty. Without a real unique register, changing those identifying values can require reconciliation; the reader cannot prove that two unrelated requests are the same job.

Invalid dates, including `0000-00-00`, are preserved as invalid source values rather than converted into a successful zero-day SLA. The existing SLA diagnostics explain missing products, missing or invalid dates, reversed dates, and unavailable calendars. Jobs without enough SLA inputs remain in totals and reports.

SLA duration remains Assign to Done, using the existing working-day calendar, start/end convention, holidays, collective leave, and existing service targets.

## Repeated registers

Status and PIC are mutable values, not job identifiers. An upload can update an existing register without adding another job. Identical repeated jobs stay counted once and retain their status.

Within a workbook, explicit update timestamps take precedence. Otherwise valid Return, Done, Progress, Assign, and Submit timestamps determine the most recent version. Full timestamp precision is retained for reconciliation even when dashboard date fields show only a day. Earlier nonempty fields are retained when a later version omits them. The original competing source versions are archived internally.

Conflicting versions without a distinguishable timestamp are retained under the job with an explanation in the existing SLA diagnostics; the importer does not select Done by status priority or by worksheet row order. SLA is withheld until an unambiguous source update resolves the conflict.

A demonstrably older upload cannot regress a newer saved version. Missing optional cells do not erase existing milestones. A newer explicitly reopened status clears an omitted old Done date. Historical upload batches remain available. Existing Regional completion overrides are unchanged.

## Existing SLA service mapping

| Source product | Existing SLA service |
| --- | --- |
| Autodebet | BNIdirect |
| Autocollection | OGP |
| Integrasi ERP | BNIdirect-GFX |
| VAM | VA eCollection (Portal) |
| API SNAP | OGP SNAP |

For generic Virtual Account/API labels or an absent product, the reader examines the existing form, request, description, and remarks fields. Only unambiguous, named services are matched: VA Debit/Kredit, eCollection/Portal, VA SNAP, VA Non SNAP, iCons/RPA, and named API services such as RDN/RDL/RDF/MPN/OTR/ITR/FSCM. API is not automatically a VA. Conflicting or insufficient evidence leaves SLA unresolved. Explicit existing product names remain in the Product field.

## Verification

Unit tests cover source-column mapping, reordered columns, incomplete rows, invalid dates, missing registers, repeated statuses, stale uploads, ambiguous versions, existing targets, and unchanged AT behavior. The upload scale regression reads 100,000 records. The SQL regression runs review, commit, repeat upload, and stale upload inside a transaction that is always rolled back; it also checks other dashboard batch pointers remain unchanged.
