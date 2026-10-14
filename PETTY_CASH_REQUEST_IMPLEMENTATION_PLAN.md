# Petty Cash Request — Implementation Plan

**Status:** Local implementation includes PR-style approvals, cash release and receipt, itemized expense liquidation with private receipt uploads, and Finance reconciliation and closure.
**Reference:** `825310084_28289452940696244_227531611823688286_n.jpg` and the target Cash Request flow in `system-flowchart.md`. This plan complements `CASH_REQUEST_FLOW_IMPLEMENTATION_PLAN.md`; it does not authorize that plan either.

**Template finding:** The sample uses the same six-column, company-header, item-grid, total, and signature-block layout as `PURCHASE REQUEST- FINAL-2026.xlsx`. The implementation fills the backend copy of that PR workbook with Petty Cash labels and fields. The existing `backend/templates/Cash Request.xlsx` has different merged cells around the project and payment-basis row, so it could not be used unchanged for the pictured form.

## 1. What the sample requires

The sample is a **Petty Cash Request (PCR)** for a ₱15,000 cash advance. Its payee is a person, Junell Tadina, rather than a supplier. It shows a project and address, prepared/needed dates, one priced line (`1 × ₱15,000 = ₱15,000`) and three unpriced purpose details (coarse sand, gravel 3/4, diesels). It ends with a grand total and Prepared by / Received by names and signatures.

| Sample field | Proposed system field or behavior |
| --- | --- |
| “Purchase Request No.” in the header | Use a unique **Petty Cash Request No.** unless the business requires a linked PR number. Do not silently use a PR number for a new PCR. |
| Payee and address | Person receiving the advance and their address; do not require a supplier record. Confirm whether requester and payee may differ. |
| Date prepared / date needed | Creation or submission date, and requested release date. Keep date-only display in Asia/Manila. |
| Project / project address | Reuse the existing project selector and address rules. |
| Payment basis: Cash | Fixed display for PCR, unless other payment methods are requested. |
| Quantity, unit, description, unit cost, amount | Store priced line data with an amount that reconciles to the grand total. |
| Coarse sand, gravel 3/4, diesels | Store as separate purpose/detail lines or a clearly labeled narrative. These rows have no prices in the sample; do not count them as additional amounts. |
| Prepared by / Received by | Derive Prepared by from the requester. Capture the actual recipient and receipt event; show a signature only when one has been recorded. The names in the sample are examples, not defaults. |

## 2. Current project fit

- `CashRequests.jsx` and `backend/routes/cashRequests.js` currently create a single-amount Cash Request with one quantity/unit/description, a supplier-oriented payee, required payment schedules, and `cr_type` of `payment_request` or `payment_order`.
- `backend/routes/cashRequests.js` exports an existing `Cash Request.xlsx` template. The checked-in backend template already resembles the PR layout and bears a Petty Cash Request title, but its labels/signature rows differ from the pictured form. Its export writes one priced line, then payment terms and schedules, and contains hardcoded reviewer names. It does not yet represent the pictured PCR accurately.
- `backend/routes/purchaseRequests.js` already fills the matching PR workbook with header fields, item rows, a total, and signatories. Its export logic is the practical starting point for the PCR workbook mapping; verify actual merged cells and row numbers in the PCR template before reusing coordinates.
- Ordinary approved Cash Requests can feed Payment Requests or Payment Orders. Petty Cash uses direct release, receipt confirmation, then expense liquidation and Finance closeout.
- The target Engineer → Admin → Senior Project Engineer below ₱100,000 / Super Admin at ₱100,000 or more flow is implemented for Petty Cash only. Ordinary Cash Requests still need the separate approval overhaul.

## 3. Proposed product shape for discussion

Add **Petty Cash Request** as a distinct request kind in the Cash Requests area, with its own Create, list filter, detail/preview, and export. Prefer a shared approval engine and audit trail with ordinary Cash Requests, while keeping PCR-specific payee, detail lines, release, and liquidation fields separate. Do not overload `cr_type`, which already means the downstream Payment Request/Payment Order route.

The requester enters the person to receive cash, project, date needed, purpose, amount, and optional detail lines. A clear total is shown before submission. After approval, an authorized cashier/Finance actor records the amount released and the requester confirms receipt. The requester then submits actual expense lines with receipt files and reports unused cash returned. Finance verifies the return and closes only when expenses plus returned cash equal the released amount.

Keep the sample as a **print/export layout reference**, not as a source of fixed names, amounts, or signatures. Preserve a historical snapshot of the payee and project address so later profile edits do not rewrite an issued form.

## 4. Decisions needed before implementation

