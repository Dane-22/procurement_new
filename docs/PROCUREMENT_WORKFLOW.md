# Procurement Workflow Documentation

## Overview

The Procurement workflow handles Purchase Requests (PRs) when they reach the **"For Procurement Review"** status. At this stage, procurement officers can either **Approve** (forward to Super Admin) or **Reject** the PR.

**Base URL:** `https://procurement-api.xandree.com/`

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            PROCUREMENT WORKFLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

    Engineer Creates PR
            │
            ▼
    ┌───────────────────┐
    │  PR Status:       │
    │  Pending ────────►│─(Super Admin First Approves)──► For Procurement Review
    └───────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
            ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
            │    REJECT     │       │    HOLD       │       │    APPROVE    │
            │  (with reason)│       │ (on hold)     │       │ (with changes)│
            └───────────────┘       └───────────────┘       └───────────────┘
                    │                       │                       │
                    ▼                       ▼                       ▼
            Status: Rejected         Status: On Hold         Status: For Super
            + item_remarks                                  Admin Final Approval
                    │                                               │
                    │                                               ▼
                    │                                       (Super Admin Final
                    │                                        Approves/Rejects)
                    │                                               │
                    │                       ┌───────────────────────┼───────────────────────┐
                    │                       │                       │                       │
                    │                       ▼                       ▼                       ▼
                    │               ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
                    │               │    HOLD       │       │   REJECT      │       │  FULLY        │
                    │               │               │       │               │       │  APPROVED     │
                    │               └───────────────┘       └───────────────┘       └───────────────┘
                    │                       │                       │                       │
                    ▼                       ▼                       ▼                       ▼
            Engineer gets         Engineer gets         Engineer gets         Engineer gets
            notified            notified            notified            notified
            + per-item          (back to            (reason)            (ready for PO)
            remarks             procurement)
