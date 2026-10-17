# Procurement audit remediation implementation plan

Date: October 17, 2026 (Asia/Manila)
Status: Local implementation and automated verification completed; staging, operational verification, migration rollout, and production release remain open. See `IMPLEMENTATION-RESULTS-2026-10-17.md` for exact evidence and limits.
Scope: The October 17 task list, the October 16 audit findings, and remaining verification.

## Architecture commitments

Implement incremental repairs within the existing React/Vite frontend, Express ES-module backend, mysql2 database access, MariaDB/MySQL schema, Redis cache, Socket.IO notifications, and Docker Compose deployment. Keep existing module routes, frontend service adapters, document relationships, and response contracts wherever possible. This work does not introduce a new framework, ORM, database, queue, or replacement approval engine.

| Responsibility | Existing implementation to retain |
| --- | --- |
| Web API calls and identity | `frontend/src/services/api.js` and module service files; existing bearer-token authentication |
| Authentication and role enforcement | `backend/middleware/auth.js`; current employee identity, active status, and database role |
| PO/SR/CR approvals | `backend/services/requestWorkflow.js`, `backend/utils/requestWorkflowRules.js`, `backend/routes/requestWorkflows.js` |
| Legacy PO/SR/CR compatibility | `backend/middleware/requestWorkflowGuard.js`, registered before module routes in `backend/server.js` |
| PR approvals | `backend/routes/purchaseRequests.js`, `purchase_request_reviews`, reviewer utilities in `backend/utils/notifications.js` |
| Petty cash approvals/liquidation | `backend/routes/pettyCashRequests.js`, `backend/utils/pettyCashReviewFlow.js`, existing petty cash review and liquidation tables |
| Database upgrades | `backend/database/migrations/`, existing schema inspection and explicit scripts under `backend/scripts/` |
| Events and notifications | Existing workflow events/outbox for PO/SR/CR; existing audit/notification utilities for other modules |
| Exports and infrastructure | ExcelJS, `backend/templates`, `backend/utils/excelTemplatePath.js`, current Docker build contexts and Compose services |

Preserve transactions, row/advisory locking, event history, source-link checks, ownership checks, project validation, order-number locks, and private response cache policy. Approval state remains authoritative in the database; Redis, frontend state, and Socket.IO must not grant permissions or advance documents independently.

Important distinctions verified in source:

- Unified PO/SR/CR flows use the final group at PHP 100,000 and above; final completion requires an active approved Super Admin and CEO role. PO starts at Admin. Other modules choose their initial stage by requester role.
- Petty cash uses its own role-dependent routing. Its ordinary amount boundary is PHP 100,000 or below versus above PHP 100,000; Senior Project Engineer and CEO requesters have explicit exceptions. Preserve the current helper's routing rather than copying unified rules.
- PR has its own reviewer assignments and accreditation gate. Resolve create/submit/resubmit inconsistencies inside that implementation; do not move PR into the PO/SR/CR engine during this repair.
- `requireSuperAdmin` currently permits `super_admin`, `senior_project_manager`, and `ceo`. Do not narrow that helper globally to repair a single endpoint.
- Historical documents describe behavior that conflicts with current code and audit expectations. Record discrepancies before changing business policy. Existing intentional, privileged PR bypass behavior must be distinguished from unauthorized direct-status access.

## Phase 0 — Establish contracts and reproducible evidence

1. Inventory affected routes, callers, response shapes, status enums, reviewer selection, and linked-document restrictions. Record a role/stage matrix for PR, PO, SR, CR, petty cash, reimbursement, Payment Request, Payment Order, and DV.
2. Preserve existing workspace edits and the October 16 audit artifacts. Save new results under dated October 17 filenames or directories; do not replace historical evidence without retaining its baseline.
3. Verify audit runners target a local disposable database and disable real email, push, scheduled jobs, and external writes. Clone schema only, seed synthetic records, and restrict cleanup to the generated test schema/files.
4. Inventory production reviewer coverage through authorized read access. Management must supply any required reviewer/account authorization; keep missing-reviewer errors intact. Local and staging work can continue with synthetic reviewers.

Acceptance: document expected transitions and permissions before editing them; distinguish intended policy from defects and test assumptions.

