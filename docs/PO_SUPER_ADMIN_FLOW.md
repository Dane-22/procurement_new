# Purchase Orders (PO) — Super Admin Flow

This document describes how Purchase Orders work **from the Super Admin perspective** in this procurement system, including the key statuses, database tables, and API endpoints involved.

## Overview

Super Admin is responsible for the **final decision** on Purchase Orders created by Admin.

Super Admin can only:

- **Approve** a PO (place the order)
- **Hold** a PO (pause / return later)

Super Admin **does not reject/cancel** POs in the current logic.

## PO Statuses (as stored in DB)

The PO status is stored in the database in:

- Table: `purchase_orders`
- Column: `status`

Status values relevant to Super Admin:

- **`Draft`**
  - Default status when an Admin creates a PO.
  - Considered “pending approval” for Super Admin.

- **`On Hold`**
  - Set when a Super Admin holds a PO.
  - Still considered “pending approval” for Super Admin.

- **`Ordered`**
  - Set when a Super Admin approves a PO.
  - Considered completed/final for the Super Admin flow.

## Super Admin Decision Rules

### Allowed actions

Super Admin decision is performed through a dedicated endpoint:

- **Approve** (request body status: `approved`) → saves PO status as `Ordered`
- **Hold** (request body status: `hold`) → saves PO status as `On Hold`

### Allowed current statuses

Super Admin can only make a decision when the PO is currently:

- `Draft`
- `On Hold`

If the PO is already `Ordered` (or other statuses), the endpoint will reject the action.

## DB Tables Involved

### 1) `purchase_orders`

Core PO record.

Common fields used by the Super Admin UI/API responses:

- `id`
- `po_number`
- `purchase_request_id`
- `supplier_id`
- `prepared_by`
- `total_amount`
- `po_date`
- `expected_delivery_date`
- `place_of_delivery`
- `project`
- `delivery_term`
- `payment_term`
- `notes`
- `status`
- `created_at`
- `updated_at`

### 2) `purchase_order_items`

Line items for a PO.

Common fields:

- `purchase_order_id`
- `purchase_request_item_id`
- `item_id`
- `quantity`
- `unit_price`
- `total_price`

### 3) `purchase_requests`

Related PR record referenced by `purchase_orders.purchase_request_id`.

Important interaction:

- When a PO is **approved** (PO becomes `Ordered`), the related PR is updated to:
  - `purchase_requests.status = 'Completed'`

### 4) `po_attachments`

Attachments uploaded against a PO.

## API Endpoints (backend)

All endpoints below assume the API is mounted under a prefix such as `/api` in your server. The route file is:

- `backend/routes/purchaseOrders.js`

### 1) List POs

- **Method:** `GET`
- **Path:** `/purchase-orders`
- **Auth:** required

Notes:

- For `engineer`, the backend filters to only their own PRs.
- For Super Admin, this currently returns all POs (no status filter in the API itself).

Super Admin UI should treat these as “POs for Approval”:

- `status === 'Draft'`
- `status includes 'hold'` (e.g. `On Hold`)

### 2) Get PO details (items + attachments)

- **Method:** `GET`
- **Path:** `/purchase-orders/:id`
- **Auth:** required

Returns:

- PO fields
- `items` array (from `purchase_order_items`)
- `attachments` array (from `po_attachments`)

### 3) Super Admin decision (Approve / Hold)

- **Method:** `PUT`
- **Path:** `/purchase-orders/:id/super-admin-approve`
- **Auth:** required
- **Role:** `super_admin`

Request body:

```json
{ "status": "approved" }
```

or

```json
{ "status": "hold" }
```

Behavior:

- If `status = 'approved'`
  - Updates:
    - `purchase_orders.status = 'Ordered'`
  - Also updates related PR:
    - `purchase_requests.status = 'Completed'`

- If `status = 'hold'`
  - Updates:
    - `purchase_orders.status = 'On Hold'`

### 4) Export PO to Excel

- **Method:** `GET`
- **Path:** `/purchase-orders/:id/export`
- **Auth:** required

Returns an Excel file generated using the template:

- `PO 2026.xlsx`

### 5) Attachments

Get PO attachments:

- **Method:** `GET`
- **Path:** `/purchase-orders/:id/attachments`
- **Auth:** required

Upload attachment (admin or super admin):

- **Method:** `POST`
- **Path:** `/purchase-orders/:id/attachments`
- **Auth:** required
- **Role:** `admin` or `super_admin`

Delete attachment:

- **Method:** `DELETE`
- **Path:** `/purchase-orders/:id/attachments/:attachmentId`
- **Auth:** required
- **Role:** `admin` / `super_admin` / uploader

## Notifications

The system notifies Super Admins when:

- A new PO is created by Admin
  - Title: `New PO Pending Approval`

When a PO is approved, the system notifies the engineer who requested the related PR.

## Recommended Super Admin UI Logic

### “POs for Approval” list

Show POs where:

- status is `Draft`, OR
- status contains `hold` (covers `On Hold`)

### Actions

For each PO in the approval list:

- **Approve** → call `PUT /purchase-orders/:id/super-admin-approve` with `{ status: 'approved' }`
- **Hold** → call `PUT /purchase-orders/:id/super-admin-approve` with `{ status: 'hold' }`

## Example Flow

1. Admin creates a PO → DB `purchase_orders.status = 'Draft'`
2. Super Admin opens “POs for Approval” → sees the Draft PO
3. Super Admin clicks **Hold** → DB `purchase_orders.status = 'On Hold'`
4. Super Admin opens “POs for Approval” later → still sees the PO (still pending)
5. Super Admin clicks **Approve** → DB `purchase_orders.status = 'Ordered'`, PR becomes `Completed`
