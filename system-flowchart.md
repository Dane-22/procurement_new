# Procurement System Flowchart

## 1. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Request modules: Purchase Requests, Petty Cash Requests, Cash Requests,     │
│ Service Requests, Purchase Orders, inventory and supplier management         │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│ Requester      │   │ Reviewer        │   │ Admin /        │
│ creates/submits│──►│ reviews assigned│──►│ procurement    │
│ a request      │   │ work queue      │   │ processing     │
└────────────────┘   └────────────────┘   └───────┬────────┘
                                                    │
                                          ┌─────────▼────────┐
                                          │ Approval, order, │
                                          │ release or       │
                                          │ fulfillment flow│
                                          └──────────────────┘
```

---

## 2. PURCHASE REQUEST (PR) APPROVAL FLOW

The normal submitted PR review is sequential. The requester cannot review their own request. Each assigned reviewer in the active stage must approve before the request advances.

```text
Requester saves PR as Draft
          │ submit
          ├─ Engineer requester ─► Engineer review group
          ├─ Admin requester ────► Admin review group
          └─ Other supported requester roles ─► Super Admin/CEO final group
                                                  │
Engineer group approves (when applicable)
          │
          ▼
Admin review group approves (when applicable)
          │
          ▼
Check total amount
      ┌───┴─────────────────────┐
      │                         │
Below ₱100,000             ₱100,000 or more
      │                         │
      ▼                         ▼
Senior Project Engineer    Super Admin/CEO
review group                final review group
      │                         │
      └────────────┬────────────┘
                   │ approved
                   ▼
               For Purchase
                   │
                   ▼
              PO creation flow

At any active review stage, a rejection sets the PR to Rejected and notifies
the requester. The requester can edit and resubmit; resubmission behavior is
handled by the relevant PR route and may restart at the applicable stage.
```

**Implementation notes:** Active reviewer assignments are created for the review chain and status gates which stage can act. `Pending Accreditation Review` blocks the ordinary review chain until the supplier accreditation process is completed. Legacy routes for PR resubmission, final approval, and bypass have different transitions; use the endpoint-specific behavior when troubleshooting an individual PR. The bypass endpoint is documented separately below.

---

## 2.1 PURCHASE REQUEST - UNACCREDITED SUPPLIER FLOW

```text
┌─────────────────┐
│ Engineer        │
│ Creates PR      │
│ (Unaccredited   │
│  Supplier)      │
└────────┬────────┘
         │
         │ (Reviewers are purposefully NOT assigned yet)
         ▼
┌─────────────────┐
│ Status: PENDING │
│ ACCREDITATION   │
│ REVIEW          │
└────────┬────────┘
         │
         │ Super Admin goes to Suppliers tab
         │ and accredits the supplier
         ▼
┌─────────────────┐
│ Status advances │
│ to the first    │
│ applicable PR   │
│ review stage    │
└────────┬────────┘
         │
         │ System dynamically assigns required reviewers
         │ based on requester role.
         ▼
┌─────────────────┐
│ Reviewers       │
│ open the shared │
│ Reviews tab     │
└────────┬────────┘
         │
         │ Assigned reviewers see the request when their
         │ review stage is active.
         ▼
┌─────────────────┐
│ Proceed to      │
│ normal PR       │
│ Review Flow     │
└─────────────────┘
```

---

## 2.2 PURCHASE REQUEST - BYPASS FLOW

```text
┌─────────────────┐
│ User creates PR │
│ in an eligible  │
│ review state    │
└────────┬────────┘
         │
         ▼
┌───────────────────────────┐
│ Super Admin / CEO         │
│           OR              │
│ Senior Project Engineer   │
└────────┬──────────────────┘
         │
         │ Clicks "Bypass Approvals"
         ▼
