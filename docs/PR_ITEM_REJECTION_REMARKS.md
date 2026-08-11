# PR Rejection — Per-Item Remarks (Item-Level Rejection Notes)

This document explains the **per-item rejection remarks** feature used when a Purchase Request (PR) is rejected (or sent back) and individual PR line items need their own remarks.

## What it is

When Procurement or Super Admin rejects a PR (or sends it back), they can optionally attach **item-level remarks** per PR item line.

These remarks are stored separately from the PR header-level reason (`remarks` / `rejection_reason`).

## Database

### Table: `pr_item_rejection_remarks`

This table stores per-item rejection remarks for a PR.

**SQL definition (see `dbschema/pr_item_rejection_remarks.sql`):**

- `id` INT PK AUTO_INCREMENT
- `purchase_request_id` INT NOT NULL (FK → `purchase_requests.id`, `ON DELETE CASCADE`)
- `purchase_request_item_id` INT NOT NULL (FK → `purchase_request_items.id`, `ON DELETE CASCADE`)
- `item_id` INT NOT NULL (FK → `items.id`)
- `remark` TEXT NOT NULL
- `created_by` INT NULL (FK → `employees.id`)
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Relationships

- A PR (`purchase_requests`) can have many per-item remarks.
- A PR item line (`purchase_request_items`) can have many remarks over time.
- `purchase_request_item_id` is the PR item line id (not the catalog item id).

## API Endpoints that write per-item remarks

Per-item remarks are written via the **same approval endpoints** used for rejecting PRs.

### 1) Super Admin decision endpoint

- **Method:** `PUT`
- **Path:** `/purchase-requests/:id/super-admin-first-approve`
- **Role:** `super_admin`

**Request body fields used:**

- `status` (must be `'rejected'` to trigger per-item inserts)
- `remarks` (optional header-level remarks)
- `item_remarks` (optional array of per-item remarks)

Example request (Super Admin reject with per-item remarks):

```json
{
  "status": "rejected",
  "remarks": "Please revise the specs",
  "item_remarks": [
    { "item_id": 101, "remark": "Need correct size" },
    { "item_id": 102, "remark": "Provide updated quotation" }
  ]
}
```

**Important:** In this API, `item_remarks[*].item_id` is expected to be the **PR item line id** (`purchase_request_items.id`).

Backend behavior (summary from `backend/routes/purchaseRequests.js`):

- Validates PR current status is `For Super Admin Final Approval` or `On Hold`.
- For `status = 'rejected'`:
  - Sets PR status to `For Procurement Review`.
  - Inserts each per-item remark into `pr_item_rejection_remarks`.

### 2) Procurement decision endpoint

- **Method:** `PUT`
- **Path:** `/purchase-requests/:id/procurement-approve`
- **Role:** `procurement` (and roles allowed by backend)

**Request body fields used:**

- `status` (when rejecting)
- `rejection_reason` (header-level)
- `item_remarks` (optional array of per-item remarks)

Example request (Procurement reject with per-item remarks):

```json
{
  "status": "rejected",
  "rejection_reason": "Missing supplier details",
  "item_remarks": [
    { "item_id": 101, "remark": "No unit price reference" }
  ]
}
```

**Important:** Here too, `item_remarks[*].item_id` is expected to be the **PR item line id** (`purchase_request_items.id`).

Backend behavior:

- Validates PR current status is `For Procurement Review`.
- When rejecting:
  - Sets PR status to `Rejected`.
  - Saves `rejection_reason`.
  - Inserts each per-item remark into `pr_item_rejection_remarks`.

## How the backend ensures the correct catalog `item_id`

In both endpoints, the backend does not trust the client to send the catalog `items.id`.

Instead it:

1. Receives `itemRemark.item_id` (which is the PR item line id)
2. Queries `purchase_request_items` to fetch the real catalog `item_id`
3. Inserts into `pr_item_rejection_remarks` with:
   - `purchase_request_id`
   - `purchase_request_item_id` (PR item line id)
   - `item_id` (catalog item id)
   - `remark`
   - `created_by`

## Reading per-item remarks (API response)

### Get PR details

- **Method:** `GET`
- **Path:** `/purchase-requests/:id`

Behavior:

- Always returns PR and its item lines.
- Additionally fetches per-item remarks from `pr_item_rejection_remarks` **only when**:
  - `pr.status === 'Rejected'` OR
  - `pr.status === 'For Procurement Review'`

Response shape (relevant part):

- The endpoint attaches `rejection_remarks` to each item:

```json
{
  "purchaseRequest": {
    "id": 123,
    "status": "Rejected",
    "items": [
      {
        "id": 101,
        "item_id": 55,
        "item_name": "Sample Item",
        "rejection_remarks": [
          {
            "purchase_request_item_id": 101,
            "item_id": 55,
            "remark": "Need correct size",
            "created_at": "2026-02-20T01:23:45.000Z",
            "created_by_first_name": "...",
            "created_by_last_name": "..."
          }
        ]
      }
    ]
  }
}
```

## Frontend payload behavior (reference)

In the current frontend (`frontend/src/App.jsx`):

- The UI builds `item_remarks` only for items with non-empty remark text.
- It sends:
  - Super Admin reject: `purchaseRequestService.superAdminFirstApprove(id, 'rejected', rejectionReason, itemRemarksArray)`
  - Procurement reject: `purchaseRequestService.procurementApprove(id, 'rejected', rejectionReason, ..., itemRemarksArray)`

Where each element is:

```json
{ "item_id": <purchase_request_item_id>, "remark": "..." }
```

## Notes / Gotchas

- `item_remarks` is **optional**. If omitted or empty, no item-level records are inserted.
- Per-item remarks are only returned by `GET /purchase-requests/:id` when PR status is `Rejected` or `For Procurement Review`.
- `item_remarks[*].item_id` naming is misleading: it is actually the PR item line id (`purchase_request_items.id`).
