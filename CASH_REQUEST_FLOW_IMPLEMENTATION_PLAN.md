# Cash Request Approval Flow — Implementation Plan

**Status:** Discussion draft. No application or database changes are authorized by this plan.
**Reference:** Section 8 of `system-flowchart.md` (target CR flow), using the Purchase Request review sequence as the business model. The PR flowchart and PR code do not agree on every status and rejection path, so the decisions below must be settled before copying behavior.

## 1. Intended outcome

An employee submits a Cash Request (CR). Non-Admin requesters pass through Engineer review, then Admin review; an Admin requester starts at Admin review. Every required reviewer in a group must approve. After Admin review, a CR **below ₱100,000** goes to Senior Project Engineer review and a CR **at or above ₱100,000** goes to Super Admin final approval. A rejection returns the CR to its requester for editing and a fresh review round. Approved CRs continue into the existing payment and disbursement process, followed by cash release and requester receipt confirmation. Urgency is visible but does not bypass review.

This is the **target**, not the current application behavior.

## 2. Current implementation and gaps

| Area | Current code | Work required |
| --- | --- | --- |
| Submission | `backend/routes/cashRequests.js` creates a `Draft`; `PUT /:id/submit` sets `For Admin Review`. | Assign the correct first reviewer group and create review records atomically. |
| Review | Admin approval advances directly to `For Super Admin Final Approval`; final approval sets `Approved`. No Engineer or Senior Project Engineer CR review endpoint exists. | Add stage-aware, per-reviewer decisions and amount routing. |
| Resubmission | `PUT /:id/resubmit` uses a **₱1,000** threshold and can set `For Department Head Review`. | Replace this rule with the same first-stage routing as new submissions and reset review decisions. |
| Database | The checked-in `cash_requests.status` definition in `procurement_db (1).sql` lacks several statuses already used by routes. There is no checked-in `cash_request_reviews` table definition, although the delete route references that table. | Inspect each deployed schema before designing an additive, data-preserving migration. Add CR reviewer records and only the approved statuses. |
| Permissions | `requireAdmin` and `requireSuperAdmin` both include `senior_project_manager`; the latter also includes CEO. | Use explicit permissions for each CR stage and decide CEO authority. |
| Web | `CashRequests.jsx`, `Approvals.jsx`, and `CRPreviewModal.jsx` show legacy statuses/actions. The Admin CR handler in `Approvals.jsx` is defined but not used by its current CR tab. `CashRequests.jsx` calls `cashRequestService.resubmit`, which the service does not define. Cash Requests navigation is commented out in `frontend/src/config/navigation.js`. | Add reviewer queues, decisions/history, return/edit/resubmit, amount route visibility, and usable navigation. |
| Downstream | `paymentRequests.js` and `paymentOrders.js` accept only CR status `Approved`, then change it to `Payment Request Created` or `Payment Order Created`. DV routes support CR-linked schedules. | Preserve the `Approved` handoff and map release/receipt to existing payment/DV states without allowing payment before approval. |
| Mobile | The current mobile app is centered on PRs and has no dedicated CR screens. | Decide whether mobile CR creation/review is in this release or a later phase. |

## 3. Decisions for the discussion

1. **Who may request and review?** Confirm whether all non-Admin requester roles start with Engineer review, whether a requester may approve their own CR, whether all active Engineers/Admins/Senior Project Engineers must vote, and what happens if a required group has no active members. Do not silently skip an empty group.
2. **Final authority:** For CRs at or above ₱100,000, is approval limited to Super Admin, or may CEO approve? May Super Admin/CEO reject or hold a CR at any stage? The generic middleware currently grants the legacy `senior_project_manager` role some Super Admin access, which should not define the business rule by accident.
3. **Return and hold semantics:** Does any rejection become `Returned` for editing, or is `Rejected` a terminal decision with a separate resubmit action? Which role can resume an `On Hold` CR, and does resumption repeat reviews? Require a reason for rejection/hold if desired.
4. **Amount rule:** Use the CR's `amount` in PHP; confirm the exact ₱100,000 boundary, whether quantity changes the amount, and whether an edit that crosses the threshold resets every approval. The plan assumes all prior decisions are invalidated by any submitted edit.
5. **Cash release and close:** Identify who acts as Finance; the current employee roles do not include `finance`. Decide whether release is recorded by a paid Disbursement Voucher, by a dedicated CR action, or both. Decide whether final CR status should remain `Received` or become `Closed`, and what evidence the requester must provide.
6. **Existing CRs:** Decide how in-flight `For Admin Review`, `For Super Admin Final Approval`, `On Hold`, and legacy statuses are handled at rollout: complete under old rules, migrate into a new review round, or hold for manual triage. Existing approvals and payment links must be preserved.
7. **Scope:** Confirm whether this change covers the web app only at first, and whether urgency is merely a flag/priority marker as the flowchart now states.