┌───────────────────────────┐
│ Status: FOR PURCHASE      │
│ - Approves PR directly    │
│ - Notifies all pending    │
│   reviewers               │
│ - Sets is_bypassed = 1    │
└───────────────────────────┘
```

---

## 2.3 ITEM REQUEST FLOW (MOBILE APP)

```text
┌─────────────────┐
│ Engineer        │
│ Creates Item    │
│ Request         │
│ (Mobile App)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Status: FOR     │
│ ADMIN PROCESSING│
└────────┬────────┘
         │
         │ Admin enters supplier
         │ and pricing info
         ▼
┌─────────────────┐
│ Status: FOR     │
│ ENGINEER REVIEW │
│ (Admin Review   │
│ is auto-approved│
│ since Admin     │
│ processed it)   │
└────────┬────────┘
         │
         │ All Engineers Review
         ▼
┌─────────────────┐
│ Status: FOR     │
│ SUPER ADMIN REP │
│ REVIEW          │
└────────┬────────┘
         │
         ▼
(Proceed to Super Admin Rep Review)
```

---

## 3. SHARED REQUEST REVIEWS

The Purchase Requests page includes a shared **Reviews** tab for Purchase Requests, Petty Cash Requests, Purchase Orders, Service Requests and ordinary Cash Requests. Its request type field identifies the flow; only assigned active-stage work is actionable. PO/SR/CR rows open the Request Workflows screen.

```text
Assigned review records from PR, PCR, PO, SR and CR
                 │
                 ▼
        Shared Reviews tab
                 │
         Select request type
           ┌─────┴─────┐
           ▼           ▼
    Purchase Request  Petty Cash Request
     PR review route   PCR review route
PO / SR / CR rows -> Request Workflows -> module-specific active stage
```

The reviewer must have an active assignment for the current stage, excluding the requester. PR/PCR retain their existing rules. PO/SR/CR Engineer, Admin and Senior Project Engineer groups require all assigned approvals; their final stage requires one eligible Super Admin and one eligible CEO. Rejection and history follow the selected module's flow.

---

## 4. PURCHASE ORDER (PO) FLOW

**Target workflow for implementation:** Use the normal PR review rules in section 2. Admin prepares a PO from a PR in `For Purchase`, or an approved SR eligible for a Purchase Order. The PO starts at Admin review because Admin prepares it. Source-request approval does not automatically approve the PO; the PO requires its own review round and amount-based final approval.

```text
PR: For Purchase / eligible SR: Approved
                   |
                   v
Admin creates PO as Draft
Complete supplier, items/services, quantities, prices,
delivery details and payment terms
                   | submit
                   v
For Admin Review
All assigned Admins approve (exclude PO preparer)
                   |
                   v
Check full PO total in PHP
          +--------+------------------+
          |                           |
Below PHP 100,000              PHP 100,000 or more
          |                           |
          v                           v
Senior Project Engineer       Super Admin/CEO
review group                  final review group
Senior Project Engineer: all assigned approve; final stage: one SA + one CEO
          |                           |
          +-------------+-------------+
                        | approved
                        v
                     Approved
                        |
                        v
Admin places order with supplier and records order details
                        |
                        v
Original requester/assigned receiving Engineer records quantities
                        |
                        v
Receiver uploads receipt; Admin verifies against PO lines
All ordered quantities received / services accepted?
          +-------------+-------------+
          | no                        | yes
          v                           v
Partial Received                 Completed
Record remaining deliveries      Complete linked source fulfillment
until all lines are received     when all required work is fulfilled

