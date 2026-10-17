# Procurement remediation results — October 17, 2026

Status: Implemented and verified locally. No commit, push, production migration, production record reconciliation, or deployment was performed.

## Architecture preserved

The implementation retains React/Vite, frontend module services, Express routes/middleware, mysql2, SQL transactions and locks, Redis, Socket.IO, existing notification mechanisms, and Docker Compose. No dependencies were added.

PR continues to use `purchase_request_reviews`; previous review sets are archived in an additive PR history table rather than folded into the PO/SR/CR engine. PO/SR/CR still use their shared workflow service and guards. Petty cash retains its separate review/liquidation implementation and amount/requester exceptions.

Source review resolved a discrepancy in older handoffs: the current PR creation and review code uses Engineer review for supported non-Admin requesters, including Senior Project Engineer; Admin requesters start at Admin review. Draft submission, resubmission, and accreditation release now follow that existing PR policy consistently. The shared PO/SR/CR initial-stage rules remain separate. Approval thresholds and the dedicated privileged PR bypass were not replaced.

## Implemented

- Authenticated image uploads before file writes; `/auth/me` now uses the shared active-account authentication middleware. Password sync checks missing credentials before service configuration, returning 401 for anonymous calls and 503 for an unavailable configured service path rather than an internal error.
- Restricted supplier accreditation to the exact `super_admin` role at that endpoint. The broader `requireSuperAdmin` helper remains intact for unrelated routes.
- Removed supplier creation from GET listing, fixed the empty supplier lookup and supplier-performance column, and made accreditation/reviewer assignment transactional and repeatable.
- Added compatible supplier rating columns, reimbursement status values, the missing PR accreditation enum value, and PR review-history storage through an explicit additive migration. Existing enum values/defaults/nullability are preserved.
- Fixed PR DECIMAL submission validation, server-calculated cent-based line totals, accreditation gating, and rejection/resubmission. Prior reviews are archived transactionally, fresh assignments replace them, and the detail response exposes `review_history`. Concurrent corrections create one fresh set. Draft/create/resubmit agree on optional debt schedules; supplied schedules must still reconcile.
- Disabled arbitrary PR direct-status changes and repaired the legacy `users` query to reference `employees`.
- Repaired reimbursement linkage in Payment Orders; derive payment totals from source records; serialize numbering with a current locking read to prevent duplicates. PR-backed Payment Requests also recheck source eligibility under lock and cannot duplicate or override the approved total.
- Rejected Payment Orders cannot be approved through legacy review/status routes. Payment Request creation/status edits cannot grant approval. Rejection restores eligible PR/CR/SR sources only when their current approvals and remaining links permit it.
- Implemented responding, transactional deletion for eligible Payment Orders and Payment Requests, with audit snapshots and source restoration. Approved/linked financial records retain their history.
- Repaired voucher details (`cr.received_by`), enforced accounting before manager certification and both certifications before payment, blocked status-edit shortcuts, and serialized concurrent payments/deletion. A repeated payment attempt returns a conflict.
- Retained the supported CR withdraw → Draft edit → fresh submit flow. The frontend service can retry an already-Draft correction. Removed unsupported Hold submissions from the legacy CR table; dedicated workflow actions remain available.
- Fixed the Service Request supplier response shape. Added complete role-scoped dashboard aggregates; the chart now measures paid vouchers once, retains decimal amounts, and identifies exclusions. Load failures show an unavailable state rather than zero-valued metrics.
- Protected legacy reimbursement/PO receipt URLs with identity/document checks, including encoded paths. Reimbursement previews/downloads now fetch through the authenticated API client and revoke temporary blob URLs. Catalog/profile image paths keep their existing delivery behavior.
- Packaged `backend/templates/PO 2026.xlsx` inside the backend build context and exported numeric PO quantities/totals. Corrected corrupted dashboard currency formatting.
- Removed fabricated upstream project fallback, returned controlled CORS rejection, aligned native-development API/Socket.IO defaults at port 5005, and kept production/Docker URLs configurable with `VITE_API_URL`.
- Added a persistent Compose volume for the existing `/app/private_uploads` petty cash receipt path. CI uses Node 22 to match the backend image, non-watching frontend tests, workflow/remediation checks, the Service Request regression, and a frontend production build. CI itself was not run remotely.

## Verification