## 4. Proposed state contract for approval

| Stage | Status to add/use | Successful transition |
| --- | --- | --- |
| Editing | `Draft` | Submit to `For Engineer Review`, or `For Admin Review` for Admin requester. |
| Engineer group | `For Engineer Review` | After all required approvals, `For Admin Review`. |
| Admin group | `For Admin Review` | After all required approvals, check the submitted amount. |
| Below ₱100,000 | `For Senior Project Manager Review` (legacy stored status; displayed as Senior Project Engineer review) | After all required approvals, `Approved`. |
| ₱100,000 or above | `For Super Admin Final Approval` | Authorized final approval sets `Approved`. |
| Rework / pause | `Returned` or `Rejected`; `On Hold` | Resolve according to the decisions in §3; a new submission starts a new review round. |
| Finance handoff | Keep `Approved`, then existing `Payment Request Created` / `Payment Order Created` | Only authorized downstream actions may advance the CR. Release and close status names remain a decision. |

Store reviewer **stage, review round, reviewer ID, decision, comment, and timestamps** separately from the CR status. Keep the complete history when a requester resubmits; do not overwrite earlier decisions. Capture the required reviewer set for each round so staff changes do not silently change an in-progress vote.

## 5. Implementation sequence after decisions are approved

### Phase A — Schema and transition contract

- Inventory the actual local and production CR status ENUMs, tables, foreign keys, and active records. The SQL dump is not proof of the live schema.
- Write a forward migration for approved statuses and a `cash_request_reviews` table with indexes/foreign keys and round-aware uniqueness. Include a rollback or recovery procedure and a mapping for legacy records.
- Define one transition table covering allowed source status, action, role, required votes, destination status, and notification recipients. Keep `Approved` compatible with Payment Request/Order creation.

### Phase B — Backend state machine and authorization

- Make create/submit/resubmit enter the same first applicable stage. In one transaction, lock the CR, validate amount and schedules, snapshot reviewers, create pending reviews, change status, and write audit history.
- Add one stage-aware review endpoint (or explicitly separated endpoints) for Engineer, Admin, Senior Project Engineer, and Super Admin decisions. Validate the reviewer's active assignment and current stage; reject duplicate/stale votes and self-review according to §3.
- On final group approval, use `< 100000` versus `>= 100000` exactly. A rejection returns to the requester; resubmission starts a new round and invalidates prior decisions. Handle hold/resume explicitly.
- Replace broad role middleware on CR actions with exact role checks. Limit queue/list/detail visibility to the requester, assigned reviewers, and authorized oversight roles. Make notifications and socket events reflect the committed transition.
- Fix the CR delete path's reference to nonexistent/incorrect review and schedule tables as part of migration compatibility work.

### Phase C — Web and downstream integration

- Update `frontend/src/services/cashRequests.js`, `CashRequests.jsx`, `Approvals.jsx`, `CRPreviewModal.jsx`, status badges/filters, and navigation. Show who has approved, who remains, the current amount route, decision reasons, and a clear edit/resubmit action.
- Keep Payment Request, Payment Order, and DV creation blocked until CR status is `Approved`. Define release and receipt as separate recorded events if the existing payment/DV states do not prove cash was handed to the requester.
- Update exports, dashboards, audit logs, notifications, and SOPs to the approved status names. Add mobile screens only if included in the agreed scope.

### Phase D — Verification and rollout

- Test each requester role, all reviewer groups, the ₱99,999.99/₱100,000 boundary, multiple reviewers, zero reviewers, duplicate votes, concurrent approvals, unauthorized actions, rejection at each stage, hold/resume, resubmission after amount change, and edit after approval attempts.
- Test `Approved` → Payment Request or Payment Order → DV/paid release → requester receipt, including schedule and amount consistency and prevention of duplicate downstream documents.
- Run migration rehearsal on a restored database copy, verify existing CRs and links, then deploy behind the agreed cutover policy. Monitor transition errors and provide a documented rollback path.

## 6. Completion criteria

The new flow is ready only when the decisions in §3 are recorded, a migrated database accepts every approved status, each assigned reviewer can act exactly once per round, unauthorized users cannot advance a CR, the ₱100,000 branches and return path work end to end, downstream payment documents remain valid, and both web UI and automated tests reflect the same transitions. Production rollout requires separate approval after those checks.
