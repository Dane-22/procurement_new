Procurement System Documentation
System Overview
An internal e-commerce procurement system with four user levels: Engineer (requester), Procurement, Admin (procurement officer), and Super Admin (approver).

User Roles & Responsibilities
1. Engineer (User)
Responsibilities:

Browse available items in the system

Create Purchase Requests (PR)

View PR status

Mark items as received

Track purchase history

2. Procurement
Responsibilities:

Review approved PRs from Super Admin

Approve PRs to proceed to next approval stage (requires rejection reason when rejecting)

View all PRs and POs

Monitor procurement activities

Add/Edit items to the system

3. Admin
Responsibilities:

Add/Edit items to the system (without quantities)

Add/Edit suppliers and their pricing

Create Purchase Orders (PO) for fully approved items

Manage supplier relationships

4. Super Admin
Responsibilities:

Initial approval of PRs from Engineer

Pre-final approval of PRs before going to Admin

Approve POs after Admin places order

View all PRs and POs

System oversight

System Flow
Step 1: Item Setup (Admin)
text
Admin → Adds Items → Items Table
Admin → Adds Suppliers → Suppliers Table
Admin → Links Items to Suppliers → Supplier Items Table
Step 2: Purchase Request Creation (Engineer)
text
Engineer → Creates PR → Purchase Requests Table
Engineer → Adds Items to PR → Purchase Request Items Table
Status: "Pending"
Step 3: First Approval - Super Admin
text
Super Admin → Reviews PR
↓
If Approved:
- Purchase Requests.status = "For Procurement Review"
- Notification sent to Procurement
↓
If Rejected:
- Purchase Requests.status = "Rejected"
- Notification sent to Engineer
Step 4: Second Approval - Procurement
text
Procurement → Reviews PR from Super Admin
↓
If Approved:
- Purchase Requests.status = "For Super Admin Final Approval"
- Notification sent to Super Admin
↓
If Rejected:
- Purchase Requests.status = "Rejected"
- rejection_reason required
- Notification sent to Engineer
Step 5: Third Approval - Super Admin
text
Super Admin → Reviews PR approved by Procurement
↓
If Approved:
- Purchase Requests.status = "For Purchase"
- approved_by, approved_at updated
- Notification sent to Admin
↓
If Rejected:
- Purchase Requests.status = "Rejected"
- Notification sent to Engineer
Step 6: Procurement Process (Admin)
text
Admin receives notification
↓
Admin canvasses suppliers (real-world action)
↓
Admin creates Purchase Order → Purchase Orders Table
↓
Admin adds items to PO → Purchase Order Items Table
↓
Purchase Request Items.status = "For Purchase"
↓
Admin places order (real-world action)
↓
Notification sent to Super Admin for final approval
Step 7: Final Approval - Super Admin
text
Super Admin → Reviews placed order
↓
If Approved:
- Purchase Orders.status = "Confirmed"
- Notification sent to Engineer
↓
If Rejected:
- Purchase Orders.status = "Cancelled"
- Notification sent to Admin
Step 8: Receiving Process (Engineer)
text
Engineer receives items
↓
Engineer marks items as received
↓
Purchase Request Items.status = "Received"
↓
If all items received → Purchase Requests.status = "Completed"

Database Tables
Core Tables:
1. employees (Existing Table)
text
- id (PK)
- employee_code
- first_name, middle_name, last_name
- email
- position (Engineer, Procurement, Admin, Super Admin)
- status
- branch_id
- created_at, updated_at
2. categories
Stores item categories for organization

text
- id (PK)
- category_name
- description
- status
- created_by (FK to employees)
- created_at
3. items
Catalog of all items available for purchase

text
- id (PK)
- item_code (Unique)
- item_name (Unique)
- description
- category_id (FK to categories)
- unit (pc, kg, box, etc.)
- created_by (FK to employees - Admin)
- status
- created_at, updated_at
4. suppliers
Stores supplier information

text
- id (PK)
- supplier_code (Unique)
- supplier_name
- contact_person
- email, phone, address
- status
- created_at, updated_at
5. supplier_items
Links items to suppliers with pricing information

text
- id (PK)
- supplier_id (FK to suppliers)
- item_id (FK to items)
- price
- lead_time_days
- is_preferred
- created_at, updated_at
Transaction Tables:
6. purchase_requests
Main Purchase Request table

text
- id (PK)
- pr_number (Unique)
- requested_by (FK to employees - Engineer)
- purpose, remarks
- status (Pending, For Procurement Review, For Super Admin Final Approval, For Purchase, Completed, Rejected, Cancelled)
- approved_by (FK to employees - Super Admin)
- approved_at
- rejection_reason (required when Procurement rejects)
- created_at, updated_at
7. purchase_request_items
Items requested in each PR

text
- id (PK)
- purchase_request_id (FK to purchase_requests)
- item_id (FK to items)
- quantity
- unit_price, total_price
- remarks
- status (Pending, For Purchase, Purchased, Received)
- received_by (FK to employees - Engineer)
- received_at
- created_at
8. purchase_orders
Actual Purchase Orders created by Admin

