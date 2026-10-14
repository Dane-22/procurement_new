# Purchase Order, Service Request and Cash Request Implementation Plan

**Status:** Implementation authorized by the user. Backend/web workflows and local additive schema are implemented; production deployment and Redis runtime verification remain separate. See [implementation and migration notes](docs/PO_SR_CR_IMPLEMENTATION.md), including the local orphaned PO repair exception.

**Prepared:** October 14, 2026.

**Reference:** [system-flowchart.md](system-flowchart.md), section 2 for the PR reference and sections 4, 8 and 9 for the target PO, SR and CR workflows.

This is the consolidated proposal for our discussion. The older [PO plan](PO_FLOW_IMPLEMENTATION_PLAN.md) and [CR plan](CASH_REQUEST_FLOW_IMPLEMENTATION_PLAN.md) contain different rules and some findings that no longer reflect the current code. Use this document and the updated flowchart for the discussion; preserve those older files as historical drafts. Decisions below remain proposals until discussed. The review is based on checked-in/current workspace code, not an inspection of the live database.

## 1. Scope and intended outcome

Implement PR-style assigned, sequential reviewer groups for Purchase Orders, Service Requests and ordinary Cash Requests. Each document receives its own approvals, rejection history and resubmission rounds. Keep ordering, service acceptance, cash release and payment processing distinct from approval.

Preserve the existing PR and Petty Cash approval flows, including PCR-specific requester rules, liquidation and its different threshold boundary. Keep the existing `senior_project_manager` role key and display it as Senior Project Engineer. Do not change PR/PCR routes merely to make the new modules share an implementation.

Proposed initial scope is the backend and web application. Mobile support, new employee roles, automatic bypass, a new supplier accreditation process and a separate ordinary CR liquidation process are outside this draft's initial implementation scope. Confirm scope during discussion.

## 2. Workflow baseline from the updated flowchart

| Module / creator | First stage | Remaining stages | Final approval result |
| --- | --- | --- | --- |
| PO prepared by Admin | Admin review | Amount-based final review | `Approved`, eligible for ordering |
| SR or CR requested by Engineer | Engineer review | Admin review, then amount-based final review | `Approved`, eligible for downstream processing |
| SR or CR requested by Admin | Admin review | Amount-based final review | `Approved`, eligible for downstream processing |
| SR or CR requested by other supported roles | Super Admin/CEO final review | No preceding groups in section 2's diagram | `Approved`, subject to excluding the requester |

The requester-role table follows the accepted PR **diagram**. PR create, submit-draft and legacy routes do not all use the same entry rule; do not copy an arbitrary PR endpoint and assume it is the specification. Enumerate the supported requester roles before implementation.

For documents that pass Admin review:

- Below **₱100,000**: Senior Project Engineer final group.
- **₱100,000 or more**: Super Admin/CEO final group.
- Engineer, Admin and Senior Project Engineer groups require every assigned reviewer's approval. The Super Admin/CEO final stage requires one eligible Super Admin and one eligible CEO approval, in either order. The two final stages are alternatives.
- Evaluate the full document total, not an installment or one release.
- Exclude the requester/PO preparer from every group.
- Any rejection records a reason, sets the document to rework, and notifies its owner. Resubmission begins a new round at the original entry stage, retaining earlier history.
- Required groups with no eligible reviewer remain blocked for assignment rather than approving automatically.

## 3. Decisions to resolve in our discussion

The flowchart supplies the baseline. These questions determine how to enforce it and where the flowchart may need adjustment after discussion.

### Decisions recorded from the discussion