| Check | Result |
| --- | --- |
| Backend unit suite | 24 passed |
| Existing workflow integration suite | 17 passed |
| Expanded isolated workflow/remediation audit | 53 passed, 0 failed; 366 recorded HTTP steps |
| Endpoint audit | 197 route registrations; 691 checks; 0 flagged |
| Frontend unit/component suite | 13 passed |
| Service Request modal audit regression | 1 passed |
| Frontend production build | Passed |
| Frontend lint | 0 errors; 10 existing warnings |

The expanded audit includes the original 38 scenarios and 15 targeted scenarios for migration repeatability, active-account enforcement, review-history preservation, duplicate corrections, role routing, supplier reads/accreditation, financial deletion/source restoration, approval shortcuts, concurrent numbering/payment, dashboard reconciliation, private attachments, CORS, and workbook values.

One old CR audit expectation was corrected: it demanded success from a legacy resubmit endpoint even though the current frontend service already uses withdraw/edit/submit. The new scenario verifies that supported sequence and verifies the legacy endpoint remains blocked. No approval guard was relaxed to satisfy the old expectation.

Evidence:

- `full-flow-results-2026-10-17.json` and `full-flow-run-2026-10-17.log`
- `endpoint-results-2026-10-17.json` and `endpoint-run-2026-10-17.log`
- `backend/scripts/auditRemediationScenarios.mjs`
- Frontend regressions in `src/components/shared/ProtectedAttachment.test.jsx`, `src/services/cashRequests.test.js`, and `audit/service-request-form.audit.jsx`

The initial rerun used the old runner's default output path and replaced `full-flow-results.json`. The historical October 16 figures (27/38 passed, 11 failed) remain in the dated reports and handoff; the exact original JSON is not claimed as preserved. Subsequent runs use October 17 filenames. `full-flow-results-2026-10-17-first-run.json` records an intermediate result, not final verification.

All write-flow tests used uniquely named disposable local schema clones with synthetic users/data, disabled Redis, an in-process project fixture, and test-mode job suppression. The runners clean up their own schemas/receipt files. These are not live Chrome-profile results or evidence of production financial release. Workbook contents/numeric values were verified with ExcelJS; final rendered/printed workbook layout remains a staging/manual check.

## Required rollout steps

Run commands from the backend directory against the intended staging/release configuration:

```powershell
npm run audit:schema:check
npm run workflow:schema
npm run audit:schema
```

`audit:schema:check` is read-only and reports the target database/version and relevant schema. The other two commands explicitly apply additive structural upgrades. The audit remediation upgrade was also applied to the verified local development database (`localhost:3306`, MySQL 8.4.7) after saving `local-schema-before-remediation-2026-10-17.json`. Existing table row counts were verified unchanged; no request or approval rows were edited. Production was not migrated.

Before applying production DDL, retain and verify database, upload, `/app/private`, and `/app/private_uploads` backups. MySQL/MariaDB DDL is not promised to roll back as one transaction. Rehearse the upgrade against the actual deployed MariaDB 10.4 environment and inspect invalid historical reimbursement statuses separately; do not infer approvals or automatically repair historical records.

Before enabling the new `backend_private_uploads` volume, copy any existing petty cash files out of the running container's `/app/private_uploads` directory and restore/verify them in the persistent volume. A new empty volume would otherwise hide those existing files after recreation.

The existing workflow deploys automatically on a push to `main`; no such push was made. Complete backups, compatible migrations, receipt preservation, staging validation, and release review before using that deployment path. Roll back application images if needed while retaining compatible additive schema/history.

## Still open before complete sign-off

- Confirm current authorized production reviewer coverage. The last live audit reported no active CEO and missing connected reviewers; that roster was not re-queried or altered in this implementation.
- Rehearse migrations and restore/rollback using the actual staging/deployment environment. Docker was unavailable locally, so image construction, container template presence, and real volume restoration were not executed.
- Complete signed-in browser testing across roles and actual native iOS/Android checks, including authenticated attachment previews/downloads. Mobile source was not modified; native API compatibility was not established by web tests.
- Inspect printed/rendered workbook layout and reconcile representative production/staging totals, including long item lists and all financial source variants.
- Verify real email/push/reminder delivery, Redis availability/invalidation behavior, upstream outages, and full operational backup restoration. Synthetic workflow tests and Redis-disabled fallback checks do not prove those production services.
- Configure and verify password synchronization with authorized credentials; no secret was generated, rotated, or inserted during this work.
- Review retained AUTOTEST PR 55, CR 2, petty cash 3, and supplier 38 and their dependencies before any authorized reconciliation. Their current live states were not changed or assumed.

These open checks prevent a claim of completed production rollout or full end-to-end sign-off.
