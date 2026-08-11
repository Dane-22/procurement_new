# Purchase Request to Disbursement Voucher Workflow

## Overview

This document describes the end-to-end process for creating a Purchase Request (PR) through to generating a Disbursement Voucher (DV). The system supports two distinct paths based on the PR's **Payment Basis**.

---

## Two Workflow Paths

### Path 1: Debt/With Account (Standard Procurement)
```
Engineer creates PR → Procurement Reviews → Super Admin Approves → Admin creates PO → Admin creates DV
```

### Path 2: Non-Debt/Without Account (Direct Payment)
```
Engineer creates PR → Procurement Reviews → Super Admin Approves → Admin creates Payment Request → Admin creates DV
```

---

## Step-by-Step Process

### STEP 1: Purchase Request Creation

**Actor:** Engineer  
**System:** Frontend: `PurchaseRequests.jsx` | API: `POST /api/purchase-requests`  
**Backend:** `backend/routes/purchaseRequests.js`

#### Actions:
1. Engineer fills out PR form with:
   - Purpose and remarks
   - Items (item, quantity, estimated unit price)
   - Date needed
   - Project and project address
   - Order number
   - **Payment Basis** selection (crucial - determines workflow path)

2. Payment Basis Options:
   - **"Debt / With Account"** → Goes through Purchase Order path
   - **"Non-Debt / Without Account"** → Goes through Payment Request path

3. Save options:
   - **Save as Draft** → Status: `Draft`
   - **Submit** → Status: `For Procurement Review`

#### Important Rules:
- For **Debt PRs**: Payment schedules are **required** and total must match PR item totals
- PR Number format: `INITIALS-YYYY-MM-###` (e.g., `PCT-2026-04-001`)
- System notifies Procurement Officers when a non-draft PR is created

---

### STEP 2: Procurement Review

**Actor:** Procurement Officer  
**System:** Frontend: `Approvals.jsx` (PR tab) | API: `PUT /api/purchase-requests/:id/procurement-approve`  
**Backend:** `backend/routes/purchaseRequests.js`

#### Actions:
1. Procurement reviews PR details and items
2. Procurement can:
   - **Approve** → PR Status becomes: `For Super Admin Final Approval`
   - **Reject** → PR Status becomes: `Rejected`
   - Add per-item rejection remarks if rejecting