Any active stage rejects -> Rejected + reason -> notify preparer
-> preparer edits and resubmits -> new round from Admin review.
```

**Shared PR-style rules for the target PO, SR and CR flows:**

- Only assigned reviewers in the active stage may act. Exclude the requester/preparer from every group. Every assigned Engineer, Admin and Senior Project Engineer must approve in their applicable group. The final Super Admin/CEO stage requires one eligible Super Admin and one eligible CEO approval, in either order; exclude the owner and block for authorized replacement if either role has no eligible approver.
- After Admin review, totals **below ₱100,000** go to Senior Project Engineers; totals **at or above ₱100,000** go to the Super Admin/CEO final group. These are alternative final stages. Use the full document total, not one installment.
- Rejection records a reason and notifies the requester/preparer. Resubmission starts at the same first applicable stage, recalculates the total and creates a new review round. Invalidate prior approvals while retaining their history.
- Drafts cannot be approved or fulfilled. Changes to submitted scope, supplier/payee, quantities, prices or payment terms require a fresh review round. Flag an empty required reviewer group for assignment rather than silently advancing.
- `On Hold`, where supported, pauses processing separately from rejection. Authorized resolution resumes the pending stage if details are unchanged; revised details require resubmission. Hold does not permit ordering, payment or release.
- Notify active reviewers on submission/stage advancement, requester/preparer on rejection/final approval, and responsible staff on fulfillment handoff. Extend the shared Reviews tab in section 3 to PO, SR and CR during implementation; it currently aggregates only PR and PCR.

**Agreed receipt responsibilities:** PO receiver uploads the receipt and Admin verifies it against ordered lines. Require a receipt for each partial delivery. SR requester uploads the receipt with service completion confirmation for Admin verification; CR disbursement Admin uploads a signed receipt for each release, followed by requester confirmation.

**Status and role mapping:** The diagrams describe target business stages, not statuses already supported by every module. Map the review stages and `Rejected` to each module's schema during implementation. The current `senior_project_manager` role and stored `For Senior Project Manager Review` status represent **Senior Project Engineer**. Keep PR and PCR unchanged, including PCR's own threshold boundary and requester-role exceptions. PR accreditation and bypass are separate flows; do not automatically copy them as shortcuts into these modules.

**Implementation coverage:** [Workflow engine](backend/services/requestWorkflow.js), [workflow routes](backend/routes/requestWorkflows.js) and [legacy endpoint guards](backend/middleware/requestWorkflowGuard.js) now enforce separate PO rounds, all-member Admin/Senior Project Engineer review, one eligible Super Admin plus one eligible CEO in the final stage, preparer exclusion, rejection/correction and hold/resume. PO receipt events require private evidence and Admin verification before line quantities advance. Approval no longer uses the legacy endpoint that prematurely completes the PR. Schema preparation adds receiving fields and merges status values. See [implementation/migration notes](docs/PO_SR_CR_IMPLEMENTATION.md) for local migration results and the orphaned PO repair exception.

---

## 5. USER ROLES & PERMISSIONS MATRIX

```
┌──────────────────────────────┬──────────┬───────┬────────────────────┐
│           FEATURE            │ Engineer │ Admin │ Other eligible roles│
├──────────────────────────────┼──────────┼───────┼────────────────────┤
│ Create/submit Petty Cash      │    ✓     │   ✓   │         ✓          │
│ Review assigned request stage │    ✓     │   ✓   │         ✓          │
│ Release approved Petty Cash   │    ✗     │   ✓   │ Admin/SA/CEO       │
│ Confirm own cash receipt      │    ✓     │   ✓   │         ✓          │
│ Submit own liquidation        │    ✓     │   ✓   │         ✓          │
│ Review/close liquidation      │    ✗     │   ✓   │ Admin/SA/CEO       │
└──────────────────────────────┴──────────┴───────┴────────────────────┘