Baseline: October 16 saved flow audit: 38 scenarios, 27 passed, 11 failed, 261 HTTP steps. Saved endpoint audit: 684 checks, 21 flagged results. Fresh October 17 unit checks: 20 backend and 8 frontend tests passed. The workflow/endpoint audits have not yet been rerun on October 17.

## Phase 1 — Prepare compatible database upgrades

Locations: `backend/database/migrations/`, `backend/scripts/`, relevant schema preparation helpers.

- Inspect actual columns, types, defaults, indexes, and status values before applying DDL. Add missing supplier `rating_delivery`, `rating_quality`, `rating_pricing`, and `performance_notes` columns with types matching route validation and existing schema conventions.
- Merge reimbursement workflow statuses, including `For Admin Review`, `For Super Admin Final Approval`, and `Payment Order Created`, into the existing enum while preserving all current values, nullability, and defaults.
- Confirm reimbursement linkage columns and indexes already provided by workflow schema preparation; do not duplicate them.
- Provide an explicit, repeatable upgrade script with preflight output and post-upgrade checks. Keep deployment migrations separate from request handling and never re-import a historical SQL dump into an existing database.
- Inventory invalid/empty reimbursement statuses and other existing inconsistent data separately. Do not infer approvals or silently rewrite records during structural migration.
- For PR review history, first inspect available audit storage and uniqueness constraints. Preserve previous decisions durably before resetting active reviews. If current storage cannot distinguish submissions, use the smallest additive PR-specific history/round change and update all relevant queries; do not create a fourth approval engine.

Acceptance: migration succeeds on a schema clone and on a second run, preserves existing rows/enums, and supports the deployed MariaDB 10.4 configuration as well as the MySQL test environment. Treat DDL as potentially committing independently; verify backup restoration rather than promising transactional DDL rollback.

## Phase 2 — Close authentication and approval gaps

| Work | Files | Required result |
| --- | --- | --- |
| Authenticate image uploads before Multer writes | `backend/routes/uploads.js`, existing upload clients | Missing/invalid/inactive identity cannot write files; authorized callers retain the current response shape |
| Use shared active-account enforcement on profile reads | `backend/routes/auth.js`, `backend/middleware/auth.js` | Deactivated users cannot retrieve `/auth/me`; valid sessions continue to work |
| Restrict supplier accreditation explicitly | `backend/routes/suppliers.js`, frontend supplier controls | Enforce intended Super Admin permission locally; Engineer/Admin cannot accredit. Verify intended CEO/Senior permissions against the contract matrix rather than assuming the helper name defines policy |
| Restrict PR direct-status transitions | `backend/routes/purchaseRequests.js` | Ordinary reviewers cannot jump to `For Purchase`; legitimate dedicated privileged bypass keeps its documented checks and audit trail |
| Validate Payment Order review transitions | `backend/routes/paymentOrders.js` | Rejected/cancelled orders cannot be approved through a legacy endpoint; allowed hold/review actions remain consistent |
| Gate voucher payment | `backend/routes/disbursementVouchers.js` | Paid requires approved status, required certifications, valid linked-source approval, and an authorized releasing user |

Apply state checks and writes in one database transaction with appropriate locks. Test repeated and simultaneous approval/payment attempts. Send notifications after successful commit through the module's existing event mechanism.

Acceptance: unauthorized requests leave documents, files, links, and review history unchanged; alternate legacy methods cannot bypass the same restrictions.

## Phase 3 — Repair PR and supplier workflows

Locations: `backend/routes/purchaseRequests.js`, `backend/routes/suppliers.js`, existing reviewer/notification utilities and PR frontend service callers.