- **Final approval — agreed:** ₱100,000 or more requires **one eligible Super Admin approval and one eligible CEO approval**, in either order. The same requirement applies to the direct-entry Super Admin/CEO final stage. Neither approver may be the requester/preparer. If a required role has no eligible approver, block for an authorized replacement rather than waiving that role.
- **Higher-role requester entry:** Keep the entry stages shown in the PR diagram. Exclude the requester from their own approval group.
- **Amount:** Calculate the full total as **unit price × quantity**, summed across lines where applicable. Map legacy amount-only records explicitly; a quantity of one for amount-only types is a proposal, not a confirmed historical data interpretation.
- **Receiving/release and evidence — agreed:** For PO, the original requester or assigned receiving Engineer records delivered quantities and uploads the receipt; Admin verifies it against the PO lines. For SR, the original requester confirms completed service and uploads the receipt; Admin verifies it against approved scope. For CR, an authorized disbursement Admin records release and uploads a signed receipt; the original requester confirms actual cash receipt. Each partial delivery or release requires its own receipt tied to that event. A service receipt accompanies explicit confirmation that the work was completed.
- **Reviewer membership — agreed:** Engineer, Admin and Senior Project Engineer groups use all active employees in their applicable role, company-wide like PR, excluding the requester/preparer. Confirm how staff changes during a round trigger reassignment.
- **Cash release authority — agreed:** Admin may release cash, subject to approved request, signed receipt and transactional release checks.
- **Hosting and load — agreed:** Retain the current hosting setup and plan for 20 simultaneous users. Verify actual resource capacity and local Redis runtime during preparation; no hosting migration is proposed.
- **Live views — agreed:** Workflow views always fetch current database-backed data; no browser, API-process, Redis or intermediary response cache may serve workflow lists, details, reviewer queues, counts, statuses or release/receipt state. Refresh after committed events and on reconnect/focus; disconnected views must visibly indicate loss of live updates.
- **Existing requests — agreed:** Restart all unpaid/unfulfilled requests under the new flow, including approved requests. Review linked documents individually before restart. Preserve previous votes, payments, deliveries and releases as history/facts; do not repeat completed transactions. Confirm treatment of partially paid/fulfilled records during individual review.

| Decision | Proposed position | What needs agreement |
| --- | --- | --- |
| Supported requester/preparer roles | PO is Admin-prepared; SR/CR follow the table above. | List every allowed role. If higher roles may prepare a PO, decide their entry stage rather than inheriting broad middleware behavior. |
| Reviewer selection | Agreed: all active Engineers/Admins/Senior Project Engineers in each applicable group, company-wide; exclude owner. | How to apply staff changes during a round, and who authorizes replacements when a group is empty? |
| High-value/direct-entry final group | Agreed: one eligible Super Admin plus one eligible CEO approval, in either order; exclude owner. | Who authorizes replacements if a role has no eligible approver? Define the replacement process without silently waiving the role. |
| Higher-role requests | Confirmed: keep the PR diagram's entry stages. | Enumerate supported roles and the alternative when the requester is the only eligible final reviewer. |
| Amount calculation | Confirmed: full total is unit price × quantity, summed across lines. | Map existing amount-only types/records; define tax, discounts and rounding without multiplying historical totals twice. |
| PO source eligibility | PR must be `For Purchase`; SR must be approved and eligible for PO processing. | Which SR types can become a Purchase Order? Which should create only a Payment Request/Order? |
| Rejection and hold | `Rejected` permits owner correction; `On Hold` pauses a stage separately. | Who may hold/resume each module? Must every hold have a reason? Is hold needed for SR, which currently has no explicit hold action? |
| Changes after submission | Material changes restart all applicable approvals. | May a submitted request be withdrawn for editing? Which notes/date changes, if any, may be made without reapproval? |
| Changes after downstream creation | Prevent ordinary edits from invalidating existing orders/payments. | Define cancellation/amendment handling once a PO, payment document, DV or actual payment exists. |
| PO receiving and source completion | Agreed: original requester/assigned receiving Engineer records quantities and uploads receipt; Admin verifies PO lines. Receipt per partial delivery. | How to assign receiving Engineers and handle discrepancies, returns and rejected deliveries? When does the linked PR/SR finish if multiple documents exist? |
| SR acceptance | Agreed: original requester confirms completed work and uploads receipt; Admin verifies approved scope. | Who issues the service/job order? Define partial acceptance and correction after Admin finds a discrepancy. |
| CR release and receipt | Agreed: Admin may record release/upload signed receipt; original requester confirms actual receipt. Receipt per partial release. | Is release represented by a paid DV, a dedicated record, or both? Define reversals and non-cash payments. |
| Record visibility | Owner, assigned reviewers and authorized oversight staff see relevant records. | Exact project/branch access and who may see private payment/acceptance evidence. |
| Existing requests | Agreed: restart all unpaid/unfulfilled requests, including approved ones; review linked documents individually. | Map linked orders/payment documents and partially completed records before restart; determine cancellation/amendment actions without duplicating transactions. |
| Delivery scope | Backend and web first. | Is mobile creation/review required now? Confirm navigation and report/export coverage. |