This is a focused Petty Cash permission summary, not a complete system-wide role matrix. PR, PO, supplier, inventory and administrative permissions are enforced by their own routes and can differ by operation.
```

---

## 6. DATABASE ENTITY RELATIONSHIP (Simplified)

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   employees     │       │purchase_requests│       │ purchase_orders │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ employee_no     │       │ pr_number       │       │ po_number       │
│ first_name      │       │ requested_by    │◄──────│ purchase_req_id │
│ last_name       │◄──────│ (FK)            │       │ supplier_id     │
│ role            │       │ status          │       │ prepared_by (FK)│
│ is_active       │       │ approved_by(FK) │◄──────┤ status          │
└─────────────────┘       │ total_amount    │       │ total_amount    │
         │                └─────────────────┘       └─────────────────┘
         │                         │
         │                         │
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│   suppliers     │       │purchase_request_│
├─────────────────┤       │    items        │
│ id (PK)         │       ├─────────────────┤
│ supplier_code   │       │ id (PK)         │
│ supplier_name   │       │ pr_id (FK)      │
│ contact_person  │       │ item_id (FK)    │
│ email, phone    │       │ quantity        │
└─────────────────┘       │ unit_price      │
         │                │ status          │
         │                └─────────────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│  supplier_items │       │     items       │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ supplier_id(FK) │       │ item_code       │
│ item_id (FK)    │       │ item_name       │
│ price           │       │ category_id(FK) │
│ lead_time_days  │       │ unit            │
│ is_preferred    │       └─────────────────┘
└─────────────────┘
```

---

Petty Cash uses the shared `cash_requests` parent record (`request_kind = 'petty_cash'`) plus `petty_cash_request_details` and `petty_cash_request_reviews`. Liquidation data is stored in `petty_cash_liquidations`, `petty_cash_liquidation_submissions`, `petty_cash_liquidation_expenses`, and `petty_cash_liquidation_receipts`. Review history is round- and stage-specific. Receipt files are stored privately and served through an authorized endpoint.

---

## 7. NOTIFICATION FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                     TRIGGER EVENTS                          │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ PR/PCR       │ │ Stage        │ │ PR/PCR       │ │ PO / PCR     │
│ Submitted    │ │ Approved     │ │ Rejected     │ │ event        │
│ ──────────── │ │ ──────────── │ │ ──────────── │ │ ──────────── │
│ To: Assigned │ │ To: Next     │ │ To: Requester│ │ To: Relevant │
│ reviewers    │ │ reviewers    │ │ (reason)     │ │ users        │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│              notifications TABLE (Database)                 │
│  - recipient_id  - title  - message  - type  - is_read      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              SOCKET.IO (Real-time Push)                     │
│                    OR                                       │
│              API Polling (Fallback)                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   USER NOTIFICATION BELL                    │
│              (Frontend Component)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. SERVICE REQUEST (SR) FLOW

**Target workflow for implementation:** Use the normal PR flow in section 2, including its requester-based entry stage. Complete the service scope, supplier quotation, full cost and payment schedules before submission. Admin may help obtain/enter quotations during preparation; preparation does not count as review approval.

```text
Requester creates SR as Draft
Complete scope, supplier/contractor, quotation, quantity,
price, project, date needed and payment schedules
                   | submit
                   v
Select entry stage using requester role (table below)
                   |
Engineer entry -> For Engineer Review -> For Admin Review
Admin entry ---------------------------> For Admin Review
                                              | all approve
                                              v
                                   Check full SR total in PHP
                                   |                        |
                            Below PHP 100,000       PHP 100,000 or more
                                   |                        |
                                   v                        v
                          Senior Project Engineer   Super Admin/CEO
                          review group              final review group
Other supported requester roles --------------------------->|
                                   |                        |
                                   +------------+-----------+
                                                | required approvals complete
                                                v
                                             Approved
                                                |
                                                v
Admin issues service/job order to supplier/contractor
and creates the applicable Purchase Order, Payment Request
or Payment Order, retaining source and payment schedules
                                                |
                                                v
Supplier performs service; requester verifies fulfillment
                                                |
                                                v
Original requester confirms completed service and uploads receipt
Admin verifies receipt against approved scope -> Received
Payment follows approved terms and disbursement schedules

Any active stage rejects -> Rejected + reason -> notify requester
-> original requester edits and resubmits
-> new round from the same requester-based entry stage.
```

