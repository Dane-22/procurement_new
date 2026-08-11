# Procurement System Enhancement Plan

## Overview

This document outlines the implementation plan for new procurement workflows:
- **Debt vs Non-Debt basis** for PR processing
- **Engineer supplier selection** during PR creation
- **Service Requests** (Rent, Job Orders, etc.)

---

## 1. New Workflow Concepts

### 1.1 Debt vs Non-Debt Basis

| Basis | Flow | Description |
|-------|------|-------------|
| **Debt** | PR → PO (Purchase Order) → DV | Items/services received first, paid later. PO is a commitment to pay. |
| **Non-Debt** | PR → PO (Payment Request) → DV | Payment made first, items/services received after. PO authorizes immediate payment. |

### 1.2 Service Request Flow

| Request Type | Flow | Use Cases |
|--------------|------|-----------|
| **Service Request** | Service Req → Payment Request → DV | Rent, Job Orders, Services, Contractor Payments |

### 1.3 Service Request Types

| SR Type | Fields Required | Description | Examples |
|---------|-----------------|-------------|----------|
| **Payment Request** | Amount + Quantity + Unit | For services with measurable quantities | Rent (10 days), Labor (40 hours), Items (5 units) |
| **Payment Order** | Amount only | Fixed fees, retainers, lump sum payments | Consultation fee, Retainer, One-time service |

**Key Difference:** Service Requests don't have physical items from inventory - they have service descriptions.

---

## 2. Database Schema Changes

### 2.1 Add `payment_basis` to `purchase_requests`

```sql
ALTER TABLE `purchase_requests` 
ADD COLUMN `payment_basis` enum('debt','non_debt') DEFAULT 'debt' 
COMMENT 'Determines if PR leads to Purchase Order (debt) or Payment Request (non_debt)';
```

### 2.2 Add `po_type` to `purchase_orders`

```sql
ALTER TABLE `purchase_orders` 
ADD COLUMN `po_type` enum('purchase_order','payment_order') DEFAULT 'purchase_order' 
COMMENT 'Type of PO: purchase_order (debt) or payment_order (Payment Request for non-debt/prepaid)';
```

### 2.3 Update `purchase_orders` status enum

```sql
ALTER TABLE `purchase_orders` 
MODIFY `status` enum('Draft','Pending Approval','Approved','On Hold','Ordered','Delivered','Paid','Cancelled') DEFAULT 'Draft';
```

### 2.4 Create `service_requests` Table