The legacy `requireAdmin` and `requireSuperAdmin` helpers include multiple roles. They cannot, by themselves, establish the approved stage permissions.

### Existing-request migration: restart scope agreed

The previous proposal to complete unchanged approval rounds under old rules was rejected. Do not implement or retain that transition policy.

Move all unpaid/unfulfilled requests, including approved ones, into fresh new-flow approval rounds. Preserve previous decisions as history and require the new chain from its first applicable stage. Review each linked document before restarting its source request; agreed scope does not authorize deleting, cancelling or duplicating an existing order/payment document automatically.

Inventory purchase/payment documents, actual payments, partial deliveries and release evidence before choosing per-record cancellation, amendment or remaining-balance handling. Records with outstanding payment or fulfillment are candidates even if already approved; partially paid/fulfilled records require individual treatment that preserves completed financial/receiving facts. Fully paid and fulfilled historical records remain unchanged. Never delete votes, invent historical receipts or duplicate releases during migration. Record the workflow/round version and audit every migration action.

## 4. Current implementation and required work

| Area | Current workspace behavior | Planned work |
| --- | --- | --- |
| PO review | `po_admin_reviews` exists; submission uses `Pending Approval`; Admin rejection uses `On Hold`; resubmission and partial receiving already exist. | Add stage/round-aware final groups, exclude preparer, retain history and enforce all required approvals. Reuse existing receiving where correct. |
| PO final approval | Accepts Draft/On Hold/Pending Approval without checking completed Admin review; no amount branch. | Make every approval/status entry point enforce the current round, active stage and selected final group. |
| PO source status | Master PO approval currently marks the linked PR `Completed`. | Agree a compatibility mapping that distinguishes approval from fulfillment. Implement any change in PO/downstream handling without altering PR approval rules. |
| SR approval | Draft → Admin → Super Admin final → Approved; supplier and schedules are checked. | Add assigned Engineer/Admin/final groups and unified submission/resubmission routing. |
| CR approval | Draft → Admin → Super Admin final → Approved. Resubmission uses a ₱1,000/Department Head rule. | Replace the inconsistent legacy routing with the agreed PR-style round and amount rules. |
| SR/CR receipt | Document-created statuses or `Paid` currently allow receipt confirmation. | Require recorded service acceptance/release conditions; document creation alone is insufficient. |
| Payment processing | Payment Request/Order and DV routes support SR/CR sources and schedules. | Preserve links and `Approved` handoffs; prevent bypasses and duplicate documents. Handle partial/scheduled payments under the agreed rules. |
| Shared review inbox | Aggregates PR and PCR only. | Add PO/SR/ordinary CR with module-specific service calls and permissions, preserving PR/PCR behavior. |
| Schema | Checked-in dumps/migrations and route status values differ. | Inventory actual schemas later; design additive migrations from verified structure, not assumed dump contents. |

## 5. Proposed data and status design

### Review rounds and assignments

Prefer module-specific review records with a small reusable transition helper for these three modules. Compare extending `po_admin_reviews` with introducing a general PO review table that can represent all stages. Inspect whether SR/CR review tables referenced by existing routes actually exist before choosing table names. Do not migrate PR/PCR review storage as part of this work.

Each round should capture document ID, round number, owner, requester/preparer role, approval total, applicable stages and required reviewer assignments. Each decision records reviewer ID, stage, round, decision, reason/comment and timestamps. Preserve completed and rejected rounds. Enforce one assignment/decision per document, round, stage and reviewer.

Snapshot reviewer eligibility, but reject actions from deactivated users. A departure must trigger an explicit, audited replacement/reassignment decision; it must not silently reduce the required approval count.

### Approval states

| Business stage | Candidate stored representation | Transition condition |
| --- | --- | --- |
| Editing | `Draft` | Owner submits validated details. |
| Engineer group | `For Engineer Review` | All assigned Engineers approve. Applies only to eligible SR/CR requester paths. |
| Admin group | `For Admin Review`, or existing PO `Pending Approval` plus a separate stage field | All assigned Admins approve; choose the final stage from the full total. |
| Lower-value final group | `For Senior Project Manager Review` with Engineer display label | All assigned Senior Project Engineers approve. |
| Higher-value/direct-entry final group | `For Super Admin Final Approval` | One eligible Super Admin and one eligible CEO have approved, in either order. |
| Approved handoff | `Approved` | Ordering/payment processing may begin. |
| Rework | `Rejected` | Owner corrects and resubmits into a fresh round. |
| Pause | `On Hold` plus saved pending stage | Authorized resolution resumes unchanged details or requires a fresh round. |