| Requester role (section 2 reference) | First review stage | Remaining approval path |
| --- | --- | --- |
| Engineer | Engineer group | Admin group, then amount-based final group |
| Admin | Admin group | Amount-based final group |
| Other supported requester roles | Super Admin/CEO final group | Final group approval; exclude requester |

Engineer/Admin/Senior Project Engineer groups require every assigned approval; the final stage requires one eligible Super Admin and one eligible CEO approval, in either order. Apply the shared rules in section 4. `Approved` permits ordering/payment processing; it does not establish service acceptance. `Received` requires actual service fulfillment and requester confirmation. Payment may occur before or after acceptance according to approved terms and is tracked separately.

Require a receipt for each partial delivery/release. PO receiving evidence is uploaded by the original requester or assigned receiving Engineer and verified by Admin; SR evidence is uploaded by the original requester with service completion confirmation and verified by Admin. CR release uses a signed receipt uploaded by the authorized disbursement Admin, followed by the original requester's cash receipt confirmation.

**Amount basis:** Use the full quoted service total, not an installment. The current form calculates `amount × quantity` for `payment_request` and uses amount-only `payment_order`. Normalize that full total consistently across approval, schedules and downstream documents before implementing the threshold.

**Implementation coverage:** SR submission, group reviews, amount routing, rejection/correction and final approval are enforced by the shared workflow engine. The owner can correct Draft scope, unit price, quantity, supplier and reconciled schedules. Original-requester service confirmation requires private receipt evidence; Admin verification advances acceptance to Received. Payment-document creation cannot establish acceptance. The workflow screen and shared Reviews tab expose assigned stages/history. See [implementation notes](docs/PO_SR_CR_IMPLEMENTATION.md) for source/payment compatibility and deployment checks.

---

## 9. CASH REQUEST (CR) FLOW

**Target workflow for implementation:** Ordinary Cash Requests follow the normal PR flow in section 2, with the same requester entry stages shown in section 8's table. Keep their payment, actual cash release and requester receipt steps. Petty Cash remains the separate flow in section 10.

```text
Requester creates CR as Draft
Complete purpose, payee, amount/quantity, project,
date needed, payment type and payment schedules
                   | submit
                   v
Select entry stage using requester role
                   |
Engineer entry -> For Engineer Review -> For Admin Review
Admin entry ---------------------------> For Admin Review
                                              | all approve
                                              v
                                   Check full CR total in PHP
                                   |                        |
                            Below PHP 100,000       PHP 100,000 or more
                                   |                        |
                                   v                        v
                          Senior Project Engineer   Super Admin/CEO
                          review group              final review group
Other supported requester roles --------------------------->|
                                   |                        |
                                   +------------+-----------+
                                                | required approvals complete
                                                v
                                             Approved
                                                |
                                                v
Admin creates Payment Request or Payment Order by cr_type
Retain source CR and approved payment schedules
                                                |
                                                v
Authorized disbursement Admin records release/uploads signed receipt
Record actual release amount, date and payee
                                                |
                                                v
Original requester confirms actual cash receipt -> Received

Any active stage rejects -> Rejected + reason -> notify requester
-> original requester edits and resubmits
-> new round from the same requester-based entry stage.
On Hold pauses processing; resolve under section 4's shared rules.
```

Engineer requesters follow Engineer → Admin → amount-based final review. Admin requesters start at Admin review. Other supported requester roles enter the Super Admin/CEO final group directly, as in section 2. Engineer/Admin/Senior Project Engineer groups require every assigned approval; the final stage requires one eligible Super Admin and one eligible CEO approval, in either order. Exclude the requester from all stages. Apply the shared rules in section 4. Urgency/date needed affects scheduling but does not bypass reviews. Remove the old three-day shortcut, Department Head route and ₱1,000 resubmission shortcut.

Require a signed receipt for each partial cash release; creating a payment document or uploading a receipt alone does not replace actual release and requester confirmation.

