# Purchase Order, Service Request and Cash Request implementation

## Using the flows

Open **Request Workflows** in the sidebar (`/dashboard/workflows`). Prepare new records in their existing module pages; use this screen for review, hold/resume, correction, receipts and existing-request migration. **Shared Reviews** includes all five types: PR, petty cash, PO, SR and ordinary CR.

PO submission starts with all active Admin reviewers except its preparer. SR/CR use the PR diagram's requester entry: Engineer → Admin → amount-selected final stage; Admin → amount-selected final stage; other supported roles → final stage directly. Engineer/Admin/Senior Project Engineer stages require all assigned active members. The final stage requires one eligible Super Admin and one eligible CEO, in either order, excluding the requester. Empty groups block submission; an inactive required group reviewer blocks completion pending staffing resolution/new round.

Full totals use unit price × quantity, summed per PO line, with cent rounding. Below ₱100,000 selects Senior Project Engineer; exactly ₱100,000 selects the Super Admin/CEO stage. Installments do not lower approval authority. Payment schedules must equal the full SR/CR total. Amount-only legacy records use quantity one when absent.

Rejected requests retain their history. Owners withdraw for correction, edit the Draft, then submit a fresh round. SR/CR drafts can be corrected directly in Request Workflows, including payment schedules. PO line editing remains in Purchase Orders. Approved records require individual amendment/migration review rather than ordinary editing.

For SR-based POs, select catalog service/item lines so receiving can identify the exact PO line. SR-based POs now use the PO workflow, not the legacy payment-order PO type. Payment Request/Payment Order processing remains separately available according to the approved SR/CR type. Existing linked payment documents prevent duplicate creation and cannot be processed while their source is awaiting restarted approval.

## Receipts and release

Receipt files are private, require authorized download, and accept PNG/JPEG/PDF up to 10 MB with file-signature validation.

| Module | Record / upload | Verify / confirm |
| --- | --- | --- |
| PO | Original source requester or Admin-assigned active receiving Engineer records delivered quantities per PO line and uploads receipt | Admin verifies quantities; partial delivery remains `Partial Received`; all quantities verified becomes `Completed` |
| SR | Original requester confirms completed work and uploads receipt | Admin verifies acceptance against scope, then source becomes `Received` |
| CR | Admin records actual cash release and uploads signed receipt for each release | Original requester confirms each release; full confirmed total becomes `Received` |

Repeated receipt event keys cannot duplicate receiving/release. Excess quantities and over-release are rejected. Admin may return unverified PO/SR receipts with a reason; correction uses a new receipt event, preserving the old evidence. Cash already released is not undone by a receipt-return action. PO completion advances its linked PR only when all linked, non-cancelled POs are complete; PO approval itself does not mark the PR complete. PR/PCR approval routes remain unchanged.

Cash release requires an approved linked Payment Request/Payment Order (or its subsequent disbursement state) in addition to the CR's own approval. Admin cannot bypass payment-document approval by uploading a release receipt early.

## Live views and cache layers

Workflow responses are always SQL-backed and carry `private, no-store`. The browser's generic response cache is disabled except for explicitly opted-in immutable workflow option metadata. That metadata uses bounded identity-scoped browser memory, short-lived process memory and Redis cache-aside. Reference caches never authorize reviews, select current employees, validate projects, determine totals or prove release.

Authenticated Socket.IO events trigger fresh reads after committed changes. Reconnect/focus refresh and 10-second reconciliation recover missed events; disconnected views display a status. This interval is a missed-event safety net, not a response-cache TTL or a promise of zero network latency. Reviewer/cash actions always recheck locked SQL state. Late workflow-screen fetch responses are discarded by generation.

Socket rooms derive from verified JWT identity. Client-supplied room values cannot join another user/role. API limiting keys authenticated users separately so 20 people behind one office IP do not share one small read limit. A SQL outbox stores committed audit/update events and retries notifications; per-event/per-recipient notification mapping prevents duplicate persisted notifications. Redis supports shared reference caching and Socket.IO distribution across API workers. SQL retains approvals, receipt/release records, idempotency constraints and event history.