1. Accept valid database DECIMAL strings while rejecting blank, non-finite, negative, or otherwise invalid prices. Calculate totals from validated line items using compatible cent-based arithmetic; client totals must not override calculated amounts. Reconcile payment schedules using the same rounding rule.
2. Share the PR-specific selection of initial stage/reviewers across creation, draft submission, resubmission, and accreditation release. Preserve requester-role routing, self-review exclusion, amount thresholds, and required review groups.
3. On resubmission, preserve prior decisions/history and create fresh active reviews in one transaction. Old rejection rows must not decide the new submission. Refresh all review-list/detail queries to use the active submission if a round identifier is needed.
4. Preserve `Pending Accreditation Review` throughout creation/submission. Accreditation starts the first applicable review stage exactly once and cannot create duplicate assignments.
5. Repair the legacy approval query to use `employees`, retaining stage and authorization checks.
6. Remove supplier INSERTs from GET listing. Supplier creation belongs to explicit mutation routes; inspect callers relying on free-text suppliers and show a clear unresolved-supplier state instead of silently creating Active suppliers.
7. Handle empty supplier ID/name lookups without `IN ()`; repair supplier performance queries using actual schema columns.

Acceptance: PR draft submission, role-dependent resubmission, calculated total, unauthorized status, accreditation permission, and pending-accreditation scenarios pass. Repeated supplier GETs produce no new rows. Supplier create/edit works on the upgraded schema.

## Phase 4 — Repair linked finance and request actions

| Module | Implementation | Acceptance |
| --- | --- | --- |
| CR rejected edit | Use existing workflow withdraw/correction action, Draft edit route, then fresh submission through `workflowService` and current guards | Owner corrections work; partial failures leave a clear recoverable Draft/rejected state; no guard is weakened |
| CR Hold | Remove/disable the unsupported workflow action and explain available actions using existing UI patterns | UI does not send `hold` to a service that only accepts approved/rejected; no new business state is invented |
| Reimbursement to Payment Order | Align enum upgrades with existing review routes; persist `reimbursement_id` during Payment Order INSERT | Full review chain and reverse source lookup work; duplicate creation is rejected |
| Payment Request rejection | Restore the linked PR/CR/SR to its eligible source state only when current approval and other active links permit it | Rejected payment can be recreated without unlocking a source that is paid, fulfilled, revised, or already linked elsewhere |
| Payment Order deletion | Implement a transaction, deletion eligibility checks, dependent/link handling, audit record, and response | Eligible deletion completes; financial/history-bearing records are rejected appropriately; every path responds |
| Voucher details | Replace nonexistent `cr.receiver` with the correct existing relationship/field after checking schema | Detail reads work for every supported source type without guessing recipient data |

Retain `guardPaymentSource`, `guardLinkedDocument`, advisory locks, current-round checks, and one-active-payment-document protections. Cover retries and concurrent downstream creation across payment routes.

## Phase 5 — Repair forms, reporting, exports, and configuration

- **Service Request modal:** normalize the paginated supplier response in its existing frontend service/component boundary, preserving supplier-list pagination consumers. Check actual array type and loading/error handling; verify opening, selecting, saving, and reopening the modal.
- **Dashboard:** obtain complete role-scoped aggregates through existing report/count routes instead of five-row list snapshots. Define each metric's source, status filters, and period. Separate commitments from released payments, prevent linked-document double counting, and convert DECIMAL values deliberately. Reconcile fixture totals against SQL before presenting currency.
- **Currency:** repair UTF-8 peso labels in affected views and use consistent existing currency formatting; verify rendered labels and exported amounts.
- **PO workbook:** package the intended `PO 2026.xlsx` in `backend/templates` under the exact filename expected by export code. The Docker build context is `backend`; a repo-root fallback alone will not ship it. Verify the built image contains it, and inspect exported layout, formulas, signatures, line totals, and grand total.
- **Configuration/upstream behavior:** reconcile the frontend local API fallback (5001) with backend defaults (5005) and Compose mapping (5001 to 5000) through existing environment configuration. Replace fabricated project success with an explicit unavailable/empty state. Return controlled CORS rejection instead of an internal error while retaining the origin allowlist.
- **Attachments:** distinguish public catalog/profile imagery from private financial receipts. Test owner/reviewer/unrelated-user access and direct static URLs; close any private-file exposure without breaking intentionally public assets.

Acceptance: modal regression passes; more-than-five-record fixtures reconcile dashboard counts and totals; workbook exports work inside the deployment image; upstream errors do not create fictional project records.

## Phase 6 — Verification and evidence

Run checks after their corresponding changes, then run the complete release set once the fixes are integrated:

