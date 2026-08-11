# Procurement System - Standard Operating Procedure (SOP) & User Manual

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles & Responsibilities](#2-user-roles--responsibilities)
3. [Standard Operating Procedures](#3-standard-operating-procedures)
   - 3.1 [Item Management SOP](#31-item-management-sop)
   - 3.2 [Supplier Management SOP](#32-supplier-management-sop)
   - 3.3 [Purchase Request (PR) SOP](#33-purchase-request-pr-sop)
   - 3.4 [Purchase Order (PO) SOP](#34-purchase-order-po-sop)
   - 3.5 [Service Request (SR) SOP](#35-service-request-sr-sop)
   - 3.6 [Cash Request (CR) SOP](#36-cash-request-cr-sop)
4. [Step-by-Step User Guides](#4-step-by-step-user-guides)
5. [System Workflows](#5-system-workflows)
6. [Approval Matrix](#6-approval-matrix)
7. [Troubleshooting & Support](#7-troubleshooting--support)
8. [Security & Compliance](#8-security--compliance)
9. [Glossary](#9-glossary)

---

## 1. System Overview

### 1.1 About the System
The **JAJR Construction Procurement System** is an internal e-commerce platform designed to streamline the procurement process. It provides a structured workflow for requesting, approving, and tracking purchases across the organization.

### 1.2 Key Features
- **Multi-level Approval Workflow**: Four-stage approval process with role-based permissions
- **Real-time Notifications**: Instant alerts for status changes and approvals
- **Supplier Management**: Track suppliers, pricing, and preferred vendors
- **Purchase Tracking**: Monitor PRs and POs from creation to completion
- **Audit Trail**: Complete activity logging for compliance

### 1.3 System Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                     PROCUREMENT SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│  Frontend: React 19 + Vite + Tailwind CSS 4                    │
│  Backend:  Node.js + Express.js                                   │
│  Database: MySQL (via XAMPP/Docker)                              │
│  Real-time: Socket.IO                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Access Information
- **Development URL**: `http://localhost:5173`
- **API Endpoint**: `http://localhost:5000/api`
- **Database**: MySQL on port 3306

---

## 2. User Roles & Responsibilities

### 2.1 Role Summary

| Role | Code | Primary Function | Access Level |
|------|------|------------------|--------------|
| **Engineer** | `ENG` | Request items and receive goods | End User |
| **Procurement** | `PRO` | Review and validate requests | Reviewer |
| **Admin** | `ADMIN` | Create POs and manage suppliers | Processor |
| **Super Admin** | `SA` | Final approval authority | Approver |

### 2.2 Engineer (Requester)
**Responsibilities:**
- Browse available items in the catalog
- Create Purchase Requests (PR) for needed items
- View PR status and track progress
- Mark items as received upon delivery
- Track personal purchase history

**Permissions:**
- ✓ Browse items catalog
- ✓ Create/view own Purchase Requests
- ✓ Mark items as received
- ✗ Cannot approve requests
- ✗ Cannot manage suppliers/items
- ✗ Cannot create Purchase Orders

### 2.3 Procurement (Reviewer)
**Responsibilities:**
- Review approved PRs from Super Admin (first approval)
- Validate requests for procurement compliance
- Approve or reject with detailed reasons
- View all PRs and POs for monitoring
- Add/Edit items to the system catalog

**Permissions:**
- ✓ Review and approve/reject PRs
- ✓ Add/Edit items in catalog
- ✓ View all PRs and POs
- ✗ Cannot create POs
- ✗ Cannot manage suppliers
- ✗ Cannot mark items received

### 2.4 Admin (PO Creator)
**Responsibilities:**
- Add/Edit items to the system (without quantities)
- Add/Edit suppliers and their pricing
- Create Purchase Orders (PO) for fully approved PRs
- Manage supplier relationships
- Link items to suppliers with pricing

**Permissions:**
- ✓ Create Purchase Orders
- ✓ Manage suppliers and pricing
- ✓ Add/Edit items
- ✓ View all PRs and POs
- ✗ Cannot approve PRs
- ✗ Cannot receive items

### 2.5 Super Admin (Approver)
**Responsibilities:**
- Initial approval of PRs from Engineers
- Pre-final approval before Admin processing
- Final approval of POs after Admin places order
- View all PRs and POs for oversight
- System oversight and management

**Permissions:**
- ✓ First, second, and final PR/PO approval
- ✓ View all PRs and POs
- ✓ System oversight access
- ✗ Cannot create PRs/POs
- ✗ Cannot directly manage suppliers

---

## 3. Standard Operating Procedures

### 3.1 Item Management SOP

**Purpose**: Maintain an accurate catalog of available items for procurement.

**Applicable Roles**: Admin, Procurement

#### Procedure 3.1.1: Adding New Items

| Step | Action | Role | System Action |
|------|--------|------|---------------|
| 1 | Navigate to Items menu | Admin/Procurement | Display items list |
| 2 | Click "Add New Item" | Admin/Procurement | Open item form |
| 3 | Enter item details: | | |
| | - Item Code (unique) | Admin/Procurement | Validate uniqueness |
| | - Item Name (unique) | Admin/Procurement | Validate uniqueness |
| | - Description | Admin/Procurement | Store text |
| | - Category | Admin/Procurement | Link to categories |
| | - Unit (pc, kg, box, etc.) | Admin/Procurement | Define unit |
| 4 | Save item | Admin/Procurement | Record in `items` table |

**Business Rules:**
- Item codes and names must be unique
- Items are created without quantities (catalog-style, not inventory)
- Only Admin and Procurement can add items

#### Procedure 3.1.2: Linking Items to Suppliers

| Step | Action | Role | Expected Result |
|------|--------|------|-----------------|
| 1 | Navigate to Supplier Items | Admin | Display supplier-items list |
| 2 | Select Supplier | Admin | Show supplier details |
| 3 | Click "Add Item to Supplier" | Admin | Open linking form |
| 4 | Select Item from catalog | Admin | Auto-fill item details |
| 5 | Enter pricing information: | | |
| | - Unit Price | Admin | Required field |
| | - Lead Time (days) | Admin | Optional |
| | - Set as Preferred | Admin | Boolean flag |
| 6 | Save supplier-item link | Admin | Record in `supplier_items` table |

**Business Rules:**
- Multiple suppliers can provide the same item
- Only one preferred supplier per item
- Prices can be updated anytime by Admin

### 3.2 Supplier Management SOP

**Purpose**: Maintain supplier database with accurate contact and pricing information.

**Applicable Roles**: Admin

#### Procedure 3.2.1: Adding New Suppliers

| Step | Action | Role | Details |
|------|--------|------|---------|
| 1 | Navigate to Suppliers menu | Admin | Display suppliers list |
| 2 | Click "Add New Supplier" | Admin | Open supplier form |
| 3 | Enter supplier information: | | |
| | - Supplier Code (unique) | Admin | Format: SUP-XXXX |
| | - Supplier Name | Admin | Company name |
| | - Contact Person | Admin | Primary contact |
| | - Email | Admin | Valid email format |
| | - Phone | Admin | Contact number |
| | - Address | Admin | Full address |
| 4 | Set status to "Active" | Admin | Default status |
| 5 | Save supplier | Admin | Record in `suppliers` table |

#### Procedure 3.2.2: Updating Supplier Information

| Step | Action | Role | Notes |
|------|--------|------|-------|
| 1 | Search for supplier | Admin | Use code or name |
| 2 | Click Edit | Admin | Open edit form |
| 3 | Update required fields | Admin | Modify as needed |
| 4 | Save changes | Admin | Update `suppliers` table |

### 3.3 Purchase Request (PR) SOP

**Purpose**: Standardized process for requesting items through the system.

**Applicable Roles**: Engineer (Create), Procurement/Super Admin (Approve)

#### Procedure 3.3.1: Creating a Purchase Request

| Step | Action | Role | Screen/System |
|------|--------|------|---------------|
| 1 | Login to system | Engineer | Dashboard display |
| 2 | Navigate to "Purchase Requests" | Engineer | PR list view |
| 3 | Click "Create New PR" | Engineer | PR creation form |
| 4 | System generates PR Number | Auto | Format: PR-YYYY-XXXX |
| 5 | Select/Add items: | Engineer | | 
| | - Search catalog | Engineer | Item search |
| | - Enter quantity | Engineer | Required |
| | - Add remarks (optional) | Engineer | Per item |
| | - Click "Add to PR" | Engineer | Add to items list |
| 6 | Enter PR details: | | |
| | - Purpose | Engineer | Required |
| | - General Remarks | Engineer | Optional |
| 7 | Review PR summary | Engineer | Check totals |
| 8 | Submit PR | Engineer | Status: "Pending" |
| 9 | System notifications: | Auto | |
| | - Notify Super Admin | System | First approval needed |

**Business Rules:**
- PR numbers auto-generated: PR-YYYY-XXXX format
- At least one item required per PR
- Engineer can only create PRs for their needs
- Status immediately set to "Pending"

#### Procedure 3.3.2: PR Approval Workflow

**Stage 1: Super Admin First Review**

| Step | Action | Role | Status Change |
|------|--------|------|---------------|
| 1 | Receive notification | Super Admin | PR pending review |
| 2 | Navigate to "First Approval" | Super Admin | Pending PRs list |
| 3 | Review PR details | Super Admin | View items, purpose |
| 4 | Decision: | | |
| | **APPROVE**: Click "Approve" | Super Admin | → "For Procurement Review" |
| | **REJECT**: Click "Reject" + reason | Super Admin | → "Rejected" |
| 5 | System notification | Auto | Notify next approver or engineer |

**Stage 2: Procurement Review**

| Step | Action | Role | Status Change |
|------|--------|------|---------------|
| 1 | Receive notification | Procurement | PR ready for review |
| 2 | Navigate to "Procurement Review" | Procurement | PRs awaiting review |
| 3 | Review PR for compliance | Procurement | Check specifications |
| 4 | Decision: | | |
| | **APPROVE**: Click "Approve" | Procurement | → "For Super Admin Final Approval" |
| | **REJECT**: Click "Reject" + reason | Procurement | → "Rejected" |
| 5 | System notification | Auto | Notify Super Admin |

**Stage 3: Super Admin Final Review**

| Step | Action | Role | Status Change |
|------|--------|------|---------------|
| 1 | Receive notification | Super Admin | PR for final approval |
| 2 | Navigate to "Final Approval" | Super Admin | PRs list |
| 3 | Final review | Super Admin | Verify all stages |
| 4 | Decision: | | |
| | **APPROVE**: Click "Approve" | Super Admin | → "For Purchase" + notify Admin |
| | **REJECT**: Click "Reject" + reason | Super Admin | → "Rejected" + notify Engineer |

**Rejection Handling:**
- Rejection reason is **mandatory** for Procurement
- Optional but recommended for Super Admin
- Engineer receives notification with reason
- Engineer can revise and resubmit

### 3.4 Purchase Order (PO) SOP

**Purpose**: Convert approved PRs into actual purchase orders for suppliers.

**Applicable Roles**: Admin (Create), Super Admin (Approve), Engineer (Receive)

#### Procedure 3.4.1: Creating a Purchase Order

| Step | Action | Role | System/Notes |
|------|--------|------|--------------|
| 1 | Receive notification | Admin | PR approved for purchase |
| 2 | Navigate to "Approved PRs" | Admin | List of "For Purchase" PRs |
| 3 | Select PR to process | Admin | View PR details |
| 4 | Click "Create PO" | Admin | Open PO creation form |
| 5 | System generates PO Number | Auto | Format: PO-YYYY-XXXX |
| 6 | Select Supplier | Admin | From linked suppliers |
| 7 | Verify/Enter pricing: | | |
| | - Unit Price | Admin | From supplier or manual |
| | - Quantity | Admin | Pre-filled from PR |
| | - Total calculated | Auto | Unit × Qty |
| 8 | Set dates: | | |
| | - PO Date | Admin | Today (default) |
| | - Expected Delivery | Admin | Target date |
| 9 | Save as "Draft" | Admin | Can edit later |
| 10 | Submit PO | Admin | Status: "Draft" → "Ordered" |
| 11 | System notification | Auto | Notify Super Admin for final approval |

#### Procedure 3.4.2: PO Final Approval

| Step | Action | Role | Result |
|------|--------|------|--------|
| 1 | Receive notification | Super Admin | PO awaiting final approval |
| 2 | Navigate to "PO Final Approval" | Super Admin | List of ordered POs |
| 3 | Review PO details | Super Admin | Check supplier, pricing, dates |
| 4 | Decision: | | |
| | **APPROVE**: Click "Approve" | Super Admin | → "Confirmed" + notify Engineer |
| | **REJECT**: Click "Cancel" | Super Admin | → "Cancelled" + notify Admin |

#### Procedure 3.4.3: Item Receiving

| Step | Action | Role | Status Change |
|------|--------|------|---------------|
| 1 | Receive notification | Engineer | PO confirmed, items coming |
| 2 | Wait for physical delivery | Engineer | Real-world action |
| 3 | Navigate to "My PRs" | Engineer | List of PRs |
| 4 | Find PR with confirmed PO | Engineer | View items |
| 5 | Click "Mark as Received" | Engineer | Per item or all |
| 6 | Confirm receipt | Engineer | Status: "Received" |
| 7 | Check completion | System | If all items received → "Completed" |

### 3.5 Service Request (SR) SOP

**Purpose**: Request services (non-inventory items) through a simplified workflow.

**Applicable Roles**: Engineer (Create), Procurement (Approve), Admin (Pricing), Super Admin (Final)

#### Procedure 3.5.1: Creating a Service Request

| Step | Action | Role | Details |
|------|--------|------|---------|
| 1 | Navigate to "Service Requests" | Engineer | SR list view |
| 2 | Click "Create New SR" | Engineer | Open SR form |
| 3 | Enter service details: | | |
| | - Service Description | Engineer | Required |
| | - Scope of Work | Engineer | Detailed description |
| | - Estimated Budget | Engineer | Optional |
| | - Required Date | Engineer | Target completion |
| 4 | Submit SR | Engineer | Status: "Pending" |
| 5 | Notification to Procurement | Auto | Review needed |

#### Procedure 3.5.2: SR Approval Flow

| Stage | Approver | Action | Status Change |
|-------|----------|--------|---------------|
| 1 | Procurement | Review and approve | → "For Supplier Quote" |
| 2 | Admin | Enter pricing from supplier | → Awaiting final approval |
| 3 | Super Admin | Final approval | → "Approved" / Job Order issued |

### 3.6 Cash Request (CR) SOP

**Purpose**: Request cash advances for procurement-related expenses.

**Applicable Roles**: Any Employee (Create), Department Head (if >3 days), Super Admin (Final), Finance (Release)

#### Procedure 3.6.1: Creating a Cash Request

| Step | Action | Role | Details |
|------|--------|------|---------|
| 1 | Navigate to "Cash Requests" | Employee | CR list |
| 2 | Click "Create New CR" | Employee | Open CR form |
| 3 | Enter request details: | | |
| | - Amount | Employee | Required |
| | - Purpose | Employee | Detailed reason |
| | - Needed By Date | Employee | Critical field |
| | - Attachments | Employee | Supporting docs |
| 4 | Submit CR | Employee | Status determined by date |

#### Procedure 3.6.2: CR Approval Path

| Condition | Path | Approvers |
|-----------|------|-----------|
| **Immediate Need** (< 3 days) | Expedited | Super Admin → Finance |
| **Normal Need** (≥ 3 days) | Standard | Department Head → Super Admin → Finance |

| Step | Action | Role | Status |
|------|--------|------|--------|
| 1 | Review request | Dept Head / Super Admin | Evaluate urgency |
| 2 | Approve/Request revision | Approver | With comments |
| 3 | Final approval | Super Admin | Authorize release |
| 4 | Release cash | Finance | → "Released" |
| 5 | Acknowledge receipt | Employee | → "Closed" |

---

## 4. Step-by-Step User Guides

### 4.1 Engineer Quick Start Guide

#### First-Time Login
```
1. Open browser to: http://localhost:5173
2. Enter credentials:
   - Employee No: ENG-2026-0001
   - Password: jajrconstruction
3. Click "Login"
4. View Dashboard with summary stats
```

#### Creating Your First Purchase Request
```
Step 1: Browse Items
├─ Click "Items" in left sidebar
├─ Use search bar to find needed items
└─ Note item codes for quick access

Step 2: Create PR
├─ Click "Purchase Requests" → "Create New"
├─ Click "Add Item"
├─ Search and select item
├─ Enter quantity needed
├─ Add remarks (optional)
├─ Click "Add to PR"
└─ Repeat for multiple items

Step 3: Complete PR
├─ Enter Purpose (required)
├─ Add general remarks (optional)
├─ Review total amount
├─ Click "Submit PR"
└─ Note your PR number (PR-YYYY-XXXX)

Step 4: Track Status
├─ Go to "My Purchase Requests"
├─ View status column
├─ Click on PR to see detailed status
└─ Wait for approval notifications

Step 5: Receive Items
├─ Wait for "Confirmed" notification
├─ Receive physical items
├─ Go to PR → "Mark as Received"
└─ Confirm receipt date
```

### 4.2 Procurement User Guide

#### Daily Workflow
```
Morning Routine:
1. Login and check notifications
2. Review "Pending Procurement Review" list
3. Check any rejected PRs needing feedback

Processing PRs:
1. Click on PR to review
2. Check:
   ✓ Item specifications clear?
   ✓ Quantities reasonable?
   ✓ Purpose documented?
3. If OK → Click "Approve"
4. If Issues → Click "Reject" + detailed reason
5. Move to next PR

Item Management:
1. Review new item requests
2. Add items to catalog if needed
3. Update existing item information
4. Ensure catalog is current
```

### 4.3 Admin User Guide

#### Supplier Management Workflow
```
Weekly Tasks:
1. Review supplier performance
2. Update pricing as needed
3. Add new suppliers
4. Deactivate non-performing suppliers

Creating POs:
1. Check "PRs For Purchase" daily
2. For each PR:
   a. Canvas suppliers (real-world)
   b. Select best supplier in system
   c. Create PO with actual pricing
   d. Submit for final approval
3. Track PO status
```

### 4.4 Super Admin User Guide

#### Approval Dashboard
```
Daily Review:
1. Login → Dashboard shows pending counts
2. Process in priority order:
   a. First Approvals (new PRs)
   b. Final Approvals (pre-approved PRs)
   c. PO Final Approvals

Approval Criteria:
✓ Budget availability
✓ Business justification
✓ Previous purchase history
✓ Urgency level

Rejection Best Practices:
• Always provide clear reason
• Suggest alternative solutions
• Set expectations for resubmission
```

---

## 5. System Workflows

### 5.1 Complete PR to PO Flow

```
┌──────────────┐
│   Engineer   │
│  Creates PR  │
│   PENDING    │
└──────┬───────┘
       │
       ▼
┌──────────────┐    NO    ┌──────────────┐
│ Super Admin  │─────────>│   Engineer   │
│ 1st Review   │          │  Rejected    │
│  Approve?    │          │ (notified)   │
└──────┬───────┘          └──────────────┘
     YES │
       │
       ▼
┌──────────────┐
│ FOR PROCURE  │
│   REVIEW     │
└──────┬───────┘
       │
       ▼
┌──────────────┐    NO    ┌──────────────┐
│ Procurement  │─────────>│   Engineer   │
│   Review     │          │  Rejected    │
│  Approve?    │          │ with reason  │
└──────┬───────┘          └──────────────┘
     YES │
       │
       ▼
┌──────────────┐
│ FOR SUPER    │
│ FINAL APPROV │
└──────┬───────┘
       │
       ▼
┌──────────────┐    NO    ┌──────────────┐
│ Super Admin  │─────────>│   Engineer   │
│ Final Review │          │  Rejected    │
│  Approve?    │          │ (notified)   │
└──────┬───────┘          └──────────────┘
     YES │
       │
       ▼
┌──────────────┐
│ FOR PURCHASE │
│ notify Admin │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Admin     │
│  Creates PO  │
│    DRAFT     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Admin Places │
│    Order     │
│   ORDERED    │
└──────┬───────┘
       │
       ▼
┌──────────────┐    NO    ┌──────────────┐
│ Super Admin  │─────────>│    Admin     │
│ PO Final Apv │          │  CANCELLED   │
│  Approve?    │          │ (notified)   │
└──────┬───────┘          └──────────────┘
     YES │
       │
       ▼
┌──────────────┐
│  CONFIRMED   │
│ notify Eng.  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Engineer   │
│   Receives   │
│   RECEIVED   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  COMPLETED   │
│ (all items)  │
└──────────────┘
```

### 5.2 Status Definitions

| Status | Meaning | Next Action |
|--------|---------|-------------|
| **Pending** | PR created, awaiting first approval | Super Admin review |
| **For Procurement Review** | Super Admin approved, needs procurement check | Procurement review |
| **For Super Admin Final Approval** | Procurement approved, needs final OK | Super Admin final review |
| **For Purchase** | Fully approved, ready for PO creation | Admin creates PO |
| **Completed** | All items received | None - archived |
| **Rejected** | Not approved at some stage | Engineer revises |
| **Cancelled** | PO cancelled after ordering | Admin handles |

### 5.3 Notification Matrix

| Event | Recipient | Notification Type |
|-------|-----------|-------------------|
| PR Created | Super Admin | First approval needed |
| PR Approved (1st) | Procurement | Review needed |
| PR Approved (Proc) | Super Admin | Final approval needed |
| PR Fully Approved | Admin | Create PO |
| PR Rejected | Engineer | Revision needed |
| PO Created | Super Admin | Final approval |
| PO Confirmed | Engineer | Items coming |
| PO Cancelled | Admin | Handle cancellation |
| Items Received | System | Check completion |
| SR/CR Status Change | Relevant parties | Action needed |

---

## 6. Approval Matrix

### 6.1 Purchase Request Approvals

| Amount Range | 1st Approval | 2nd Approval | Final Approval |
|--------------|--------------|--------------|----------------|
| All amounts | Super Admin | Procurement | Super Admin |

### 6.2 Purchase Order Approvals

| Stage | Approver | Authority |
|-------|----------|-----------|
| PO Creation | Admin | After PR fully approved |
| PO Final | Super Admin | Before confirming to Engineer |

### 6.3 Other Requests

| Request Type | Department Head | Super Admin | Finance |
|--------------|-------------------|-------------|---------|
| Cash Request (< 3 days) | - | Required | Release |
| Cash Request (≥ 3 days) | Required | Required | Release |
| Service Request | - | Final only | - |
| Reimbursement | - | Required | Release |

---

## 7. Troubleshooting & Support

### 7.1 Common Issues & Solutions

#### Issue: Cannot Login
```
Symptom: "Invalid credentials" error

Solutions:
1. Check Caps Lock is off
2. Verify Employee Number format (ENG-YYYY-XXXX)
3. Default password: jajrconstruction
4. Contact Admin if password forgotten
5. Check if account is active
```

#### Issue: PR Stuck in "Pending"
```
Symptom: PR created but no approval for days

Solutions:
1. Check notifications sent (Dashboard bell)
2. Contact Super Admin directly
3. Verify PR was actually submitted (not saved as draft)
4. Check if all required fields completed
```

#### Issue: Cannot Find Item in Catalog
```
Symptom: Item search returns no results

Solutions:
1. Try different search terms
2. Check with Procurement/Admin if item exists
3. Request item addition if new
4. Use similar item code pattern
```

#### Issue: "Database Connection Failed"
```
Symptom: Error on backend startup

Solutions:
1. Verify XAMPP MySQL is running
2. Check port 3306 is available
3. Verify .env DB credentials
4. Check if database exists: npm run setup-db
5. Restart MySQL service
```

#### Issue: CORS Errors in Browser
```
Symptom: "Access-Control-Allow-Origin" errors

Solutions:
1. Check backend .env CORS_ALLOWED_ORIGINS
2. Ensure it includes frontend URL (http://localhost:5173)
3. Restart backend after .env changes
4. Verify API URL in frontend .env
```

### 7.2 System Maintenance

#### Daily Maintenance (Admin)
- Check error logs
- Monitor notification queue
- Review pending approvals older than 24 hours

#### Weekly Maintenance (Admin)
- Backup database
- Review and archive completed PRs/POs
- Update supplier pricing if needed
- Generate weekly reports

#### Monthly Maintenance (Super Admin)
- Review user access
- Audit approval times
- Generate procurement reports
- Review system performance

### 7.3 Support Contacts

| Issue Type | Contact | Escalation |
|------------|---------|------------|
| Login/Access | Admin | Super Admin |
| Approval Delays | Direct approver | Super Admin |
| Technical Issues | IT Support | System Admin |
| Training Needed | Department Head | HR |
| Data Corrections | Super Admin | Management |

---

## 8. Security & Compliance

### 8.1 Security Requirements

#### Password Policy
- Minimum 8 characters
- Must be changed every 90 days
- Cannot reuse last 5 passwords
- Account locked after 5 failed attempts

#### Session Management
- Auto-logout after 30 minutes inactivity
- Single session per user
- JWT tokens expire in 24 hours

#### Data Access
- Role-based access control (RBAC)
- Users can only view their own data
- Admins can view all data
- Audit logs record all actions

### 8.2 Compliance Checklist

#### For Engineers
- [ ] PR purpose clearly documented
- [ ] Quantities justified
- [ ] Items received within 30 days
- [ ] Receipts acknowledged promptly

#### For Procurement
- [ ] All PRs reviewed within 24 hours
- [ ] Rejection reasons documented
- [ ] Supplier compliance verified
- [ ] Pricing validated

#### For Admin
- [ ] POs created within 48 hours of approval
- [ ] Supplier information current
- [ ] Pricing updated monthly
- [ ] Delivery dates tracked

#### For Super Admin
- [ ] Approvals given within SLA
- [ ] Budget availability verified
- [ ] Audit trail maintained
- [ ] Monthly reviews conducted

### 8.3 Audit Trail

All actions are logged in `activity_logs` table:
- User ID
- Action performed
- Record affected
- Timestamp
- IP address
- User agent

**Retention**: 7 years

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **PR** | Purchase Request - Initial request for items |
| **PO** | Purchase Order - Official order to supplier |
| **SR** | Service Request - Request for services |
| **CR** | Cash Request - Request for cash advance |
| **Canvassing** | Process of getting quotes from suppliers |
| **Lead Time** | Days required for supplier delivery |
| **Preferred Supplier** | Default supplier for an item |
| **Job Order** | Official work assignment to service provider |
| **Disbursement Voucher** | Document for payment release |
| **Procurement** | Process of acquiring goods/services |
| **SLA** | Service Level Agreement - Response time commitment |
| **RBAC** | Role-Based Access Control |
| **JWT** | JSON Web Token - Authentication method |

---

## Appendices

### Appendix A: Default Login Credentials

| Role | Employee Number | Password |
|------|-----------------|----------|
| Engineer | ENG-2026-0001 | jajrconstruction |
| Procurement | PRO-2026-0001 | jajrconstruction |
| Admin | ADMIN-2026-0001 | jajrconstruction |
| Super Admin | SA-2026-004 | jajrconstruction |

### Appendix B: File Locations

| Component | Path |
|-----------|------|
| Frontend | `c:\wamp64\www\procurement\Procurement\frontend\` |
| Backend | `c:\wamp64\www\procurement\Procurement\backend\` |
| Database Scripts | `c:\wamp64\www\procurement\Procurement\backend\database\` |
| Documentation | `c:\wamps64\www\procurement\Procurement\docs\` |
| Excel Templates | `c:\wamp64\www\procurement\Procurement\*.xlsx` |

### Appendix C: Database Backup Procedure

```bash
# Using MySQL Dump
mysqldump -u root -p procurement_db > backup_$(date +%Y%m%d).sql

# Restore from backup
mysql -u root -p procurement_db < backup_YYYYMMDD.sql
```

### Appendix D: System Startup Checklist

```
Pre-Flight Check:
□ XAMPP MySQL started
□ Backend dependencies installed (npm install)
□ Frontend dependencies installed (npm install)
□ Backend .env configured
□ Frontend .env configured
□ Database initialized (npm run setup-db)
□ Port 5000 available
□ Port 5173 available
□ Port 3306 available (MySQL)

Startup:
1. Terminal 1: cd backend && npm run dev
2. Terminal 2: cd frontend && npm run dev
3. Verify: http://localhost:5000/api/health
4. Open: http://localhost:5173
```

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-02 | System Admin | Initial release |

**Next Review Date**: 2026-08-02

**Document Owner**: Procurement Department

---
*End of Document*
