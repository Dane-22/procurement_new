# Purchase Request to Disbursement Voucher Process
## A User Guide for Procurement Staff

---

## What This Guide Covers

This guide explains how a Purchase Request (PR) moves through the system until a Disbursement Voucher (DV) is created. Depending on how the payment will be made, there are **two different paths** the PR can take.

---

## The Two Paths Explained

### Path 1: Regular Procurement (With Supplier Account)
**Use this when:** Buying from a supplier who gives us credit/terms

**The flow:**
```
Engineer creates PR → Procurement reviews it → Super Admin approves it 
→ Admin creates Purchase Order → Admin creates Disbursement Voucher
```

### Path 2: Direct Payment (Without Supplier Account)
**Use this when:** Paying immediately or buying from someone without credit terms

**The flow:**
```
Engineer creates PR → Procurement reviews it → Super Admin approves it 
→ Admin creates Payment Request → Admin creates Disbursement Voucher
```

---

## Detailed Step-by-Step Process

### STEP 1: Engineer Creates the Purchase Request

**Who does this:** Engineer (the person requesting the items/services)

**What they do:**
1. Log into the system and go to "Purchase Requests"
2. Click "Create New PR"
3. Fill in the form:
   - **Purpose** - Why do we need these items?
   - **Items needed** - What to buy, how many, estimated price
   - **Date needed** - When must we receive these?
   - **Project** - Which project is this for?
   - **Order number** - Project reference number
   - **Payment Basis** - ⚠️ **IMPORTANT: This decides the path!**

**Choosing Payment Basis:**
- Select **"Debt / With Account"** if the supplier gives us credit/payment terms
- Select **"Non-Debt / Without Account"** if paying immediately or no credit terms

**Save options:**
- **Save as Draft** - Work on it later (only you can see it)
- **Submit** - Send to Procurement for review

**Important notes:**
- If you choose "Debt," you MUST add payment schedules showing when payments will be made
- The total of all payment schedules must equal the total amount of items
- Once submitted, Procurement gets a notification

---

### STEP 2: Procurement Reviews the PR

**Who does this:** Procurement Officer

**What they do:**
1. Go to "Approvals" and click the "Purchase Requests" tab
2. Find PRs with status "For Procurement Review"
3. Open the PR and review:
   - Are the items correct?
   - Are the quantities reasonable?
   - Can we get better prices?

**Decision options:**

**A) APPROVE the PR**
- Select/confirm the supplier who will provide these items
- Set the final unit prices (may be different from engineer's estimate)
- Adjust quantities if needed
- PR status changes to: "For Super Admin Final Approval"

**B) REJECT the PR**
- Add rejection reason
- Add remarks for specific items if needed
- PR status changes to: "Rejected"
- Engineer gets notified and can fix and resubmit

**What happens after approval:**
- Super Admin gets notified to do final approval
- Engineer gets notified if prices or quantities were changed

---

### STEP 3: Super Admin Gives Final Approval

**Who does this:** Super Admin

**What they do:**
1. Go to "Approvals" and check PRs waiting for final approval
2. Review the PR with Procurement's changes

**Decision options:**

**A) APPROVE**
- PR is now ready for the next step
- Status changes to: "For Purchase"
- Admin gets notified to create PO or Payment Request

**B) HOLD**
- Temporarily pause the PR
- Status changes to: "On Hold"
- Engineer gets notified with reason

**C) REJECT**
- Send back to Procurement or Engineer
- Status changes to: "For Procurement Review" or "Rejected"
- Add remarks explaining why

---

### STEP 4A: Create Purchase Order (Regular Procurement Path)

**Who does this:** Admin

**When:** PR status is "For Purchase" AND Payment Basis was "Debt"

**What they do:**
1. Go to "Purchase Orders"
2. Click "Create PO from PR"
3. Select the approved PR
4. Fill in PO details:
   - Expected delivery date
   - Delivery location
   - Delivery terms (usually COD - Cash on Delivery)
   - Payment terms (copied from PR)
   - Any special notes

**Save options:**
- **Save as Draft** - Work on it more later
- **Submit** - Send to Super Admin for PO approval