```

---

## Database Schema

### Core Tables

#### 1. `purchase_requests` - Main PR Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK, Auto) | Unique PR ID |
| `pr_number` | VARCHAR(50) | Auto-generated PR number (e.g., MTN-2026-02-002) |
| `requested_by` | INT (FK) | Engineer who created the PR |
| `purpose` | TEXT | Purpose/description of the PR |
| `remarks` | TEXT | General remarks |
| `date_needed` | DATE | Date when items are needed |
| `project` | VARCHAR(100) | Project name |
| `project_address` | VARCHAR(255) | Project location |
| `supplier_id` | INT (FK) | **Selected supplier** (set during procurement approval) |
| `supplier_address` | VARCHAR(255) | Supplier address (auto-populated) |
| `status` | ENUM | **'Draft', 'Pending', 'For Procurement Review', 'For Super Admin Final Approval', 'On Hold', 'For Purchase', 'PO Created', 'Completed', 'Rejected', 'Cancelled'** |
| `approved_by` | INT (FK) | Super Admin who approved |
| `approved_at` | TIMESTAMP | Approval timestamp |
| `rejection_reason` | TEXT | **Procurement rejection reason** |
| `total_amount` | DECIMAL(12,2) | **Calculated total after procurement sets unit costs** |
| `created_at` | TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | Last update time |

#### 2. `purchase_request_items` - PR Items Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK, Auto) | Unique item line ID |
| `purchase_request_id` | INT (FK) | Parent PR ID |
| `item_id` | INT (FK) | Reference to items catalog |
| `quantity` | INT | **Quantity (can be modified by procurement)** |
| `unit_price` | DECIMAL(10,2) | **Unit cost in PHP (set by procurement)** |
| `total_price` | DECIMAL(10,2) | Calculated: quantity × unit_price |
| `unit` | VARCHAR(50) | **Unit of measurement (can be modified)** |
| `remarks` | TEXT | Item-level remarks |
| `status` | ENUM | 'Pending', 'For Purchase', 'Purchased', 'Received' |
| `received_by` | INT (FK) | Who received the item |
| `received_at` | TIMESTAMP | Receipt timestamp |
| `created_at` | TIMESTAMP | Creation time |

#### 3. `pr_item_rejection_remarks` - Per-Item Rejection Remarks

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK, Auto) | Unique remark ID |
| `purchase_request_id` | INT (FK) | Parent PR ID |
| `purchase_request_item_id` | INT (FK) | Specific item line ID |
| `item_id` | INT (FK) | Item catalog reference |
| `remark` | TEXT | **Rejection remark for this specific item** |
| `created_by` | INT (FK) | Who created the remark (procurement officer) |
| `created_at` | TIMESTAMP | Remark creation time |

#### 4. `suppliers` - Supplier Catalog

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK, Auto) | Unique supplier ID |
| `supplier_code` | VARCHAR(50) | Auto-generated code (e.g., SUP123456) |
| `supplier_name` | VARCHAR(255) | **Supplier name (selected during approval)** |
| `contact_person` | VARCHAR(255) | Contact person |
| `email` | VARCHAR(100) | Email address |
| `phone` | VARCHAR(20) | Phone number |
| `address` | TEXT | **Full address (shown on approval form)** |
| `status` | ENUM | 'Active', 'Inactive' |
| `created_at` | TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | Last update time |

---

## API Endpoints

### 1. Get PR Details (for Procurement Review)

**Endpoint:** `GET /api/purchase-requests/:id`

**Authentication:** Required (Bearer token)

**Authorization:** Any authenticated user

**Response:**
```json
{
  "purchaseRequest": {
    "id": 123,
    "pr_number": "MTN-2026-02-002",
    "requested_by": 5,
    "requester_first_name": "Michelle",
    "requester_last_name": "Norial",
    "purpose": "dsa",
    "status": "For Procurement Review",
    "project": "Project A",
    "project_address": "123 Main St",
    "date_needed": "2026-02-28",
    "total_amount": null,
    "supplier_id": null,
    "supplier_name": null,
    "created_at": "2026-02-19T00:00:00.000Z",
    "items": [
      {
        "id": 1,
        "item_id": 10,
        "item_name": "25mm dia. Def bar @ 13.5m G60",
        "item_code": "REBAR-001",
        "quantity": 1,
        "unit": "pcs",
        "unit_price": 0.00,
        "total_price": 0.00,
        "remarks": null,
        "rejection_remarks": []
      },
      {
        "id": 2,
        "item_id": 11,
        "item_name": "25mm dia. Def bar @ 12m G60",
        "item_code": "REBAR-002",
        "quantity": 1,
        "unit": "pcs",
        "unit_price": 0.00,
        "total_price": 0.00,
        "remarks": null,
        "rejection_remarks": []
      }
    ]
  }
}
```

**Notes:**
- Returns all PR details with items
- `rejection_remarks` array populated if PR is rejected or in procurement review
- Unit prices initially 0.00 (set by procurement during approval)

---

### 2. Get Suppliers List

**Endpoint:** `GET /api/suppliers`

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "suppliers": [
    {
      "id": 1,
      "supplier_code": "SUP123456",
      "supplier_name": "ABC Construction Supply",
      "contact_person": "John Doe",
      "phone": "09123456789",
      "email": "abc@example.com",
      "address": "456 Supplier St, Manila",
      "status": "Active",
      "items_count": 15
    }
  ]
}
```

**Notes:**
- Only returns suppliers with `status = 'Active'`
- `items_count` shows how many items this supplier can provide
- Used to populate the supplier dropdown in approval modal

---

### 3. Get Single Supplier Details