1. **Relationship to Cash Requests:** Is PCR a subtype of the existing CR, or a separate record and navigation item? The recommended subtype approach shares approval history while keeping a distinct form and number series. Confirm whether PCR should appear in the current Cash Requests list.
2. **Approval route:** Should PCR use the target CR approval flow and ₱100,000 threshold, or a petty-cash-specific limit and reviewers? Is there a maximum amount per PCR or per employee?
3. **Payee and receipt:** Must the payee be an employee, can they be another person, and may the requester receive their own cash? Who records release, who signs/acknowledges receipt, and are electronic signatures required or is typed acknowledgement sufficient?
4. **Line detail:** Is one priced advance line plus unpriced purpose notes correct, as pictured? Or must each material/expense have its own quantity, unit cost, and amount that sums to the total?
5. **Source number:** Replace the sample’s “Purchase Request No.” with a PCR number, or link to an existing PR? If linked, is the PR mandatory and does it affect the approval route?
6. **Release route:** Should an approved PCR generate a Payment Request, Payment Order, Disbursement Voucher, or a direct petty cash release record? Prevent a second payment route for the same approved amount.
7. **Payment schedule:** Is the existing mandatory schedule appropriate for PCR, or should date needed be the only planned cash date?
8. **After receipt — decided:** Expense liquidation is required. Each expense line needs receipt evidence; the requester reports unused cash and a return reference; Finance verifies the cash physically returned. Finance closes the request only when expenses plus verified cash returned match the released amount. Partial releases and multiple disbursements are not supported.
9. **Form and signing:** Confirm the few differences from the existing PR-style workbook: Payee versus Supplier, PCR number versus the pictured PR number, Payment Basis: Cash, and the Prepared by / Received by block. Confirm signatories, signature method, and whether to deliver Excel, PDF, or both. The sample’s “Received by” name appears on an otherwise unsigned form; distinguish an intended recipient from confirmed receipt.
10. **Rollout:** Web only or mobile too? Should existing Cash Requests ever be reclassified as PCRs, or should the new kind apply only to new records?

## 5. Implementation sequence after decisions are agreed

### A. Data and rules

- Inspect the live database schema and existing records; write an additive migration for the approved PCR model. Likely additions: `request_kind`, payee/recipient snapshot, PCR number or number series, detail lines with explicit priced/unpriced type, and release/receipt/liquidation records if those stages are approved.
- Define status transitions, allowed roles, rejection/resubmission, audit events, amount checks, and approval routing in one contract shared with the CR flow plan. Keep historical decisions when editing and resubmitting.
- Validate positive amounts, total reconciliation, project eligibility, dates, payee identity, and prevention of duplicate release or downstream payment. Decide whether amount changes restart approval.

### B. Backend

- Add authenticated create/list/detail/update/submit/review endpoints or extend CR endpoints with a validated `request_kind`; scope access to requester, assigned reviewers, and authorized cash handlers.
- Save the header and lines in one transaction. Lock and check status on approvals, release, receipt, and close actions. Store who acted, when, amount, and evidence references.
- Reuse `backend/templates/Cash Request.xlsx` as the PCR export base and the PR export's field/item/total mapping pattern. Correct PCR-specific labels and cell positions to match the sample, populate current record values only, and remove hardcoded people. Keep an ordinary CR export if that document type remains in use.
- Connect notifications, audit logs, dashboard counts, and reports to the agreed lifecycle.

### C. Web interface

- Add Create Petty Cash Request with payee, project, dates, amount, item/purpose details, and a running total. Show validation before submit and preserve draft/edit behavior.
- Add PCR list/filter and detail/preview with approval history, printable form, release status, receipt acknowledgement, and liquidation controls if approved.
- Show actions only to authorized roles and make returned requests editable/resubmittable. Align wording and statuses across the form, approval queue, exports, and reports.

### D. Verification and rollout

- Test one priced line plus unpriced details (the sample), multiple priced lines if allowed, exact total, date display, missing payee, unauthorized access, rejection/resubmission, and the agreed amount threshold.
- Test approved → released → received → liquidated/closed, including duplicate-action and concurrent-action protection. Confirm PCR cannot accidentally create both a direct release and a Payment Request/Order.
- Compare the generated form visually with both the sample image and the existing PR-style workbook using realistic and blank data; check merged cells, page fit, signatures, and the total. Then rehearse migration on a restored database before rollout.

## 6. Follow-up decisions

The local implementation records a distinct PCR kind and number, payee, priced/unpriced detail lines, assigned reviewer decisions across resubmission rounds, direct full-amount release by Admin/Super Admin/CEO, and requester confirmation of receipt. A non-Admin requester goes through all active Engineers, then all active Admins; an Admin requester begins with the other active Admins. Below ₱100,000, all active Senior Project Engineers give final approval; at ₱100,000 or above, all active Super Admins give final approval. A rejection returns the request for edit and a fresh review round. After receipt, the requester submits itemized actual expenses with a receipt attached to each line and reports unused cash returned. Finance verifies the return and closes the request only when verified returned cash plus actual expenses equal the released amount. Finance may return a submission for correction, which starts a new preserved submission round. Missing reviewer groups block approval. The local database currently has no active Senior Project Engineer (stored under the legacy `senior_project_manager` role key), so that role must be assigned before sub-₱100,000 requests can reach final approval. Ordinary Cash Requests still use their existing flow.