text
- id (PK)
- po_number (Unique)
- purchase_request_id (FK to purchase_requests)
- supplier_id (FK to suppliers)
- prepared_by (FK to employees - Admin)
- total_amount
- po_date, expected_delivery_date, actual_delivery_date
- status (Draft, Ordered, Delivered, Cancelled)
- created_at, updated_at
9. purchase_order_items
Items in each Purchase Order

text
- id (PK)
- purchase_order_id (FK to purchase_orders)
- purchase_request_item_id (FK to purchase_request_items)
- item_id (FK to items)
- quantity, unit_price, total_price
- created_at
Supporting Tables:
10. notifications
System notifications for users

text
- id (PK)
- recipient_id (FK to employees)
- title, message
- type (PR Created, PR Approved, PR Rejected, PO Created, Item Received, System)
- related_id, related_type
- is_read
- created_at
11. activity_logs
Audit trail for all system activities

text
- id (PK)
- user_id (FK to employees)
- action, description
- table_name, record_id
- ip_address, user_agent
- created_at
Status Flow Diagram
text
Engineer Creates PR
    ↓
Status: PENDING
    ↓
Super Admin Reviews (First)
    ↓
    ├─→ Rejected → Status: REJECTED → Engineer Notified
    │
    └─→ Approved → Status: FOR PROCUREMENT REVIEW
                    ↓
                    Procurement Reviews
                    ↓
                    ├─→ Rejected → Status: REJECTED → Engineer Notified
                    │
                    └─→ Approved → Status: FOR SUPER ADMIN FINAL APPROVAL
                                    ↓
                                    Super Admin Reviews (Second)
                                    ↓
                                    ├─→ Rejected → Status: REJECTED → Engineer Notified
                                    │
                                    └─→ Approved → Status: FOR PURCHASE → Admin Notified
                                                    ↓
                                                    Admin Creates PO
                                                    ↓
                                                    Admin Places Order
                                                    ↓
                                                    Super Admin Reviews (Final)
                                                    ↓
                                                    ├─→ Rejected → Status: CANCELLED → Admin Notified
                                                    │
                                                    └─→ Approved → Engineer Notified
                                                                    ↓
                                                                    Engineer Receives → Status: RECEIVED
                                                                    ↓
                                                                    All Items Received? → Status: COMPLETED
Key Features
1. Item Management
Items are added without quantities (unlike inventory system)

Multiple suppliers can provide the same item

Preferred supplier designation available

2. Purchase Request Tracking
Each item in a PR has individual status tracking

Engineers can see real-time status updates

History of all purchases maintained

3. Notification System
Automated notifications for status changes

Email/SMS integration possible

In-app notification center

4. Reporting & Analytics
Purchase history by engineer/department

Supplier performance tracking

Budget monitoring

Business Rules
Item Creation: Only Admin can add/remove items

PR Creation: Engineers can only create PRs for their needs

Approval Flow: 
- Super Admin (First): Must approve PR before going to Procurement
- Procurement: Must approve PR before returning to Super Admin
- Super Admin (Second): Must approve PR before going to Admin
- Super Admin (Final): Must approve order before notifying Engineer

PO Creation: Admin creates PO only after full PR approval

Receiving: Only the requesting Engineer can mark items as received

Price Updates: Supplier prices can be updated anytime by Admin

API Endpoints (Planned)
Engineer Endpoints:
GET /api/items - Browse items

POST /api/purchase-requests - Create PR

GET /api/purchase-requests/{id} - View PR status

PUT /api/purchase-requests/{id}/receive - Mark items received

Admin Endpoints:
POST /api/items - Add items

POST /api/suppliers - Add suppliers

POST /api/purchase-orders - Create PO

GET /api/purchase-requests/pending - View pending PRs

Procurement Endpoints:
GET /api/purchase-requests/awaiting-procurement - View PRs approved by Super Admin (First)

PUT /api/purchase-requests/{id}/procurement-approve - Approve PR

PUT /api/purchase-requests/{id}/procurement-reject - Reject PR

GET /api/purchase-requests - View all PRs

Super Admin Endpoints:
GET /api/purchase-requests/first-approval - View pending PRs from Engineers

GET /api/purchase-requests/second-approval - View PRs approved by Procurement

GET /api/purchase-requests/final-approval - View orders awaiting final approval

PUT /api/purchase-requests/{id}/approve - Approve PR

PUT /api/purchase-requests/{id}/reject - Reject PR

PUT /api/purchase-orders/{id}/final-approve - Final approval after order placed

GET /api/reports - View reports

Security Considerations
Role-based Access Control (RBAC)

Data validation on all inputs

Audit logging for all transactions

Encrypted passwords in employees table

Input sanitization to prevent SQL injection

Future Enhancements
Budget Management - Department/Project budgets

Bidding Module - Multiple supplier quotations

Mobile App - For on-site receiving

Integration - With accounting software

Dashboard - Real-time analytics and reports