3. When approving, Procurement must:
   - Select/confirm supplier
   - Set final unit prices (may differ from engineer's estimates)
   - Update quantities if needed
   - Ensure payment schedules exist (for debt PRs)

#### System Effects:
- PR total amount recalculated based on final unit prices
- Supplier and supplier address are locked in
- Super Admins are notified for final approval
- Engineer is notified if values were modified

---

### STEP 3: Super Admin Final Approval

**Actor:** Super Admin  
**System:** Frontend: `Approvals.jsx` (PR tab) | API: `PUT /api/purchase-requests/:id/super-admin-first-approve`  
**Backend:** `backend/routes/purchaseRequests.js`

#### Actions:
1. Super Admin reviews PR with Procurement's changes
2. Super Admin can:
   - **Approve** → PR Status becomes: `For Purchase`
   - **Hold** → PR Status becomes: `On Hold`
   - **Reject** → PR Status becomes: `For Procurement Review` (with remarks)

#### System Effects:
- Engineer is notified of final decision
- If approved, Admins are notified that PR is ready for next step
- Real-time status updates emitted to all connected users

---

### STEP 4A: Create Purchase Order (Debt/With Account Path)

**Actor:** Admin  
**System:** Frontend: Purchase Orders module | API: `POST /api/purchase-orders`  
**Backend:** `backend/routes/purchaseOrders.js`

#### Prerequisites:
- PR Status: `For Purchase`
- PR Payment Basis: `debt`
- Payment Terms must be set on PR
- Supplier must be selected

#### Actions:
1. Admin selects approved PR
2. System validates PR meets PO creation requirements
3. Admin fills PO details:
   - Expected delivery date
   - Place of delivery
   - Delivery terms (default: COD)
   - Payment terms (inherited from PR)
   - Notes

4. Save options:
   - **Save as Draft** → Status: `Draft`
   - **Submit** → Status: `Pending Approval`

#### System Effects:
- PR Status automatically updates to: `PO Created`
- PO Number generated: `INITIALS-YYYY-MM-###`
- Super Admins notified for PO approval (if not draft)

---

### STEP 4B: Create Payment Request (Non-Debt/Without Account Path)

**Actor:** Admin  
**System:** API: `POST /api/payment-requests`  
**Backend:** `backend/routes/paymentRequests.js`

#### Prerequisites:
- PR Status: `For Purchase`
- PR Payment Basis: `non_debt`

#### Important Rule:
- **Non-debt PRs CANNOT create Purchase Orders** - they must use Payment Requests
- System blocks PO creation with error: `"PRs without account must use /api/payment-requests endpoint"`

#### Actions:
1. Admin creates Payment Request linked to PR
2. Payment Request status starts as: `Draft`
3. Admin can submit → Status becomes: `Pending` or `For Approval`

#### System Effects:
- PR Status updates to: `Payment Request Created`
- When Payment Request is approved by Super Admin:
  - Payment Request Status: `Approved`
  - PR Status: `Completed`

---

### STEP 5: Create Disbursement Voucher

**Actor:** Admin  
**System:** Frontend: Disbursement Vouchers module | API: `POST /api/disbursement-vouchers`  
**Backend:** `backend/routes/disbursementVouchers.js`

#### DV can be created from:
1. **Purchase Order** (from debt PR path)
2. **Payment Request** (from non-debt PR path)
3. Service Request, Cash Request, or Payment Order

#### Prerequisites:
- Source document must be in appropriate status (usually `Approved`)
- **Payment Schedule must be selected** (schedule_id is required)
- For Payment Requests: must be `Approved` status

#### Actions:
1. Admin selects source document (PO or Payment Request)
2. System fetches available payment schedules
3. Admin selects payment schedule (determines payment date and amount)
4. Admin fills DV details:
   - Particulars (auto-populated based on type)
   - Project
   - Order number
   - Check number (optional)
   - Bank name (optional)
   - Received by (optional)

5. Save options:
   - **Save as Draft** → DV Status: `Draft`
   - **Submit** → DV Status: `Pending`

#### System Effects:
- DV Number generated: `YYYY-MM-###` (e.g., `2026-04-001`)
- DV amount locked to selected schedule amount
- For Payment Request-based DVs: Payment Request status updates to `DV Created`
- System prevents duplicate DVs for same schedule date

---

## Status Reference Guide

### Purchase Request Statuses

| Status | Description | Who Can Act |
|--------|-------------|-------------|
| `Draft` | Saved but not submitted | Engineer (owner) |
| `For Procurement Review` | Pending Procurement review | Procurement Officer |
| `For Super Admin Final Approval` | Procurement approved, needs final sign-off | Super Admin |
| `On Hold` | Paused by Super Admin | Super Admin |
| `Rejected` | Rejected (can be resubmitted) | Engineer (owner) |
| `For Purchase` | Fully approved, ready for PO/Payment Request | Admin |
| `PO Created` | Purchase Order created from PR | Admin |
| `Payment Request Created` | Payment Request created from PR | Admin |
| `Completed` | Fully processed (non-debt path) | System |

### Purchase Order Statuses

| Status | Description | Who Can Act |
|--------|-------------|-------------|
| `Draft` | Saved but not submitted | Admin (creator) |
| `Pending Approval` | Awaiting Super Admin approval | Super Admin |
| `On Hold` | Paused | Super Admin |
| `Approved` | Ready for DV creation | Admin |

### Payment Request Statuses

| Status | Description | Who Can Act |
|--------|-------------|-------------|
| `Draft` | Saved but not submitted | Admin (creator) |
| `Pending` / `For Approval` | Awaiting approval | Super Admin |
| `On Hold` | Paused | Super Admin |
| `Approved` | Ready for DV creation | Admin |
| `DV Created` | DV generated from Payment Request | System |

### Disbursement Voucher Statuses

| Status | Description | Who Can Act |
|--------|-------------|-------------|
| `Draft` | Saved but not submitted | Admin (creator) |
| `Pending` | Awaiting certification | Accounting/Manager |
| `Approved` | Certified, ready for payment | Admin |
| `Paid` | Payment completed | Admin |
| `Cancelled` | Voided | Admin |

---

## Key Business Rules

### Payment Schedules (Debt PRs Only)
- Required for all `debt` payment basis PRs
- Total of all schedules must equal PR total amount
- Each schedule has: payment_date, amount (optional), note (optional)
- No duplicate payment dates allowed
- Used to determine DV payment dates and amounts

### Supplier Selection
- Engineer can suggest supplier during PR creation
- Procurement **must** confirm/select supplier during approval
- Supplier address auto-populated from supplier master data

### Order Number Locking
- Order numbers can be locked to prevent modifications
- If locked, approval actions are blocked until unlocked

### Real-time Updates
- All status changes emit `pr_status_changed` socket event
- Connected users see updates without page refresh

---

## API Endpoint Reference

| Action | Endpoint | Auth Required |
|--------|----------|---------------|
| Create PR | `POST /api/purchase-requests` | Engineer+ |
| Procurement Review | `PUT /api/purchase-requests/:id/procurement-approve` | Procurement |
| Super Admin Approve | `PUT /api/purchase-requests/:id/super-admin-first-approve` | Super Admin |
| Create PO | `POST /api/purchase-orders` | Admin |
| Create Payment Request | `POST /api/payment-requests` | Admin |
| Approve Payment Request | `PUT /api/payment-requests/:id/approve` | Super Admin |
| Create DV | `POST /api/disbursement-vouchers` | Admin |
| Get DV Schedules | `GET /api/disbursement-vouchers/schedules` | Admin+ |

---

## Frontend Component Reference

| Screen | Component Path | Purpose |
|--------|---------------|---------|
| PR List | `src/components/purchase-requests/PurchaseRequests.jsx` | View, create, manage PRs |
| Approvals Dashboard | `src/components/approvals/Approvals.jsx` | Review and approve PRs/POs/DVs |
| PR Service | `src/services/purchaseRequests.js` | API calls for PR operations |
| DV Service | `src/services/disbursementVouchers.js` | API calls for DV operations |

---

## Decision Flowchart

```
ENGINEER creates PR
    ↓
Is Payment Basis "debt" or "non_debt"?
    ↓
┌──────────────────┐    ┌──────────────────┐
│   DEBT (with     │    │  NON-DEBT (no    │
│   account)       │    │   account)       │
└──────────────────┘    └──────────────────┘
    ↓                        ↓
PROCUREMENT reviews      PROCUREMENT reviews
SUPER ADMIN approves     SUPER ADMIN approves
    ↓                        ↓
ADMIN creates PO         ADMIN creates
    ↓                    Payment Request
ADMIN creates DV              ↓
    ↓                    Payment Request
DV from PO               approved by Super Admin
                              ↓
                         ADMIN creates DV
                              ↓
                         DV from Payment Request
```

---

## Common Issues & Solutions

### Issue: Cannot create PO from PR
**Cause:** PR has `non_debt` payment basis  
**Solution:** Use Payment Request endpoint instead (`/api/payment-requests`)

### Issue: DV creation fails - "No payment schedules available"
**Cause:** Source document missing payment schedules  
**Solution:** 
- For PR-based sources: Ensure PR has payment schedules set
- For SR/CR-based sources: Ensure source has payment schedules

### Issue: DV creation fails - "Selected payment schedule is invalid"
**Cause:** Schedule already used by another DV  
**Solution:** Select a different schedule date or cancel existing DV

### Issue: Procurement approval blocked
**Cause:** Order number is locked  
**Solution:** Unlock order number in Order Numbers management

---

## Related Documentation

- `PROCUREMENT_WORKFLOW.md` - Overall procurement process
- `PO_SUPER_ADMIN_FLOW.md` - Purchase Order approval details
- `PR_SUPER_ADMIN_FLOW.md` - PR approval details
- `PR_PAYMENT_SCHEDULE_REMINDERS_PLAN.md` - Payment schedule functionality

---

*Document Version: 1.0*  
*Last Updated: April 2026*  
*System: Procurement Management System*