Decide between explicit stored review statuses and a separate `approval_stage` field before writing migrations. The latter can preserve PO's public `Pending Approval` status, but every API/UI/export must use the stage to determine what actions are allowed.

Keep approval, fulfillment and payment facts separate. Candidate PO fulfillment values are the existing `Partial Received` and `Completed`; SR/CR requester confirmation uses existing `Received`. Keep existing downstream `PO Created`, `Payment Request Created`, `Payment Order Created` and payment links compatible. Decide whether separate fields/events are needed so one status does not overwrite a still-relevant approval or fulfillment fact.

## 6. Backend and integration approach

Prepare a transition contract per action: permitted source state, current round/stage, actor/assignment, required validations, resulting state and notification recipients. Submission and resubmission must call the same routing logic. Stage decisions must check the exact assignment rather than a broad role alone.

Perform submission, votes, round creation and stage advancement in transactions with document locking. Reject duplicate/stale decisions and serialize concurrent final votes. Send notifications after commit, with a retry strategy for delivery failures. Keep audits tied to the committed round and transition.

Use one server-side calculation of the full PHP total with exact cent handling. Validate that payment schedules reconcile with the agreed total. Never determine authority from a client-supplied approval total or installment amount.

Review existing final-approval, status-update, edit, resubmit, receive and downstream creation endpoints together. A new review endpoint alone cannot enforce the flow if an older endpoint can still advance or modify the same record. Preserve compatibility intentionally or retire old actions in the same module rollout.

Receiving must validate the actor, PO line identity, positive quantities and remaining quantities; avoid selecting an ambiguous line by catalog item ID when an item appears twice. Enforce the agreed uploader/receiver/verification responsibilities above. Require receipt evidence tied to the source and actual event, including a separate receipt for each partial delivery or release. Store uploads privately with authorized access and uploader/date metadata. Agree discrepancy correction and the relationship between Admin verification and final fulfillment status before coding. Payment document creation must not imply receipt.

## 7. Files expected to be affected after agreement

| Workstream | Existing files / directories |
| --- | --- |
| Module backend | `backend/routes/purchaseOrders.js`, `backend/routes/serviceRequests.js`, `backend/routes/cashRequests.js` |
| Shared authorization and visibility | `backend/middleware/auth.js`, `backend/utils/scopes.js`, `backend/utils/branchProjects.js` as needed; preserve existing PR/PCR permissions |
| Review notifications/audit | `backend/utils/notifications.js`, `backend/utils/auditLogger.js`, `backend/utils/socket.js` |
| Downstream integration | `backend/routes/paymentRequests.js`, `backend/routes/paymentOrders.js`, `backend/routes/disbursementVouchers.js` |
| Schema | New reviewed migrations in `backend/database/migrations/`; existing `create_po_admin_reviews.sql` as a reference |
| Module web screens | `frontend/src/components/purchase-orders/PurchaseOrders.jsx`, `frontend/src/components/service-requests/ServiceRequestsManagement.jsx`, `frontend/src/components/service-requests/ServiceRequestApproval.jsx`, `frontend/src/components/CashRequests.jsx` |
| Shared review/approval screens | `frontend/src/components/purchase-requests/RequestReviewInbox.jsx`, `frontend/src/components/approvals/Approvals.jsx`; adapt the PR page's inbox data loading only as necessary |
| Previews/services | Module preview components and `frontend/src/services/purchaseOrders.js`, `serviceRequests.js`, `cashRequests.js` |
| Labels/navigation | `frontend/src/utils/reviewLabels.js`, `frontend/src/components/ui/StatusBadge.jsx`, `frontend/src/config/navigation.js`, active app routers as needed |
| Verification/documentation | `backend/tests/`, `frontend/e2e/`, updated flowchart, module plans and relevant SOPs |
| Layered caching and runtime infrastructure | `frontend/src/services/api.js`, `frontend/src/services/socket.js`, `frontend/src/services/auth.js`, backend Redis/cache helpers, `backend/package.json`, `docker-compose.yml`, local deployment configuration and environment examples; proposed only |

These are expected touchpoints, not an instruction to edit every file. Confirm active routers, service methods and report/export dependencies during implementation preparation. Add new helper, review-table and evidence-storage files only after choosing the design.