## Database preparation and migration

From `backend`, use:

```powershell
npm run workflow:schema
npm run workflow:inventory
```

The schema tool checks and adds the cash/petty-cash prerequisites as well as the dedicated workflow tables: cash request kind/payee/release/receipt fields; petty cash details/reviews and liquidation tables; Payment Request cash-source and Payment Order reimbursement-source columns/indexes. It merges status ENUM values while retaining existing values and defaults, and adds PO line receiving fields and decimal quantities. All additions are checked before execution, so partially upgraded databases can safely rerun the command. It reads only allowlisted CREATE TABLE definitions from forward migration files, not their older ENUM replacements or any SQL dumps. Do not run the older generic migration runner: it executes SQL dumps and unrelated files. Back up production data and receipt storage before applying schema changes. Schema preparation does not restart requests, overwrite records or infer missing historical payment-source links.

Admin can inspect **migration inventory and exceptions**, open each eligible request, inspect all direct/indirect linked documents and record each disposition before restarting approval. Restart all unpaid/unfulfilled records, including approved ones. Preserve existing votes, completed payments, deliveries and release amounts; individually reconcile partial records and linked documents. A request with invalid source/owner/lines is a repair exception, not a record that can safely be auto-approved or silently rebuilt.

For an inspected request with **no linked documents**, the CLI supports:

```powershell
node scripts/requestWorkflowMigration.js --restart=po:ID --actor=ADMIN_ID
```

The actor must be an active Admin. The CLI refuses linked documents; use the Admin screen for those.

### Local migration result on October 14, 2026

- Additive workflow schema applied to the existing local database, including receiving fields that were absent.
- PO #2 (`EAN-2026-08-001`): source and lines inspected, no linked payment documents, restarted into new round 1 at Admin review. Existing legacy review records retained.
- PO #1 (`PO-2026-0001`): repair exception. Its preparer employee, source PR and PO lines are missing. Approval was not restarted and no replacement data was fabricated. Restore/correct those facts before migration.
- No SR or ordinary CR records existed in the inspected local inventory. No production database or hosting deployment was changed.

## Redis and hosting

The current root Compose setup includes an internal-only Redis 7.4 service with a 128 MB disposable-cache limit, password authentication, health check and no published Redis port. Configure `REDIS_PASSWORD` and an authenticated `REDIS_URL` in the deployment environment using [the example](../deploy/.env.prod.example); URL-encode the password in the URL. Keep these credentials out of source control. The backend private receipt directory is mounted on `backend_private` and excluded from Docker build context.

For local Windows development, point backend `REDIS_URL` to an authenticated Redis instance (Docker/WSL/managed endpoint). The code functions with Redis unavailable: workflow reads still query SQL, immutable metadata falls back to its loader, and local sockets plus read reconciliation remain usable. Health reports whether Redis is configured/connected. Redis binaries/Docker were not available in this local session, so an actual Redis server/adapter connection has not yet been exercised. Start the Redis service and verify health/event distribution in the deployment environment before production rollout.

## Verification

`npm run test:workflows` in backend clones schema only into a uniquely named temporary test database, creates synthetic fixtures, runs HTTP/SQL integration tests, removes test receipts and drops only that generated test database. It never inserts test requests into the working database. Requires the existing MySQL/MariaDB server and permission to create the temporary database.

Coverage includes exact amount boundary, reviewer groups, self/out-of-order/duplicate votes, concurrent final votes, holds, absent reviewers, history, cash release/confirmation, private receipt access, partial PO receiving, SR acceptance, migration dispositions, live headers, 20 concurrent reads and Redis-disabled fallback. The 20-read check is a functional concurrency test on synthetic fixtures, not a production capacity benchmark.

Run the existing backend suite with `npm test -- --runInBand`; frontend unit tests with `npm test -- --run`; production bundle with `npm run build`. Real Redis outage/recovery and multi-instance deployment tests remain environment checks before rollout.