**What happens:**
- PR status updates to: "PO Created"
- PO gets a number (format: INITIALS-YYYY-MM-###)
- Super Admin gets notified to approve the PO

---

### STEP 4B: Create Payment Request (Direct Payment Path)

**Who does this:** Admin

**When:** PR status is "For Purchase" AND Payment Basis was "Non-Debt"

**What they do:**
1. Go to "Payment Requests"
2. Click "Create from PR"
3. Select the approved PR
4. Fill in payment details

**Important rule:**
- PRs marked "Non-Debt" **CANNOT** create Purchase Orders
- The system will block this and show an error
- You must use Payment Request instead

**Save options:**
- **Save as Draft** - Work on it more later
- **Submit** - Send to Super Admin for approval

**What happens:**
- PR status updates to: "Payment Request Created"
- When Super Admin approves the Payment Request:
  - Payment Request status: "Approved"
  - PR status: "Completed"

---

### STEP 5: Create Disbursement Voucher

**Who does this:** Admin

**When:** The Purchase Order or Payment Request is approved

**What they do:**
1. Go to "Disbursement Vouchers"
2. Click "Create New DV"
3. Select the source document:
   - Purchase Order (if regular procurement path)
   - Payment Request (if direct payment path)
4. Select a **Payment Schedule** (required):
   - This determines the payment date and amount
   - Only available schedules are shown
5. Fill in DV details:
   - Particulars (description of what we're paying for)
   - Project name
   - Order number
   - Check number (if known)
   - Bank name
   - Who will receive the payment

**Save options:**
- **Save as Draft** - Not yet ready for processing
- **Submit** - Ready for Accounting certification

**What happens:**
- DV gets a number (format: YYYY-MM-###, e.g., 2026-04-001)
- Amount is locked based on the selected payment schedule
- For Payment Request-based DVs: Payment Request status changes to "DV Created"
- System prevents creating duplicate DVs for the same payment date

---

## Understanding Status Labels

### Purchase Request Statuses

| Status | What It Means | Who Acts Next |
|--------|---------------|---------------|
| Draft | Saved but not yet sent | Engineer (to submit) |
| For Procurement Review | Waiting for Procurement to check | Procurement Officer |
| For Super Admin Final Approval | Procurement approved, needs final OK | Super Admin |
| On Hold | Temporarily stopped | Super Admin (to resume) |
| Rejected | Sent back for changes | Engineer (to fix and resubmit) |
| For Purchase | Fully approved, ready for next step | Admin (to create PO or Payment Request) |
| PO Created | Purchase Order made from this PR | System (waiting for PO approval) |
| Payment Request Created | Payment Request made from this PR | System (waiting for Payment Request approval) |
| Completed | Fully processed and finished | No further action |

### Purchase Order Statuses

| Status | What It Means | Who Acts Next |
|--------|---------------|---------------|
| Draft | Saved but not submitted | Admin (to submit) |
| Pending Approval | Waiting for Super Admin approval | Super Admin |
| On Hold | Temporarily paused | Super Admin |
| Approved | Ready to create DV from | Admin (to create DV) |

### Payment Request Statuses

| Status | What It Means | Who Acts Next |
|--------|---------------|---------------|
| Draft | Saved but not submitted | Admin (to submit) |
| Pending / For Approval | Waiting for Super Admin | Super Admin |
| On Hold | Temporarily paused | Super Admin |
| Approved | Ready to create DV from | Admin (to create DV) |
| DV Created | DV already made from this | System (no further action) |

### Disbursement Voucher Statuses

| Status | What It Means | Who Acts Next |
|--------|---------------|---------------|
| Draft | Saved but not ready | Admin (to submit) |
| Pending | Waiting for Accounting certification | Accounting Staff |
| Approved | Certified, ready to pay | Admin (to release payment) |
| Paid | Payment completed | No further action |
| Cancelled | Voided/cancelled | No further action |

---

## Important Rules to Remember

### Payment Schedules (For Debt/With Account PRs Only)

**What they are:** A plan showing when payments will be made to the supplier

**Rules:**
- Required for all "Debt" PRs
- The total of all payment schedules must equal the total PR amount
- Each schedule needs a payment date
- Cannot have two schedules on the same date
- Used when creating DVs to determine payment dates

### Supplier Selection

**How it works:**
- Engineer can suggest a supplier when creating PR
- Procurement **must** confirm or select the supplier during review
- Supplier address comes from the supplier master list automatically

### Order Number Locking

**What it means:**
- Some order numbers can be "locked" to prevent changes
- If an order number is locked, you cannot approve or modify documents using it
- Contact an Admin to unlock if needed

---

## Common Problems and How to Fix Them

### Problem: Cannot create Purchase Order from PR
**Why:** The PR was marked as "Non-Debt / Without Account"
**Fix:** Use Payment Request instead - the system doesn't allow POs for non-debt PRs

### Problem: Cannot create DV - "No payment schedules available"
**Why:** The PR or source document doesn't have payment schedules set up
**Fix:** 
- For PR-based documents: Go back to the PR and add payment schedules
- For other documents: Check if payment schedules were configured

### Problem: Cannot create DV - "Selected payment schedule is invalid"
**Why:** Someone already created a DV for that payment date
**Fix:** 
- Choose a different payment schedule date
- Or cancel the existing DV first

### Problem: Cannot approve - "Order number is locked"
**Why:** The order number is locked to prevent changes
**Fix:** Contact an Admin to unlock the order number in Order Numbers management

---

## Quick Reference: Which Path to Use?

| Scenario | Payment Basis | Path | Next Document |
|----------|---------------|------|---------------|
| Buying from regular supplier with credit terms | Debt / With Account | Path 1 | Purchase Order |
| Immediate payment needed | Non-Debt / Without Account | Path 2 | Payment Request |
| No supplier account established | Non-Debt / Without Account | Path 2 | Payment Request |
| Paying for services (not goods) | Depends on agreement | Usually Path 2 | Payment Request |

---

## Summary Checklist

### For Engineers:
- [ ] Fill out PR completely
- [ ] Choose correct Payment Basis (crucial!)
- [ ] Add payment schedules if "Debt"
- [ ] Submit for review
- [ ] Check notifications for feedback

### For Procurement:
- [ ] Review PR details and items
- [ ] Confirm supplier
- [ ] Set final prices
- [ ] Approve or reject with clear remarks

### For Super Admin:
- [ ] Review Procurement's changes
- [ ] Give final approval or hold/reject with reason

### For Admin:
- [ ] Check if PR is "For Purchase"
- [ ] Check Payment Basis to know which path
- [ ] Create PO (if debt) or Payment Request (if non-debt)
- [ ] Get approvals on PO/Payment Request
- [ ] Create DV from approved document
- [ ] Select payment schedule
- [ ] Submit DV for certification

---

## Questions?

Contact your system administrator or refer to other workflow guides:
- Overall Procurement Process
- Purchase Order Approval Details
- PR Approval Details
- Payment Schedule Guide

---

*Document Version: 1.0*  
*Created: April 2026*  
*For: Procurement Management System Users*