## 8. Implementation phases after the discussion

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 0. Record decisions | Resolve section 3; reconcile old plans; finalize role, amount, state and evidence contracts. | One agreed rule set for all three modules; unresolved choices identified explicitly. |
| 1. Schema and compatibility preparation | Read-only schema inventory; examine existing pending/approved records and links; draft additive migrations and legacy mapping. | Migration/recovery approach reviewed against verified schema and representative records. |
| 2. Shared review foundation and caching | Round/assignment storage, exact totals, transitions, authorization, transactional event outbox, audit, Redis for eligible reference/event infrastructure and uncached live workflow reads. | Routing/concurrency, Redis failure/recovery and 20-user live-read checks pass; workflow response caching remains disabled. |
| 3. PO complete slice | Admin/final review, rework, source eligibility, ordering, line receipt, source completion mapping and matching UI/services. | PO target works end to end without premature approval/completion or legacy endpoint bypass. |
| 4. SR complete slice | Requester-based routing, quotation preparation, approvals, downstream selection, service acceptance and matching UI/services. | Accepted service and payment events remain distinct and all agreed paths work. |
| 5. CR complete slice | Requester routing, consistent resubmission, full-total approval, payment handoff, release evidence and requester receipt. | No approval/release shortcut remains; receipt requires actual release evidence. |
| 6. Shared inbox and regression | Integrate all five document types, filters/history/actions, exports and permissions. | PR/PCR retain existing behavior; reviewers see only actionable assigned stages. |
| 7. Rollout preparation | Rehearse migrations on a restored copy; apply legacy policy; prepare monitoring and recovery instructions. | End-to-end acceptance and migration rehearsal pass; deployment is separately scheduled. |

Proposed order is PO → SR → CR because PO already has review/receiving foundations and SR may depend on PO handling. Inbox integration can accompany each module; phase 6 completes and verifies it. Reorder after discussion if business priority favors CR. No duration estimate is committed until schema, evidence and legacy-record choices are settled.

## 9. Validation plan

| Scenario | Expected result |
| --- | --- |
| Engineer/Admin/each supported higher-role requester | Correct first stage and required remaining groups, matching the agreed role table. |
| ₱99,999.99 / ₱100,000.00 / ₱100,000.01 | Exact lower/higher-value branch for paths that pass Admin review. |
| Several installments below threshold with full total above it | Route from full total; installments cannot reduce authority. |
| Multiple assigned reviewers; out-of-order, self or unassigned vote | Advance only after required approvals; reject unauthorized or premature votes. |
| High-value/direct-entry final stage; several Super Admin/CEO accounts | One eligible vote from each role completes the final stage, in either order; one role alone never completes it. Self-votes are rejected. |
| Empty group or reviewer deactivation | Block for explicit assignment/replacement; never silently approve. |
| Duplicate or simultaneous final votes; stale round | One committed transition and no reused prior-round approval. |
| Reject at each stage; amount crosses threshold on resubmission | Preserve prior history; fresh entry stage and correctly recalculated final group. |
| Hold/resume; edit submitted or approved document | Enforce agreed recovery/edit rules and existing downstream restrictions. |
| Legacy final/status/edit endpoint invoked directly | Cannot bypass active stage, required votes or source eligibility. |
| PO partial delivery, repeated item lines, excess/duplicate receipt | Accurate line-specific receipt; no premature completion or unauthorized receiving. |
| PO/SR receipt upload and Admin verification; CR signed receipt | Enforce agreed actor responsibilities, required evidence and one receipt per partial delivery/release; prevent unrelated event receipts from satisfying the requirement. |
| SR payment document created before service performed | No false service acceptance; payment follows approved terms. |
| CR payment document created before cash release | No receipt confirmation until actual release requirements are met. |
| SR/CR downstream creation and partial/scheduled payment | Correct source links, totals and schedules; no duplicate or overpaid processing. |
| Owner/reviewer/project visibility and evidence access | Exact agreed access; private evidence remains protected. |
| PR/PCR existing approvals, thresholds, receipt and PCR liquidation | Existing behavior preserved. |
| Existing pending records and migration rehearsal | History/links preserved and each record follows its chosen rollout policy. |
| User switch, permission change and project/branch change with warm cache | No response or in-flight result from an old identity/scope is served; server authorization remains current. |
| Approval/rejection/release on another browser or API instance | Invalidate related details, lists, inboxes and counts; active action checks use locked database state regardless of displayed cache. |
| Redis unavailable/restarting/evicting entries; API restart | Reads fall back to the database within bounded timeouts; committed transactions, decisions and retry events remain durable. |
| Concurrent cache miss and write; old GET completes after mutation | Old response cannot repopulate the current cache generation or overwrite newer browser state. |
| Socket disconnected or event delivery retried | Reconnect/focus/polling refreshes data; consumers are idempotent and private events reach only authenticated authorized rooms. |
| Repeat release/receipt/payment creation after timeout | Database idempotency prevents duplicate transactions and event processing. |