**Amount and payment handoff:** Use the full cash total for approval, not one scheduled release. The current form calculates `amount × quantity` for `payment_request` and uses amount-only `payment_order`; normalize this total across reviews, schedules and payment documents. Keep `Approved` as the downstream handoff, followed by `Payment Request Created` or `Payment Order Created`. Creating a payment document does not prove release. Receipt confirmation requires a recorded actual release and ends at `Received`; the earlier diagram's `Closed` state is not an implemented ordinary CR status. Finance means authorized disbursement staff, not a new employee role. Petty cash liquidation remains in section 10.

**Implementation coverage:** Ordinary CRs now use the shared role-based review rounds and full-total amount routing, with one eligible Super Admin and one eligible CEO at final review. Legacy Department Head and 1,000-peso resubmission paths cannot bypass the new workflow. Admin records signed-receipt release events with over-release and duplicate-event protection; the original requester confirms each actual release. Linked payment processing requires current source approval. Existing releases/history are retained during individually reviewed migration. Petty Cash endpoints retain their own flow. See [implementation notes](docs/PO_SR_CR_IMPLEMENTATION.md).

---

## 10. PETTY CASH REQUEST (PCR) FLOW

Petty Cash uses sequential reviewer groups. CEO requesters go through Engineers, Admins, then Senior Project Engineers. Senior Project Engineer requesters go through Engineers, Admins, then CEOs. Other requesters retain the amount-based final review. After final approval, the request uses its own cash release, receipt confirmation, and liquidation steps.

```text
Engineer, CEO, or Senior Project Engineer submits PCR
          │
          ▼
     Engineer review group
       all must approve
          │
          ▼
       Admin review group
       all must approve
          │
          ▼
       Check total amount
       ┌───────┴─────────┐
       │                 │
   ≤ ₱100,000         > ₱100,000
       │                 │
       ▼                 ▼
Senior Project       CEO approval
Engineer approval        │
       └────────┬────────┘
                │ approved
                ▼
             Approved
                │
       Authorized staff records
         cash release/payee
                │
                ▼
       Requester confirms receipt
                │
                ▼
 Submit itemized expenses and receipts;
       return unused cash to Finance
                │
                ▼
       Finance reconciles and closes

Admin and Super Admin requesters start at Admin review. CEO and Senior Project
Engineer requesters start at Engineer review. At any approval stage, a rejection
sets status to Rejected; the requester can edit and resubmit to start a new
review round. Every assigned reviewer in a group must approve before the
request advances, and requesters cannot review their own requests.
```

**Current application coverage:** CEO and Senior Project Engineer requests use the role-specific review paths above. Other requesters use the existing amount-based final review: exactly ₱100,000 routes to the Senior Project Engineer; larger amounts route to CEO. Cash release, requester receipt confirmation, itemized liquidation with private receipt uploads, Finance return for correction, verified cash return, and balanced closeout are also implemented. `For Senior Project Manager Review` remains the legacy database status string; the interface displays **For Senior Project Engineer Review**, and the `senior_project_manager` employee role key represents that role. Finance closeout requires actual expenses plus the verified cash return to equal the release amount exactly to the cent. Requests submitted before this route change retain their existing assigned review stages.

---
## Color Coding for Drawing (Optional)

| Component | Suggested Color |
|-----------|-----------------|
| User Roles | Blue |
| Status/Decisions | Yellow/Orange |
| Rejection/Error | Red |
| Success/Approval | Green |
| Database Tables | Gray |
| Flow Arrows | Black |
| Notifications | Purple |

---

## Tools to Draw This

1. **draw.io** (diagrams.net) - Free, web-based
2. **Lucidchart** - Professional, paid
3. **Miro** - Collaborative whiteboard
4. **Excalidraw** - Hand-drawn style
5. **Figma** - Design tool with flowchart plugins
6. **Whimsical** - Quick flowcharts
7. **Paper + Pen** - Always works!