```powershell
# backend directory
npm test -- --runInBand
npm run test:workflows
node scripts/testAllFlows.mjs
node scripts/auditEndpoints.mjs

# frontend directory
npm test -- --run
npx vitest run --config audit/vitest.config.mjs
npm run lint
npm run build
```

Confirm the audit scripts' output destinations before running; preserve October 16 baselines. Review every flagged endpoint rather than equating expected HTTP status with correct business behavior. Keep the 38 scenarios and add focused regressions for fixes outside their coverage. If an old expectation conflicts with the verified architecture, document the correction and test the supported path; do not change assertions merely to obtain a green result.

Test at PHP 99,999.99, 100,000.00, and 100,000.01 across relevant requester roles. Exercise self-review, missing/inactive reviewers, all-required-reviewer completion, changed amounts, stale rounds, duplicate submissions, and concurrent payment/release actions.

In controlled staging, verify create/edit/submit/approve/reject/resubmit across roles, PO partial/full receiving and receipt verification, SR acceptance, CR release/confirmation, petty cash release/liquidation/return/review, and all linked payment/voucher paths. Check email/push/reminder/outbox behavior, cache invalidation and cross-user isolation, upstream outages, backup/restore, browser behavior, and mobile API compatibility. Native device delivery/layout remains explicitly unverified until actually exercised.

Acceptance: all 38 baseline scenarios pass or have a documented policy-correct replacement; additional defect regressions pass; no unresolved security/financial correctness failures; lint has no new errors/warnings; build and migration rehearsals succeed. Record local, staging, and production evidence separately, with any remaining blockers preventing full sign-off.

## Phase 7 — Release, reconciliation, and rollback

1. Prepare reviewable changes in dependency order: schema support; auth/state protection; PR/suppliers; finance actions; frontend/report/export repairs; integration evidence. Do not push `main` during preparation: `.github/workflows/ci.yml` currently deploys automatically on pushes to `main`.
2. Use the existing CI pipeline with explicit non-watching frontend tests and production build checks. Add deterministic workflow regressions using disposable synthetic databases; do not upload real database dumps or production fixtures as test artifacts. Check runtime compatibility: current CI uses Node 20 while the backend image uses Node 22.
3. Before an authorized release, retain the previous image/revision, verify restorable database and upload/private-file backups, and rehearse the additive migration against a staging copy. Confirm the actual persistent private-file paths match all receipt handlers and Compose volume mounts.
4. Apply explicit compatible migrations, deploy through existing Compose infrastructure, then perform authorized health/authentication and blocked-path checks. Keep live writes limited to agreed AUTOTEST records; do not place orders or release real funds for verification.
5. Re-read existing AUTOTEST records before deciding reconciliation: PR ID 55, CR ID 2, petty cash ID 3, supplier ID 38. The October 16 states are historical evidence. Record proposed disposition, linked dependencies, and any approvals; preserve history and never bulk-delete them automatically.
6. Roll back application images if release checks fail. Retain compatible additive columns/status values; do not shrink enums or drop populated history. Use verified restoration only when needed, accounting for any writes since backup and recording the recovery boundary.
7. Update dated audit evidence, the flow matrix, `worklog.md`, and task status with completed fixes, exact test results, deployment state, and remaining reviewer/device/operational blockers.

## Execution order and completion boundary

Order: contracts/baseline -> schema prerequisites -> security/state gates -> PR/suppliers -> linked finance -> UI/report/export/configuration -> integrated staging verification -> authorized release and reconciliation.

Production reviewer availability is an operational dependency, not permission to change approval rules. It does not block local fixes or staging tests. Changes to role policy, approval thresholds, intentional privileged bypass, or financial record disposition require a concrete documented business decision before implementing that change.

The day is complete only when results are recorded accurately. Passing unit tests alone does not establish end-to-end completion; unresolved release blockers remain open tasks.

## Source references

- `TASK FOR TOMORROW.txt`
- `docs/audit/CODEX-HANDOFF.md`
- `docs/audit/REVIEW-2026-10-16.md`
- `docs/audit/FLOW-MATRIX-AND-FOLLOWUP-2026-10-16.md`
- Architecture paths listed above, `system-flowchart.md`, `.github/workflows/ci.yml`, `docker-compose.yml`, and `backend/Dockerfile` inspected on October 17.