Run backend tests, frontend checks and focused browser end-to-end scenarios appropriate to each implemented slice. Do not use production requests as test fixtures. A documentation-only planning change does not require application tests.

## 10. Completion criteria and discussion starting point

Implementation is complete when the agreed role/amount rules are enforced by every entry point, all required decisions are recorded by round, self-review and stale votes are prevented, rejection/hold recovery works, and actual fulfillment/release is distinguished from payment-document creation. Matching UI, private evidence access, source/payment compatibility, PR/PCR regression checks and migration rehearsal must pass.

Final approval counts, receiving/release responsibilities, company-wide active-role reviewer membership, Admin cash release, current hosting, 20-user concurrency and live workflow views are agreed. Existing-request restart scope is also agreed below. Continue with replacement authority, receipt discrepancy handling, status storage and individual downstream-document migration handling before implementation. Design approval does not authorize implementation.

## 11. Layered caching, Redis and live-view reliability

This section retains the agreed design. Implementation now exists; use [the implementation notes](docs/PO_SR_CR_IMPLEMENTATION.md) for current configuration, local migration results and remaining environment checks.

**Requested scope:** Include Redis and layered caching in the design, retain the current hosting setup, and support 20 simultaneous users. **Every workflow view must be live.** No Redis installation, infrastructure configuration or implementation has been performed.

### Existing behavior and necessary adjustment

`frontend/src/services/api.js` has a 30-second in-memory response Map keyed by method, URL and parameters, without user identity. Several module reads bypass that cache. PR/SR services also deduplicate in-flight requests; this is distinct from response caching. Socket subscriptions clear the general API cache. Branch/project reference data has a separate process cache. No Redis dependency/service is declared in the inspected backend package/Compose files; confirm actual runtime infrastructure before provisioning.

Disable retained response caching for all workflow views, including lists, details, reviewer inboxes, dashboard counts and payment/release/receipt status. Identity isolation and cancellation/discard of old in-flight responses remain necessary. Do not carry forward the previous 5–15 second display-staleness proposal.

### Agreed live-read path and proposed cache layers

```text
Workflow views -> authenticated API -> current SQL reads
Committed change -> durable SQL outbox -> authorized Socket.IO event
                 -> browser fetches current SQL-backed view

Other eligible reads -> identity-scoped browser/reference cache
                     -> Redis shared cache -> SQL/source on miss
Static fingerprinted frontend assets -> HTTP asset cache
```

| Layer | Permitted purpose | Workflow policy |
| --- | --- | --- |
| Browser memory | Static/reference data only where explicitly allowed; deduplicate simultaneous identical reads | No retained workflow response cache. Each load/refresh reads API; refetch after events/reconnect/focus. |
| API process | In-flight request coalescing; optional bounded reference-data cache | No retained workflow list/detail/status/count cache. Validate current identity/permissions on requests. |
| Redis | Shared eligible reference/static lookup caching and, when needed, cross-instance Socket.IO event distribution | Do not serve workflow response data, votes, approval eligibility or release state from Redis. All workflow reads use the primary DB. |
| SQL database | Current documents, review rounds, votes, payments, receipt/release records and durable events | Authoritative live reads; transactional locked checks for every state-changing action. |
| HTTP/proxy | Versioned static asset caching | Authenticated workflow responses and receipt downloads use `private, no-store`; no service-worker workflow response caching. |

Reference data that must itself always reflect current values also bypasses retained caches. Redis must not introduce stale requester eligibility, supplier accreditation, reviewer membership, project validity or authorization decisions. A Redis cache is useful only for explicitly approved non-live data; use it for supporting infrastructure rather than forcing workflow data into it.

