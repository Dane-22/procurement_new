# PR Payment Date Schedules + Reminder Notifications (V1)

## Goal
Add user-defined payment dates for **Purchase Requests** and automatically notify:
- requester engineer
- procurement users
- admin users
- super admin users

Reminder timing:
- 3 days before payment date
- 1 day before payment date
- on payment date

Scope for v1:
- Purchase Requests only
- Requester can edit schedule only while PR is Draft (locked after submit)

---

## Functional Design

### 1. Payment schedule data (structured)
Use a separate table for payment dates instead of storing everything in free text.

Table: `purchase_request_payment_schedules`
- `id` (PK)
- `purchase_request_id` (FK -> purchase_requests.id)
- `payment_date` (DATE, required)
- `amount` (DECIMAL, nullable)
- `note` (VARCHAR/TEXT, nullable)
- `created_by` (FK -> employees.id)
- `created_at`
- `updated_at`

Rules:
- One PR can have multiple payment dates.
- Dates in the same PR should be unique.
- Keep existing `payment_terms_note` as optional narrative text.

### 2. Reminder dedupe tracking
Create a log table so reminders are sent once per schedule per reminder type.

Table: `payment_schedule_reminder_logs`
- `id` (PK)
- `schedule_id` (FK -> purchase_request_payment_schedules.id)
- `reminder_type` (`D_MINUS_3`, `D_MINUS_1`, `D_DAY`)
- `sent_at`
- unique key: (`schedule_id`, `reminder_type`)

### 3. Backend API behavior (PR endpoints)
Extend PR payloads with:
- `payment_schedules: [{ payment_date, amount?, note? }]`

Apply in:
- create PR
- update draft PR
- resubmit PR (if draft/rejected-edit flow allows)
- get PR by id (include schedules)
- list PR (optional lightweight summary if needed)

Validation:
- If `payment_basis = debt`, enforce at least 1 payment schedule (if you want strict mode).
- Reject invalid dates.
- Reject duplicate dates within one PR.
- Only requester can edit schedules while status is `Draft`.
- Once PR is submitted (`For Procurement Review` and beyond), schedules are read-only.

### 4. Reminder scheduler job
Add a backend scheduler (inside backend app process) that runs on interval (daily/hourly):
1. Find active PR schedules matching:
   - today + 3 days (`D_MINUS_3`)
   - today + 1 day (`D_MINUS_1`)
   - today (`D_DAY`)
2. Skip terminal PR statuses (`Rejected`, `Cancelled`, `Completed`, `Received`).
3. Resolve recipients:
   - PR requester (`requested_by`)
   - all procurement users
   - all admin users
   - all super admins
4. Send notifications via existing `createNotification(...)`.
5. Insert reminder log row to prevent duplicates.

### 5. Notification type compatibility
Current `notifications.type` uses enum.
For reminder events, update schema so new types won’t fail inserts:
- either extend enum with reminder types, or
- convert `notifications.type` to `VARCHAR(50)` (recommended for flexibility).

---

## Frontend UX (Purchase Requests)

### Create/Edit form
Add a "Payment Dates" section with:
- Add row button
- Each row:
  - `payment_date` (required)
  - `amount` (optional)
  - `note` (optional)
  - remove row button

Behavior:
- Editable only in Draft by requester.
- Read-only after submit.

### Display
Show schedule in:
- PR expanded details row
- PR preview modal
- approval views (read-only)

---

## SQL Skeleton (Draft)

```sql
CREATE TABLE purchase_request_payment_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_request_id INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(15,2) NULL,
  note VARCHAR(255) NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pr_schedule_pr FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_pr_schedule_created_by FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE SET NULL,
  UNIQUE KEY uq_pr_date (purchase_request_id, payment_date)
);

CREATE TABLE payment_schedule_reminder_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  reminder_type VARCHAR(20) NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reminder_schedule FOREIGN KEY (schedule_id) REFERENCES purchase_request_payment_schedules(id) ON DELETE CASCADE,
  UNIQUE KEY uq_schedule_reminder (schedule_id, reminder_type)
);
```

If keeping enum in `notifications.type`, add reminder values there too.

---

## Implementation Order
1. DB schema changes (new tables + notification type compatibility)
2. Backend PR endpoints (read/write schedules)
3. Backend reminder scheduler + dedupe logs
4. Frontend PR form + preview/detail read-only states
5. End-to-end test in local Docker
6. Production SQL patch + deploy

---

## Test Checklist

### PR draft flow
- Create draft PR with 3 payment dates
- Edit draft payment dates
- Submit PR and verify schedules lock

### Reminder behavior
- Seed payment dates for D-3, D-1, D-day
- Run scheduler manually and verify notifications are created
- Re-run scheduler and verify no duplicate notifications

### Recipients
Verify each reminder sends to:
- requester engineer
- procurement role users
- admin role users
- super_admin role users

### Status exclusions
Set PR to terminal status and confirm reminders are skipped.

---

## Notes for Future (V2)
- Reuse same schedule/reminder pattern for Service Requests, Cash Requests, Reimbursements.
- Add configurable reminder offsets in settings (instead of fixed 3/1/day-of).
- Optional email/SMS reminder channel.