```sql
CREATE TABLE `service_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sr_number` varchar(50) NOT NULL COMMENT 'Format: SRV-YYYY-MM-XXX',
  `requested_by` int(11) NOT NULL,
  `purpose` text NOT NULL,
  `description` text DEFAULT NULL COMMENT 'Detailed service description',
  `service_type` enum('Rent','Job Order','Contractor','Service','Others') NOT NULL DEFAULT 'Service',
  `sr_type` enum('payment_request','payment_order') DEFAULT 'payment_request' COMMENT 'Type: payment_request (amount+qty) vs payment_order (amount only)',
  `quantity` decimal(10,2) DEFAULT NULL COMMENT 'Quantity for payment_request type',
  `unit` varchar(20) DEFAULT NULL COMMENT 'Unit of measurement (e.g., pcs, hours, days)',
  `project` varchar(100) DEFAULT NULL,
  `project_address` varchar(255) DEFAULT NULL,
  `supplier_id` int(11) DEFAULT NULL COMMENT 'Selected supplier/contractor',
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `date_needed` date DEFAULT NULL,
  `status` enum('Draft','Pending','For Approval','Approved','Rejected','Cancelled','PO Created','Paid') DEFAULT 'Draft',
  `remarks` text DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `order_number` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sr_number` (`sr_number`),
  KEY `requested_by` (`requested_by`),
  KEY `supplier_id` (`supplier_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `service_requests_ibfk_1` FOREIGN KEY (`requested_by`) REFERENCES `employees` (`id`),
  CONSTRAINT `service_requests_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `service_requests_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.5 Update `disbursement_vouchers` for Service Requests

```sql
-- Add service_request_id as alternative to purchase_order_id
ALTER TABLE `disbursement_vouchers` 
ADD COLUMN `service_request_id` int(11) DEFAULT NULL AFTER `purchase_request_id`,
ADD COLUMN `dv_type` enum('po_based','sr_based') DEFAULT 'po_based' COMMENT 'Source of DV: PO or Service Request',
ADD KEY `service_request_id` (`service_request_id`),
ADD CONSTRAINT `disbursement_vouchers_ibfk_7` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE;

-- Make purchase_order_id nullable since DV can come from Service Request
ALTER TABLE `disbursement_vouchers` 
MODIFY `purchase_order_id` int(11) DEFAULT NULL;
```

### 2.6 Link Purchase Orders to Service Requests

```sql
-- Add service_request_id to purchase_orders for service request flow
ALTER TABLE `purchase_orders` 
ADD COLUMN `service_request_id` int(11) DEFAULT NULL AFTER `purchase_request_id`,
ADD KEY `service_request_id` (`service_request_id`),
ADD CONSTRAINT `purchase_orders_ibfk_4` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`);
```

---

## 3. Backend API Changes

### 3.1 Purchase Request Routes (`purchaseRequests.js`)

**Add to POST `/` (Create PR):**
- Accept `payment_basis` parameter ('debt' | 'non_debt')
- Accept `supplier_id` (now selectable by engineer)
- If `payment_basis` = 'non_debt', set status to 'For Procurement Review' but skip some procurement steps

**Add new endpoint:**
```javascript
// GET /api/purchase-requests/:id/basis-check
// Returns whether PR is debt or non-debt to determine next flow step
```

### 3.2 Purchase Order Routes (`purchaseOrders.js`)

**Update POST `/` (Create PO):**
- Check `pr.payment_basis` 
- If 'debt' → `po_type` = 'purchase_order', requires delivery tracking
- If 'non_debt' → `po_type` = 'payment_order', skips delivery, goes straight to payment

**Update status workflow:**
- Purchase Order: Draft → Pending Approval → Approved → Ordered → Delivered → DV
- Payment Request: Draft → Pending Approval → Approved → Paid → DV

### 3.3 New Service Request Routes (`serviceRequests.js`)

**Create new file:** `backend/routes/serviceRequests.js`

```javascript
// CRUD Endpoints
POST   /api/service-requests           // Create SR
GET    /api/service-requests            // List all SRs
GET    /api/service-requests/:id        // Get SR details
PUT    /api/service-requests/:id       // Update SR (Draft only)
PUT    /api/service-requests/:id/submit // Submit for approval
PUT    /api/service-requests/:id/approve // Approve/Reject
DELETE /api/service-requests/:id        // Delete (Draft only)

// Workflow Endpoints  
POST   /api/service-requests/:id/create-payment-order // Create PO from SR
```

### 3.4 Disbursement Voucher Routes Updates

**Update to handle both PO and SR sources:**
- DV can be created from PO (existing) or directly from SR
- Update validation logic to check `dv_type`

---

## 4. Frontend Changes

### 4.1 PR Creation Form Updates (`App.jsx`)

**New Fields:**
```jsx
// Payment Basis Selection
<div>
  <label>Payment Basis *</label>
  <select value={prFormData.payment_basis} onChange={...}>
    <option value="debt">Debt (Purchase Order)</option>
    <option value="non_debt">Non-Debt (Payment Request)</option>
  </select>
</div>

// Supplier Selection (now available to engineers)
<div>
  <label>Preferred Supplier</label>
  <select value={prFormData.supplier_id} onChange={...}>
    <option value="">Select supplier (optional)</option>
    {suppliers.map(s => <option value={s.id}>{s.supplier_name}</option>)}
  </select>
</div>
```

### 4.2 New Service Request Module

**Create new components:**
```
frontend/src/components/service-requests/
├── ServiceRequestList.jsx      // List view
├── CreateServiceRequest.jsx    // Create form
├── ServiceRequestDetail.jsx    // Detail/approval view
└── ServiceRequestCard.jsx      // Card component
```

**Add to App.jsx:**
```jsx
// New tab or section for Service Requests
{activeTab === 'service-requests' && <ServiceRequestList />}
```

**Service Request Form Fields:**
- SR Number (auto-generated)
- Purpose
- Service Type (Rent, Job Order, Contractor, Service, Others)
- Description
- Project
- Project Address
- Supplier/Contractor
- Amount
- Date Needed
- Remarks

### 4.3 PO Type Display

**Update Purchase Order views:**
- Show badge: "Purchase Order" (debt) vs "Payment Request" (non-debt)
- Different status flows based on `po_type`
- Payment Requests skip delivery tracking

### 4.4 DV Updates

**Update DV creation:**
- Source can be PO or SR
- Show source type in DV list/detail

---

## 5. Workflow Diagrams

### 5.1 Debt PR Flow (Existing with modifications)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DEBT BASIS FLOW                               │
│                    (Purchase Order Type)                              │
└─────────────────────────────────────────────────────────────────────┘

Engineer Creates PR
│
├─► Selects Supplier (optional, new)
├─► Payment Basis = "Debt"
│
▼
Status: Draft ───────────────────────► Engineer submits
│
▼
Status: For Procurement Review
│
├─► Procurement approves with supplier & costs
│
▼
Status: For Super Admin Final Approval
│
▼
Status: For Purchase (PO Creation)
│
▼
Create PO (po_type = 'purchase_order')
│
├─► PO Status: Draft → Pending Approval → Approved → Ordered
│
▼
PO Status: Delivered
│
▼
Create DV (dv_type = 'po_based')
│
▼
Status: Paid
```

### 5.2 Non-Debt PR Flow (New)

```
┌─────────────────────────────────────────────────────────────────────┐
│                       NON-DEBT BASIS FLOW                            │
│                     (Payment Request Type)                            │
└─────────────────────────────────────────────────────────────────────┘

Engineer Creates PR
│
├─► Selects Supplier (optional)
├─► Payment Basis = "Non-Debt"
│
▼
Status: Draft ───────────────────────► Engineer submits
│
▼
Status: For Procurement Review
│
├─► Procurement verifies and approves
│
▼
Status: For Super Admin Final Approval
│
▼
Create PO (po_type = 'payment_order')
│
├─► PO Status: Draft → Pending Approval → Approved
│
▼
PO Status: Paid (immediate payment authorized)
│
▼
Create DV (dv_type = 'po_based')
│
▼
Status: Completed
```

### 5.3 Service Request Flow (New)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVICE REQUEST FLOW                             │
│              (Rent, Job Orders, Contractor Services)                │
└─────────────────────────────────────────────────────────────────────┘

Engineer Creates Service Request
│
├─► Selects Service Type (Rent/Job Order/Contractor/Service/Others)
├─► Enters Description & Amount
├─► Selects Supplier/Contractor
│
▼
Status: Draft ───────────────────────► Engineer submits
│
▼
Status: For Approval
│
├─► Admin/Manager reviews
│
▼
Status: Approved
│
▼
Create PO (po_type = 'payment_order')
│
├─► PO linked to Service Request
│
▼
PO Status: Approved → Paid
│
▼
Create DV (dv_type = 'sr_based')
│
▼
Service Request Status: Paid
```

---

## 6. Implementation Phases

### Phase 1: Database Updates
1. Add `payment_basis` to `purchase_requests` (001_add_payment_basis_safe.sql)
2. Add `po_type` to `purchase_orders` (002_add_po_type_safe.sql)
3. Create `service_requests` table (003_create_service_requests_safe.sql)
4. Update `disbursement_vouchers` for SR support (004_update_dv_for_sr_safe.sql)
5. Link purchase_orders to service_requests (005_link_po_to_sr_safe.sql)
6. Add Service Request types (006_add_sr_types.sql)
7. Run migration scripts

### Phase 2: Backend APIs
1. Update PR create/update endpoints for `payment_basis` and `supplier_id`
2. Update PO create endpoint to handle `po_type`
3. Create new `serviceRequests.js` routes with full CRUD
4. Update DV routes for SR support
5. Add Service Request types validation (payment_request requires quantity)

### Phase 3: Frontend PR Updates
1. Add payment basis selector to PR form
2. Add supplier selector to PR form (for engineers)
3. Update PR detail view to show basis
4. Update PO views to show/hide delivery tracking based on `po_type`

### Phase 4: Service Request Module
1. Create Service Request service layer (frontend)
2. Create `ServiceRequestsManagement` component
3. Add SR Type selector (Payment Request vs Payment Order)
4. Add conditional quantity/unit fields for Payment Request type
5. Integrate into main navigation and routing
6. Add badges for SR Type display
7. Create Service Request list component
8. Create Service Request create/edit form
9. Create Service Request detail/approval view
10. Add Service Request tab to main navigation

### Phase 5: DV Updates
1. Update DV creation to handle SR sources
2. Update DV list to show source type
3. Update DV detail view

---

## 7. Key Implementation Notes

### 7.1 PR Number Generation for Service Requests

Service Request numbers follow similar pattern to PRs:
- Format: `SRV-{Initials}-{Year}-{Month}-{Counter}`
- Example: `SRV-MTN-2026-02-001`

### 7.2 PO Number Generation

PO numbers remain the same but include type indicator:
- Purchase Order: `PO-2026-02-001`
- Payment Request: `PO-2026-02-001` (same format, type stored in `po_type` field)

### 7.3 DV Number Generation

DV numbers remain: `YYYY-MM-001` format

### 7.4 Permission Matrix

| Action | Engineer | Procurement | Admin | Super Admin |
|--------|----------|-------------|-------|-------------|
| Create PR | ✓ | ✓ | ✓ | ✓ |
| Select Supplier (PR) | ✓ | ✓ | ✓ | ✓ |
| Create Service Request | ✓ | ✓ | ✓ | ✓ |
| Approve PR | - | First Approval | - | Final Approval |
| Approve Service Request | - | - | ✓ | ✓ |
| Create PO | - | ✓ | ✓ | ✓ |
| Create DV | - | ✓ | ✓ | ✓ |

---

## 8. Migration Strategy

### Existing Data

All existing PRs should be migrated with:
```sql
UPDATE purchase_requests SET payment_basis = 'debt' WHERE payment_basis IS NULL;
UPDATE purchase_orders SET po_type = 'purchase_order' WHERE po_type IS NULL;
```

### Rollback Plan

Keep backup of original schema before migration.

---

## 9. Files to Create/Modify

### New Files:
- `backend/routes/serviceRequests.js`
- `frontend/src/services/serviceRequests.js`
- `frontend/src/components/service-requests/ServiceRequestList.jsx`
- `frontend/src/components/service-requests/CreateServiceRequest.jsx`
- `frontend/src/components/service-requests/ServiceRequestDetail.jsx`
- `dbschema/add_payment_basis.sql`
- `dbschema/create_service_requests.sql`

### Modified Files:
- `backend/routes/purchaseRequests.js`
- `backend/routes/purchaseOrders.js`
- `backend/routes/disbursementVouchers.js`
- `frontend/src/App.jsx` (PR creation form)
- `frontend/src/services/purchaseRequests.js`
- `dbschema/procurement_db.sql`

---

*Plan created: February 26, 2026*
*Status: Ready for Implementation*
