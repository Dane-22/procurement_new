# Database Cascade Operations Review

## Overview
This document catalogs all `ON DELETE CASCADE` foreign key constraints in the procurement system database. These constraints ensure referential integrity by automatically deleting related records when a parent record is deleted.

---

## Cascade Operations Summary

### 1. Cash Request Payment Schedules
**Table:** `cash_request_payment_schedules`
- **Constraint:** `fk_cr_schedule_cr`
- **Foreign Key:** `cash_request_id` → `cash_requests.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a cash request is deleted, all its payment schedules are automatically deleted.

### 2. Cash Request Schedule Reminder Logs
**Table:** `cash_request_schedule_reminder_logs`
- **Constraint:** `fk_csrl_schedule`
- **Foreign Key:** `schedule_id` → `cash_request_payment_schedules.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a cash request payment schedule is deleted, all its reminder logs are automatically deleted.

### 3. Disbursement Vouchers
**Table:** `disbursement_vouchers`
- **Constraint:** `disbursement_vouchers_ibfk_1`
- **Foreign Key:** `purchase_order_id` → `purchase_orders.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a purchase order is deleted, associated disbursement vouchers are deleted.

- **Constraint:** `disbursement_vouchers_ibfk_2`
- **Foreign Key:** `purchase_request_id` → `purchase_requests.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a purchase request is deleted, associated disbursement vouchers are deleted.

- **Constraint:** `disbursement_vouchers_ibfk_6`
- **Foreign Key:** `service_request_id` → `service_requests.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a service request is deleted, associated disbursement vouchers are deleted.

- **Constraint:** `disbursement_vouchers_ibfk_7`
- **Foreign Key:** `cash_request_id` → `cash_requests.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a cash request is deleted, associated disbursement vouchers are deleted.

### 4. Payment Requests
**Table:** `payment_requests`
- **Constraint:** `payment_requests_ibfk_1`
- **Foreign Key:** `purchase_request_id` → `purchase_requests.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a purchase request is deleted, associated payment requests are deleted.

### 5. Payment Request Items
**Table:** `payment_request_items`
- **Constraint:** `payment_request_items_ibfk_1`
- **Foreign Key:** `payment_request_id` → `payment_requests.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a payment request is deleted, all its items are automatically deleted.

### 6. Purchase Request Payment Schedule Reminder Logs
**Table:** `purchase_request_payment_schedule_reminder_logs`
- **Constraint:** `fk_reminder_schedule`
- **Foreign Key:** `schedule_id` → `purchase_request_payment_schedules.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a purchase request payment schedule is deleted, all its reminder logs are automatically deleted.

### 7. Purchase Order Attachments
**Table:** `po_attachments`
- **Constraint:** `po_attachments_ibfk_1`
- **Foreign Key:** `purchase_order_id` → `purchase_orders.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a purchase order is deleted, all its attachments are automatically deleted.

### 8. PR Item Rejection Remarks
**Table:** `pr_item_rejection_remarks`
- **Constraint:** `pr_item_rejection_remarks_ibfk_1`
- **Foreign Key:** `purchase_request_id` → `purchase_requests.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a purchase request is deleted, all its item rejection remarks are deleted.

- **Constraint:** `pr_item_rejection_remarks_ibfk_2`
- **Foreign Key:** `purchase_request_item_id` → `purchase_request_items.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a purchase request item is deleted, its rejection remarks are deleted.

### 9. Purchase Orders (Parent-Child Relationship)
**Table:** `purchase_orders`
- **Constraint:** `fk_po_parent_po_id`
- **Foreign Key:** `parent_po_id` → `purchase_orders.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a parent purchase order is deleted, all child purchase orders are deleted.

### 10. Purchase Request Payment Schedules
**Table:** `purchase_request_payment_schedules`
- **Constraint:** `fk_pr_schedule_pr`
- **Foreign Key:** `purchase_request_id` → `purchase_requests.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a purchase request is deleted, all its payment schedules are deleted.

### 11. Reimbursement Payment Schedules
**Table:** `reimbursement_payment_schedules`
- **Constraint:** `fk_rmb_schedule_rmb`
- **Foreign Key:** `reimbursement_id` → `reimbursements.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a reimbursement is deleted, all its payment schedules are deleted.

### 12. Reimbursement Schedule Reminder Logs
**Table:** `reimbursement_schedule_reminder_logs`
- **Constraint:** `fk_rsrl_schedule`
- **Foreign Key:** `schedule_id` → `reimbursement_payment_schedules.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a reimbursement payment schedule is deleted, all its reminder logs are deleted.

### 13. Service Request Payment Schedules
**Table:** `service_request_payment_schedules`
- **Constraint:** `fk_sr_schedule_sr`
- **Foreign Key:** `service_request_id` → `service_requests.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a service request is deleted, all its payment schedules are deleted.

### 14. Service Request Schedule Reminder Logs
**Table:** `service_request_schedule_reminder_logs`
- **Constraint:** `fk_ssrl_schedule`
- **Foreign Key:** `schedule_id` → `service_request_payment_schedules.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a service request payment schedule is deleted, all its reminder logs are deleted.

### 15. Purchase Request Reviews
**Table:** `purchase_request_reviews`
- **Constraint:** `pr_reviews_pr_fk`
- **Foreign Key:** `purchase_request_id` → `purchase_requests.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When a purchase request is deleted, all its reviews are deleted.

- **Constraint:** `pr_reviews_reviewer_fk`
- **Foreign Key:** `reviewer_id` → `employees.id`
- **Cascade:** `ON DELETE CASCADE`
- **Impact:** When an employee is deleted, all their review records are deleted.

---

## Backend Code Note

In `backend/routes/paymentRequests.js` (line 794), there's a comment indicating that cascade should handle deletion of payment request items, but the code explicitly deletes them first:

```javascript
// Delete items first (cascade should handle this, but being explicit)
await db.query('DELETE FROM payment_request_items WHERE payment_request_id = ?', [req.params.id]);
```

This is a defensive programming practice to ensure data cleanup even if the database cascade constraint fails or is removed.

---

## Cascade Hierarchy Summary

The cascade operations form the following deletion hierarchies:

1. **Purchase Requests →** Payment Requests, Disbursement Vouchers, PR Item Rejection Remarks, Payment Schedules, Reviews
2. **Purchase Orders →** Disbursement Vouchers, PO Attachments, Child POs
3. **Service Requests →** Disbursement Vouchers, Payment Schedules
4. **Cash Requests →** Payment Schedules, Disbursement Vouchers
5. **Payment Requests →** Payment Request Items
6. **Payment Schedules →** Reminder Logs
7. **Employees →** Review Records

---

## Files Containing Cascade Operations

1. `backend/database/procurement_db.sql` - Main database schema (18 cascade operations)
2. `backend/database/migrations/create_purchase_request_reviews_table.sql` - PR reviews table (2 cascade operations)
3. `docs/PR_ITEM_REJECTION_REMARKS.md` - Documentation for PR item rejection remarks (2 cascade references)
4. `docs/PR_PAYMENT_SCHEDULE_REMINDERS_PLAN.md` - Payment schedule reminders plan (2 cascade references)
5. `backend/routes/paymentRequests.js` - Payment request routes (1 cascade comment)
6. `docs/IMPLEMENTATION_PLAN.md` - Implementation plan (1 cascade reference for service requests)

---

*Review completed: May 29, 2026*
*Total cascade operations identified: 26*