Live means current committed DB data at fetch time plus prompt refresh when changes are committed. No distributed interface can promise a zero-latency update on a disconnected client. Show disconnected/reconnecting state, refetch on recovery and never permit financial actions from displayed stale state. Define event-to-view latency acceptance targets and polling interval during preparation; polling is recovery support, not an approved staleness window. Discard responses older than the current document/query generation to prevent late responses overwriting newer state.

### Cache isolation and committed-event delivery

- Eligible cache keys include environment/schema version, authenticated user and effective authorization scope where applicable, normalized query and data version. Never share personalized responses by role alone. Clear browser/in-flight state on user changes and discard old-identity responses.
- Use expiring, bounded caches only for explicitly allowed reference data, with measured TTLs and generation invalidation on corresponding changes. Protect concurrent cache fills against an intervening update and avoid broad Redis key scans.
- Persist workflow update/notification events in a SQL outbox in the same transaction as the business change. Deliver after commit with retries and idempotent consumers. Events trigger database-backed refreshes of affected details, lists, reviewer inboxes, counts and source/payment views; sockets do not substitute for durable state.
- Authenticate socket connections and derive user/role rooms from verified identity. The inspected socket implementation accepts client-requested room values; tighten that behavior as part of the planned infrastructure work. Send minimal authorized event payloads.
- If multiple API instances are used, select a Socket.IO Redis adapter and load-balancer connection policy. The standard Redis adapter uses Pub/Sub and does not support connection-state recovery; explicitly refresh on reconnect and retain SQL outbox/polling recovery.

### Redis operations and failure handling

Keep the current hosting setup. Propose a private Redis service within the existing deployment network, using the official `redis` Node.js client with a supported version pinned at implementation time. Verify local Docker/WSL availability separately. Configure credentials/ACLs, network isolation, TLS where required, health checks, bounded timeouts, reconnect backoff, memory limits and graceful shutdown. Do not publish Redis ports publicly or commit credentials.

Redis cache loss does not affect approvals/payments because SQL retains all authoritative state. Eligible reference reads fall back to their source on Redis failure. Workflow reads already use SQL; lost event distribution triggers visible connection/update degradation and DB-backed refresh recovery. Limit fallback/refetch concurrency and measure DB pool pressure at 20-user load.

Do not place durable jobs or idempotency records in an evictable Redis cache. Start with a SQL outbox worker for required retry delivery. If a Redis-backed job queue becomes necessary, plan separate persistence/eviction settings and retry recovery. A Redis coordination lock may reduce redundant cache fills; financial correctness always uses SQL locks and constraints.

### Other necessary work and checks

- SQL idempotency/unique constraints for votes, releases, receipts and downstream document creation; appropriate queue/source indexes, pagination and query plans.
- Exact full totals, review-round history, transactional state transitions and durable audits/outbox delivery; retries cannot duplicate committed decisions or payments.
- Private receipt storage, event/document linkage, upload validation/limits, authorized access, uploader/verifier metadata, retention/backups and recoverable upload/DB failure handling.
- Load testing with 20 concurrent users exercising live lists, detail views, counts and actions; measure API latency, DB queries/pool pressure, outbox/event latency and reconnect/refetch behavior. Verify whether current host capacity satisfies the agreed targets before considering scaling.
- Cache isolation, Redis outage/restart, missed socket events, stale-response races and user-switch tests. Verify no workflow endpoint is served from frontend/API/Redis/proxy caches.

### Remaining infrastructure details

Hosting, 20-user concurrency and live-view requirements are confirmed. Inspect host RAM/CPU and actual API instance count during preparation. Confirm local Redis runtime, desired event-to-view latency and monitoring thresholds. Redis scope remains planning only and does not authorize implementation.

### Technical references

Use [Redis cache-aside documentation](https://redis.io/docs/latest/develop/use-cases/cache-aside/) for eligible non-workflow cache data, the [official Node.js client guide](https://redis.io/docs/latest/develop/clients/nodejs/) and [connection documentation](https://redis.io/docs/latest/develop/clients/nodejs/connect/) for runtime setup, [Redis eviction documentation](https://redis.io/docs/latest/develop/reference/eviction/) for disposable cache memory policy, and the [Socket.IO Redis adapter guide](https://socket.io/docs/v4/redis-adapter/) for multi-instance event behavior and recovery limitations.

The sections above retain the design discussion. The user's later instruction to proceed authorized implementation. See the linked implementation notes for current behavior, checks and migration results; statements describing planning-only work reflect the earlier design stage.