**Endpoint:** `GET /api/suppliers/:id`

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "supplier": {
    "id": 1,
    "supplier_code": "SUP123456",
    "supplier_name": "ABC Construction Supply",
    "contact_person": "John Doe",
    "phone": "09123456789",
    "email": "abc@example.com",
    "address": "456 Supplier St, Manila",
    "status": "Active",
    "items": [
      {
        "id": 10,
        "name": "25mm dia. Def bar @ 13.5m G60",
        "unit": "pcs",
        "price": 1500.00,
        "lead_time_days": 7
      }
    ]
  }
}
```

**Notes:**
- Use this to get supplier address when selected in the approval form
- Can also show suggested prices from supplier_items table

---

### 4. Procurement Approve/Reject PR

**Endpoint:** `PUT /api/purchase-requests/:id/procurement-approve`

**Authentication:** Required (Bearer token)

**Authorization:** Requires role: `procurement`, `admin`, or `super_admin`

**Request Body (APPROVE):**
```json
{
  "status": "approved",
  "supplier_id": 1,
  "supplier_address": "456 Supplier St, Manila",
  "items": [
    {
      "id": 1,
      "item_id": 10,
      "item_name": "25mm dia. Def bar @ 13.5m G60",
      "quantity": 1,
      "unit": "pcs",
      "unit_price": 1500.00,
      "item_code": "REBAR-001"
    },
    {
      "id": 2,
      "item_id": 11,
      "item_name": "25mm dia. Def bar @ 12m G60",
      "quantity": 1,
      "unit": "pcs",
      "unit_price": 1400.00,
      "item_code": "REBAR-002"
    }
  ]
}
```

**Request Body (REJECT):**
```json
{
  "status": "rejected",
  "rejection_reason": "Items not available from preferred supplier",
  "item_remarks": [
    {
      "item_id": 1,
      "remark": "This specific rebar size is out of stock"
    },
    {
      "item_id": 2,
      "remark": "Alternative: 12m length available instead"
    }
  ]
}
```

**Response (Success):**
```json
{
  "message": "Purchase request approved successfully",
  "status": "For Super Admin Final Approval",
  "total_amount": 2900.00
}
```

**Business Logic:**

1. **Validation:**
   - Current status must be exactly `'For Procurement Review'`
   - For approval: `supplier_id` is **required**

2. **Approval Process:**
   - Updates `purchase_request_items` table:
     - Sets `unit_price` from request
     - Calculates `total_price = quantity × unit_price`
     - Updates `unit` if changed
   - Updates `purchase_requests` table:
     - Sets `status = 'For Super Admin Final Approval'`
     - Sets `total_amount` (sum of all item total_prices)
     - Sets `supplier_id` and `supplier_address`
   - Tracks changes made (quantity, unit, unit_price) for notifications

3. **Reject Process:**
   - Updates `purchase_requests` table:
     - Sets `status = 'Rejected'`
     - Sets `rejection_reason`
   - Inserts into `pr_item_rejection_remarks` table:
     - Each item remark with `purchase_request_id`, `purchase_request_item_id`, `item_id`, `remark`, `created_by`

4. **Notifications:**
   - **Approve:** Notifies all Super Admins for final approval
   - **Approve with changes:** Also notifies engineer of modifications
   - **Reject:** Notifies engineer with rejection reason

5. **Real-time Updates:**
   - Emits `pr_status_changed` event via Socket.IO

---

### 5. Get PRs for Procurement Review

**Endpoint:** `GET /api/purchase-requests`

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `status=For Procurement Review` - Filter to show only procurement review PRs

**Response:**
```json
{
  "purchaseRequests": [
    {
      "id": 123,
      "pr_number": "MTN-2026-02-002",
      "requested_by": 5,
      "requester_first_name": "Michelle",
      "requester_last_name": "Norial",
      "purpose": "dsa",
      "status": "For Procurement Review",
      "stage": "Procurement Review",
      "total_amount": null,
      "created_at": "2026-02-19T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

## Data Flow: How Tables Are Populated

### Scenario 1: Procurement Approves PR

```
1. User clicks "Approve" on PR with status "For Procurement Review"
   │
2. Modal opens with items, supplier selection, unit cost inputs
   │
3. User enters for each item:
   │   - quantity (default: original value)
   │   - unit (default: original value)
   │   - unit_price (PHP, required)
   │
4. User selects supplier from dropdown
   │   → GET /api/suppliers returns list
   │   → Selecting supplier auto-fills supplier_address
   │
5. User clicks "Approve & Forward"
   │
6. API processes (PUT /api/purchase-requests/:id/procurement-approve)
   │
   ├─► UPDATE purchase_request_items
   │   SET unit_price = ?, total_price = ?, unit = ?
   │   WHERE id = ? (for each item)
   │
   ├─► UPDATE purchase_requests
   │   SET status = 'For Super Admin Final Approval',
   │       total_amount = ? (calculated sum),
   │       supplier_id = ?,
   │       supplier_address = ?
   │   WHERE id = ?
   │
   └─► INSERT INTO notifications (for Super Admins)
       INSERT INTO notifications (for Engineer, if changes made)
```

### Scenario 2: Procurement Rejects PR

```
1. User clicks "Reject" on PR
   │
2. Modal opens with:
   │   - Rejection reason textarea (required)
   │   - Per-item remarks textareas (optional)
   │
3. User fills in rejection details
   │
4. User clicks "Reject PR"
   │
5. API processes (PUT /api/purchase-requests/:id/procurement-approve)
   │
   ├─► UPDATE purchase_requests
   │   SET status = 'Rejected',
   │       rejection_reason = ?
   │   WHERE id = ?
   │
   ├─► INSERT INTO pr_item_rejection_remarks
   │   (purchase_request_id, purchase_request_item_id, item_id, remark, created_by)
   │   VALUES (?, ?, ?, ?, ?) (for each item_remark)
   │
   └─► INSERT INTO notifications (for Engineer - rejection notice)
```

---

## Mobile App Integration Guide

### Authentication

All endpoints require Bearer token authentication:
```http
Authorization: Bearer <token>
```

### Required API Flow for Mobile App

#### 1. Fetch Procurement Review PRs

```javascript
// GET /api/purchase-requests?status=For Procurement Review
const response = await fetch(`${BASE_URL}/api/purchase-requests?status=For Procurement Review`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { purchaseRequests } = await response.json();
```

#### 2. Get PR Details for Approval/Rejection

```javascript
// GET /api/purchase-requests/:id
const response = await fetch(`${BASE_URL}/api/purchase-requests/${prId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { purchaseRequest } = await response.json();
// Use purchaseRequest.items for the item list
```

#### 3. Fetch Suppliers List

```javascript
// GET /api/suppliers
const response = await fetch(`${BASE_URL}/api/suppliers`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { suppliers } = await response.json();
// Populate supplier picker
```

#### 4. Submit Approval

```javascript
// PUT /api/purchase-requests/:id/procurement-approve
const approvalData = {
  status: 'approved',
  supplier_id: selectedSupplier.id,
  supplier_address: selectedSupplier.address,
  items: purchaseRequest.items.map(item => ({
    id: item.id,
    item_id: item.item_id,
    item_name: item.item_name,
    item_code: item.item_code,
    quantity: item.quantity,        // User can modify
    unit: item.unit,                // User can modify
    unit_price: item.unitPrice      // User enters (PHP)
  }))
};

const response = await fetch(`${BASE_URL}/api/purchase-requests/${prId}/procurement-approve`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(approvalData)
});
```

#### 5. Submit Rejection

```javascript
// PUT /api/purchase-requests/:id/procurement-approve
const rejectionData = {
  status: 'rejected',
  rejection_reason: rejectionReason,  // Required string
  item_remarks: purchaseRequest.items
    .filter(item => item.remark)        // Only include items with remarks
    .map(item => ({
      item_id: item.id,                 // purchase_request_item.id (not item_id)
      remark: item.remark
    }))
};

const response = await fetch(`${BASE_URL}/api/purchase-requests/${prId}/procurement-approve`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(rejectionData)
});
```

### Mobile UI Recommendations

#### Approval Screen
```
┌─────────────────────────────────────┐
│ Approve Purchase Request            │
│ MTN-2026-02-002                     │
├─────────────────────────────────────┤
│                                     │
│ Items:                              │
│ ┌─────────────────────────────────┐   │
│ │ 25mm bar @ 13.5m G60           │   │
│ │ Qty: [  1  ] Unit: [ pcs ]     │   │
│ │ Unit Cost: [  1500.00 ] PHP    │   │
│ │ Total: ₱1,500.00               │   │
│ └─────────────────────────────────┘   │
│ ┌─────────────────────────────────┐   │
│ │ 25mm bar @ 12m G60             │   │
│ │ Qty: [  1  ] Unit: [ pcs ]     │   │
│ │ Unit Cost: [  1400.00 ] PHP    │   │
│ │ Total: ₱1,400.00               │   │
│ └─────────────────────────────────┘   │
│                                     │
│ Total Amount: ₱2,900.00             │
│                                     │
│ Supplier: [ ABC Supply ▼ ]          │
│ Address: 456 Supplier St, Manila    │
│                                     │
│ [  Cancel  ]  [ Approve & Forward ] │
└─────────────────────────────────────┘
```

#### Rejection Screen
```
┌─────────────────────────────────────┐
│ Reject Purchase Request             │
│ MTN-2026-02-002                     │
├─────────────────────────────────────┤
│                                     │
│ Rejection Reason *                  │
│ ┌─────────────────────────────────┐ │
│ │ Items not available from        │ │
│ │ preferred supplier. Alternative │ │
│ │ sizes recommended below.        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Per-Item Remarks (Optional)         │
│                                     │
│ 25mm bar @ 13.5m G60 (Qty: 1)       │
│ ┌─────────────────────────────────┐ │
│ │ Out of stock, 12m available    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 25mm bar @ 12m G60 (Qty: 1)         │
│ ┌─────────────────────────────────┐ │
│ │ Available, no issues             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [  Cancel  ]  [    Reject PR    ]   │
└─────────────────────────────────────┘
```

---

## Important Notes

### Permissions
- Only users with `procurement`, `admin`, or `super_admin` role can access the procurement-approve endpoint
- Middleware: `requireProcurement` in `backend/middleware/auth.js`

### Validation Rules
1. PR status **must be** `For Procurement Review` for procurement actions
2. Supplier selection is **required** for approval
3. Unit cost is **required** for approval (cannot be 0)
4. Rejection reason is **required** for rejection
5. Per-item remarks are **optional** for rejection

### Real-time Updates
- Socket.IO event: `pr_status_changed`
- Payload: `{ id, pr_number, status, type: 'status_update', updated_by: 'procurement' }`

### Notifications Generated
| Action | Recipients | Notification |
|--------|------------|--------------|
| Approve | Super Admins | "PR Pending Final Approval" |
| Approve with changes | Engineer | "PR Values Modified by Procurement" |
| Reject | Engineer | "PR Rejected by Procurement" |

### Error Handling
Common error responses:
- `400` - Invalid status for this approval step
- `400` - Supplier is required for approval
- `404` - Purchase request not found
- `403` - Access denied (wrong role)
- `500` - Database/server error

---

## File References

- **API Routes:** `backend/routes/purchaseRequests.js:505-685` (procurement-approve endpoint)
- **Database Schema:**
  - `dbschema/purchase_requests.sql`
  - `dbschema/purchase_request_items.sql`
  - `dbschema/pr_item_rejection_remarks.sql`
  - `dbschema/suppliers.sql`
- **Auth Middleware:** `backend/middleware/auth.js:63-64` (requireProcurement)
- **Notifications:** `backend/utils/notifications.js`
