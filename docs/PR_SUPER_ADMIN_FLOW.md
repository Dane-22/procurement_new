# Purchase Requests (PR) — Super Admin Flow

This document describes how Purchase Requests work **from the Super Admin perspective** in this procurement system, including statuses, database tables, and the API endpoints involved.

## Overview

Super Admin participates in the PR workflow at the **final approval stage** (after Procurement review).

Super Admin can:

- **Approve** a PR (final approval)
- **Hold** a PR (pause and decide later)
- **Reject** a PR (send back into Procurement review)

## PR Statuses (as stored in DB)

PR status is stored in:

- Table: `purchase_requests`
- Column: `status`

Status values relevant to Super Admin:

- **`For Super Admin Final Approval`**
  - PR has been reviewed by Procurement and is awaiting Super Admin final decision.

- **`On Hold`**
  - PR has been placed on hold by Super Admin.
  - Still considered pending Super Admin final decision.

- **`For Purchase`**
  - PR is fully approved and ready for purchasing / PO creation.

- **`For Procurement Review`**
  - PR was rejected by Super Admin and returned to Procurement for re-review.

## Super Admin Decision Rules

### Allowed current statuses

Super Admin can only decide when the PR is currently:

- `For Super Admin Final Approval`
- `On Hold`

If the PR is in other statuses, the API will reject the action.

### Allowed actions

Super Admin final decision is done via a dedicated endpoint:

- `status = 'approved'` → PR status becomes **`For Purchase`**
- `status = 'hold'` → PR status becomes **`On Hold`**
- `status = 'rejected'` → PR status becomes **`For Procurement Review`**

## DB Tables Involved

### 1) `purchase_requests`

Core PR record.

Common fields used by Super Admin flow:

- `id`
- `pr_number`
- `status`
- `requested_by`
- `approved_by`
- `approved_at`
- `remarks`
- `created_at`
- `updated_at`

### 2) `purchase_request_items`

Line items for the PR.

### 3) `pr_item_rejection_remarks`

Used when Super Admin rejects a PR with per-item remarks.

The API stores item-level remarks into this table when:

- Super Admin action: `status = 'rejected'`
- Request includes `item_remarks` entries

## API Endpoints (backend)

The route file is:

- `backend/routes/purchaseRequests.js`

### 1) List PRs

- **Method:** `GET`
- **Path:** `/purchase-requests`
- **Auth:** required

Super Admin UI typically filters locally for “PRs for Approval”:

- `status === 'For Super Admin Final Approval'`
- `status includes 'hold'` (e.g. `On Hold`)

### 2) Get PR details

- **Method:** `GET`
- **Path:** `/purchase-requests/:id`
- **Auth:** required

### 3) Super Admin final decision (approve / hold / reject)

- **Method:** `PUT`
- **Path:** `/purchase-requests/:id/super-admin-first-approve`
- **Auth:** required
- **Role:** `super_admin`

Request body:

```json
{
  "status": "approved",
  "remarks": "optional remarks",
  "item_remarks": [
    { "item_id": 123, "remark": "optional remark" }
  ]
}
```

Notes:

- `status` allowed values: `approved`, `hold`, `rejected`
- If `status = 'rejected'` and `item_remarks` is provided, the backend writes entries to `pr_item_rejection_remarks`.

### 4) Procurement review endpoint (context)

Not a Super Admin endpoint, but it is the step before Super Admin final approval:

- **Method:** `PUT`
- **Path:** `/purchase-requests/:id/procurement-approve`

When Procurement approves, PR moves to:

- `For Super Admin Final Approval`

## Notifications

Super Admin decision triggers notifications:

- If **approved**:
  - Engineer is notified: `PR Fully Approved`
  - Admins are notified: `PR Ready for PO Creation`

- If **hold**:
  - Engineer is notified: `PR On Hold`

- If **rejected**:
  - Engineer is notified: `PR Rejected`

The API also emits a realtime event:

- `pr_status_changed`

## Recommended Super Admin UI Logic

### “PRs for Approval” list

Show PRs where:

- status is `For Super Admin Final Approval`, OR
- status contains `hold` (covers `On Hold`)

### Actions

For each PR in the approval list:

- **Approve** → `PUT /purchase-requests/:id/super-admin-first-approve` with `{ status: 'approved', remarks }`
- **Hold** → same endpoint with `{ status: 'hold', remarks }`
- **Reject** → same endpoint with `{ status: 'rejected', remarks, item_remarks }`

## Example Flow

1. Engineer submits PR → PR goes through Procurement review
2. Procurement approves → PR status becomes `For Super Admin Final Approval`
3. Super Admin clicks **Hold** → PR status becomes `On Hold`
4. Super Admin later clicks **Approve** → PR status becomes `For Purchase`
5. Admin can create PO from PR (separate flow)
