# Procurement System Flowchart

## 1. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROCUREMENT SYSTEM                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROCUREMENT SYSTEM                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   ENGINEER   │      │    ADMIN     │      │ SUPER ADMIN  │
│   (Requester)│      │(PO Creator)  │      │  (Approver)  │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │  1. Create PR       │                     │
       │────────────────────>│                     │
       │                     │                     │
       │  2. Admin Review    │                     │
       │<────────────────────│                     │
       │                     │                     │
       │                     │  3. Create PO       │
       │                     │─────┐               │
       │                     │     │               │
       │                     │<────┘               │
       │                     │                     │
       │                     │  4. Final Approval  │
       │                     │────────────────────>│
       │                     │                     │
       │  5. Receive Items   │                     │
       │<──────────────────────────────────────────│
       │                     │                     │
       ▼                     ▼                     ▼
```

---

## 2. PURCHASE REQUEST (PR) APPROVAL FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     PR APPROVAL FLOW - OVERVIEW                              │
│                                                                              │
│  Engineer → Engineer Review → Admin Review → Super Admin│
└──────────────────────────────────────────────────────────────────────────────┘

─────────────────────────────────────
 STEP 1: Engineer Creates PR
─────────────────────────────────────

┌─────────────────┐
│  Engineer       │
│  Creates PR     │
│  Status: PENDING│
└────────┬────────┘
         │
         ▼

─────────────────────────────────────
 STEP 2: Engineer(s) Review PR
─────────────────────────────────────

┌──────────────────────────────┐
│ All Engineers                │
│ Review PR                    │
│ (Each Engineer must respond) │
└──────────────┬───────────────┘
               │
      ┌────────┴────────┐
      │                 │
   ALL APPROVE      ANY DISAPPROVE
      │                 │
      ▼                 ▼
(Proceed to       ┌─────────────────────────┐
 Step 3)          │ PR sent back to the     │
                  │ Engineer who created it │
                  │ to EDIT the PR          │
                  │ (Notifies requester)    │
                  │ Status: RETURNED        │
                  └─────────────────────────┘
                            │
                            ▼
                  ┌─────────────────────────┐
                  │ Engineer edits & re-    │
                  │ submits PR              │
                  │ Status: PENDING         │
                  └─────────────┬───────────┘
                                │
                                └──► (Back to Step 2)

─────────────────────────────────────
 STEP 3: Admin Review PR
─────────────────────────────────────

┌──────────────────────────────┐
│ All Admins                   │
│ Review PR                    │
│ (Each Admin must respond)    │
└──────────────┬───────────────┘
               │
      ┌────────┴────────┐
      │                 │
   ALL APPROVE      ANY DISAPPROVE
      │                 │
      ▼                 ▼
┌─────────────┐   ┌─────────────────────────┐
│   Status:   │   │ PR sent back to the     │
│ APPROVED    │   │ Engineer who created it │
└─────────────┘   │ to EDIT the PR          │
      │             │ (Notifies requester)    │
      ▼             │ Status: RETURNED        │
┌────────────────────────┐  └─────────────────────────┘
│  Final Approval (All    │            │
│  Super Admin Reps)     │            ▼
└──────────────┬─────────┘   ┌─────────────────────────┐
               │             │ Engineer edits & re-    │
     ┌─────────┴─────────┐   │ submits PR              │
     │                   │   │ Status: PENDING         │
   ALL APPROVE      ANY DISAPPROVE └─────────────┬───────────┘
     │                   │                     │
     ▼                   ▼                     └──► (Back to Step 2)
┌─────────────┐   ┌─────────────────────────┐
│   Status:   │   │ PR sent back to the     │
│ APPROVED    │   │ Engineer who created it │
└─────────────┘   │ to EDIT the PR          │
      │             │ (Notifies requester)    │
      ▼             │ Status: RETURNED        │
┌────────────────────────┐  └─────────────────────────┘
│  Receive Items         │            │
│  (Engineer confirms)     │            ▼
└──────────────┬─────────┘   ┌─────────────────────────┐
               │             │ Engineer edits & re-    │
     ┌─────────┴────────┐    │ submits PR              │
     │                  │    │ Status: PENDING         │
   CONFIRMED        NOT CONFIRMED └─────────────┬───────────┘
     │                                           │
     ▼                                           └──► (Back to Step 2)
┌─────────────┐
│   Status:   │
│  COMPLETED  │
└─────────────┘
```
                            │
                            ▼
                  ┌─────────────────────────┐
                  │ Engineer edits & re-    │
                  │ submits PR              │
                  │ Status: PENDING         │
                  └─────────────┬───────────┘
                                │
                                └──► (Back to Step 2)

─────────────────────────────────────
 STEP 4: Super Admin Rep Review PR
─────────────────────────────────────

┌──────────────────────────────┐
│ All Super Admin Reps         │
│ Review PR                    │
│ (Each Rep must respond)      │
└──────────────┬───────────────┘
               │
      ┌────────┴────────┐
      │                 │
   ALL APPROVE      ANY DISAPPROVE
      │                 │
      ▼                 ▼
┌─────────────┐   ┌─────────────────────────┐
│ Check Amount│   │ PR sent back to the     │
│ < 10,000 -> │   │ Engineer who created it │
│ FOR PURCHASE│   │ to EDIT the PR          │
│ >= 10,000 ->│   │ (Notifies requester)    │
│ Proceed to  │   │ Status: RETURNED        │
│ Step 5      │   └─────────────────────────┘
                            │
                            ▼
                  ┌─────────────────────────┐
                  │ Engineer edits & re-    │
                  │ submits PR              │
                  │ Status: PENDING         │
                  └─────────────┬───────────┘
                                │
                                └──► (Back to Step 2)

─────────────────────────────────────
 STEP 5: Super Admin Review PR
─────────────────────────────────────

┌──────────────────────────────┐
│ Super Admin                  │
│ Reviews PR                   │
└──────────────┬───────────────┘
               │
      ┌────────┴────────┐
      │                 │
   APPROVED         DISAPPROVED
      │                 │
      ▼                 ▼
┌─────────────────┐  ┌─────────────────────────┐
│ Status:         │  │ PR sent back to the     │
│ FOR PURCHASE    │  │ Engineer who created it │
│ Notify Admin    │  │ to EDIT the PR          │
└─────────────────┘  │ (Notifies requester)    │
                  │ Status: RETURNED        │
                     └─────────────────────────┘
                               │
                               ▼
                     ┌─────────────────────────┐
                     │ Engineer edits & re-    │
                     │ submits PR              │
                     │ Status: PENDING         │
                     └─────────────┬───────────┘
                                   │
                                   └──► (Back to Step 2)
```

---

## 2.1 PURCHASE REQUEST - UNACCREDITED SUPPLIER FLOW

```text
┌─────────────────┐
│ Engineer        │
│ Creates PR      │
│ (Unaccredited   │
│  Supplier)      │
└────────┬────────┘
         │
         │ (Reviewers are purposefully NOT assigned yet)
         ▼
┌─────────────────┐
│ Status: PENDING │
│ ACCREDITATION   │
│ REVIEW          │
└────────┬────────┘
         │
         │ Super Admin goes to Suppliers tab
         │ and accredits the supplier
         ▼
┌─────────────────┐
│ Status updates  │
│ to FOR ENGINEER │
│ REVIEW          │
│ (or appropriate │
│ review status)  │
└────────┬────────┘
         │
         │ System dynamically assigns required reviewers
         │ based on requester role.
         ▼
┌─────────────────┐
│ Reviewers       │
│ click "For      │
│ Reviews" tab    │
└────────┬────────┘
         │
         │ Frontend safely renders the PR row because
         │ state is clean and reviewers were just attached.
         ▼
┌─────────────────┐
│ Proceed to      │
│ normal PR       │
│ Review Flow     │
└─────────────────┘
```

---

## 2.2 PURCHASE REQUEST - BYPASS FLOW

```text
┌─────────────────┐
│ Engineer        │
│ Creates PR      │
│ Status: PENDING │
└────────┬────────┘
         │
         ▼
┌───────────────────────────┐
│ Super Admin (Any Amount)  │
│           OR              │
│ Super Admin Rep (<10,000) │
└────────┬──────────────────┘
         │
         │ Clicks "Bypass Approvals"
         ▼
┌───────────────────────────┐
│ Status: FOR PURCHASE      │
│ - Approves PR directly    │
│ - Notifies all pending    │
│   reviewers               │
│ - Sets is_bypassed = 1    │
└───────────────────────────┘
```

---

## 2.3 ITEM REQUEST FLOW (MOBILE APP)

```text
┌─────────────────┐
│ Engineer        │
│ Creates Item    │
│ Request         │
│ (Mobile App)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Status: FOR     │
│ ADMIN PROCESSING│
└────────┬────────┘
         │
         │ Admin enters supplier
         │ and pricing info
         ▼
┌─────────────────┐
│ Status: FOR     │
│ ENGINEER REVIEW │
│ (Admin Review   │
│ is auto-approved│
│ since Admin     │
│ processed it)   │
└────────┬────────┘
         │
         │ All Engineers Review
         ▼
┌─────────────────┐
│ Status: FOR     │
│ SUPER ADMIN REP │
│ REVIEW          │
└────────┬────────┘
         │
         ▼
(Proceed to Super Admin Rep Review)
```

---

## 3. PURCHASE ORDER (PO) FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     PO FLOW - OVERVIEW                                       │
│                                                                              │
│  PR Approved → Admin Creates PO → All Admins Review → Admin Places Order     │
│  → Super Admin Notified → Super Admin Approves → Engineer Receives Items     │
└──────────────────────────────────────────────────────────────────────────────┘

─────────────────────────────────────
 STEP 1: PR Approved (For Purchase)
─────────────────────────────────────

┌─────────────────┐
│  PR Approved    │
│  (For Purchase) │
└────────┬────────┘
         │
         ▼

─────────────────────────────────────
 STEP 2: Admin Creates Purchase Order
─────────────────────────────────────

┌─────────────────┐
│  Admin Creates  │
│  Purchase Order │
│  Status: DRAFT  │
└────────┬────────┘
         │
         ▼

─────────────────────────────────────
 STEP 3: All Admins Review PO
─────────────────────────────────────

┌──────────────────────────────┐
│ All Admins                   │
│ Review PO                    │
│ (Each Admin must respond)    │
└──────────────┬───────────────┘
               │
      ┌────────┴────────┐
      │                 │
   ALL APPROVE      ANY REJECT
      │                 │
      ▼                 ▼
(Proceed to       ┌─────────────────────────┐
 Step 5)          │ PO sent back to the     │
                  │ Admin who created it    │
                  │ to EDIT the PO          │
                  │ (Notifies requester)    │
                  │ Status: REJECTED        │
                  └─────────────────────────┘
                            │
                            ▼
                  ┌─────────────────────────┐
                  │ Admin edits & re-       │
                  │ submits PO              │
                  │ Status: DRAFT           │
                  └─────────────┬───────────┘
                                │
                                └──► (Back to Step 3)

─────────────────────────────────────
 STEP 4: Admin Places Order
─────────────────────────────────────

┌─────────────────────────────────┐
│ Admin Places Order              │
│ (Real World Action)             │
│ Status: ORDERED                 │
└────────────────┬────────────────┘
                 │
                 ▼

─────────────────────────────────────
 STEP 5: Super Admin Notified
─────────────────────────────────────

┌─────────────────────────────────┐
│ Super Admin is Notified         │
│ that the order has been placed  │
└────────────────┬────────────────┘
                 │
                 ▼

─────────────────────────────────────
 STEP 6: Super Admin Final Approval
─────────────────────────────────────

┌──────────────────────────────┐
│ Super Admin                  │
│ Final Approval               │
└──────────────┬───────────────┘
               │
      ┌────────┴────────┐
      │                 │
   APPROVED         DISAPPROVED
      │                 │
      ▼                 ▼
┌─────────────────┐  ┌─────────────────────────┐
│ Notify Admin    │  │ Notify Admin            │
│ Status:         │  │ Status: CANCELLED       │
│ APPROVED /      │  └─────────────────────────┘
│ CONFIRMED       │
└────────┬────────┘
         │
         ▼

─────────────────────────────────────
 STEP 7: Engineer Receives Items
─────────────────────────────────────

┌─────────────────┐
│ Engineer        │
│ Receives Items  │
│ Marks as        │
│ RECEIVED        │
└────────┬────────┘
         │
         ▼

─────────────────────────────────────
 STEP 8: Completion Check
─────────────────────────────────────

┌─────────────────┐
│ All Items       │ YES ┌─────────────────┐
│ Received?       │────>│ Status:         │
└─────────────────┘     │ COMPLETED       │
       NO               └─────────────────┘
        │
        ▼
┌─────────────────┐
│ Wait for        │
│ remaining items │
└─────────────────┘
```

---

## 4. USER ROLES & PERMISSIONS MATRIX

```
┌────────────────────┬──────────┬───────┬─────────────┐
│      FEATURE       │ Engineer │ Admin │ Super Admin │
├────────────────────┼──────────┼───────┼─────────────┤
│ Browse Items       │    ✓     │   ✓   │      ✓      │
│ Create PR          │    ✓     │   ✗   │      ✗      │
│ Approve PR (1st)   │    ✗     │   ✗   │      ✓      │
│ Approve PR (2nd)   │    ✗     │   ✗   │      ✓      │
│ Create PO          │    ✗     │   ✓   │      ✗      │
│ Approve PO (Final) │    ✗     │   ✗   │      ✓      │
│ Mark Items Received│    ✓     │   ✗   │      ✗      │
│ Manage Items       │    ✗     │   ✓   │      ✗      │
│ Manage Suppliers   │    ✗     │   ✓   │      ✗      │
│ View All PRs/POs   │    ✗     │   ✓   │      ✓      │
│ System Settings    │    ✗     │   ✗   │      ✓      │
└────────────────────┴──────────┴───────┴─────────────┘
```

---

## 5. DATABASE ENTITY RELATIONSHIP (Simplified)

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   employees     │       │purchase_requests│       │ purchase_orders │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ employee_no     │       │ pr_number       │       │ po_number       │
│ first_name      │       │ requested_by    │◄──────│ purchase_req_id │
│ last_name       │◄──────│ (FK)            │       │ supplier_id     │
│ role            │       │ status          │       │ prepared_by (FK)│
│ is_active       │       │ approved_by(FK) │◄──────┤ status          │
└─────────────────┘       │ total_amount    │       │ total_amount    │
         │                └─────────────────┘       └─────────────────┘
         │                         │
         │                         │
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│   suppliers     │       │purchase_request_│
├─────────────────┤       │    items        │
│ id (PK)         │       ├─────────────────┤
│ supplier_code   │       │ id (PK)         │
│ supplier_name   │       │ pr_id (FK)      │
│ contact_person  │       │ item_id (FK)    │
│ email, phone    │       │ quantity        │
└─────────────────┘       │ unit_price      │
         │                │ status          │
         │                └─────────────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│  supplier_items │       │     items       │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ supplier_id(FK) │       │ item_code       │
│ item_id (FK)    │       │ item_name       │
│ price           │       │ category_id(FK) │
│ lead_time_days  │       │ unit            │
│ is_preferred    │       └─────────────────┘
└─────────────────┘
```

---

## 6. NOTIFICATION FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                     TRIGGER EVENTS                          │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ PR Created   │ │ PR Approved  │ │ PR Rejected  │ │ PO Created   │
│ ──────────── │ │ ──────────── │ │ ──────────── │ │ ──────────── │
│ To: Super    │ │ To: Next     │ │ To: Engineer │ │ To: Super    │
│ Admin        │ │ Approver     │ │ (reason)     │ │ Admin        │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│              notifications TABLE (Database)                 │
│  - recipient_id  - title  - message  - type  - is_read      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              SOCKET.IO (Real-time Push)                     │
│                    OR                                       │
│              API Polling (Fallback)                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   USER NOTIFICATION BELL                    │
│              (Frontend Component)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. SERVICE REQUEST (SR) FLOW

```
┌─────────────────┐
│ Engineer        │
│ Creates SR      │
│ Status: PENDING │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Status: FOR     │
│ SUPPLIER QUOTE  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Admin Enters    │
│ Pricing Info    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Super Admin     │ NO  │ Return to Admin │
│ Final Approval  │────>│ for revision    │
│ Approve?        │     │                 │
└────────┬────────┘     └─────────────────┘
       YES │
         │
         ▼
┌─────────────────┐
│ Status:         │
│ APPROVED        │
│ Job Order to    │
│ Supplier        │
└─────────────────┘
```

---

## 8. CASH REQUEST (CR) FLOW

```
┌─────────────────┐
│ Employee        │
│ Creates CR      │
│ Status: PENDING │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Immediate       │ NO  │ Continue to     │
│ Need? (<3 days) │────>│ Normal Approval │
└────────┬────────┘     └────────┬────────┘
     YES │                       │
         │                       ▼
         │           ┌─────────────────┐
         │           │ Department Head │
         │           │ Review          │
         │           │ Approve?        │
         │           └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│ Immediate       │    │ Super Admin     │
│ Approval Path   │    │ Final Approval  │
│ (Expedited)     │    │                 │
└─────────────────┘    └─────────────────┘
         │                      │
         └──────────┬───────────┘
                    ▼
            ┌─────────────────┐
            │ Finance         │
            │ Releases Cash   │
            │ Status: RELEASED│
            └─────────────────┘
                    │
                    ▼
            ┌─────────────────┐
            │ Employee        │
            │ Acknowledges    │
            │ Receipt         │
            │ Status: CLOSED  │
            └─────────────────┘
```

---

## Color Coding for Drawing (Optional)

| Component | Suggested Color |
|-----------|-----------------|
| User Roles | Blue |
| Status/Decisions | Yellow/Orange |
| Rejection/Error | Red |
| Success/Approval | Green |
| Database Tables | Gray |
| Flow Arrows | Black |
| Notifications | Purple |

---

## Tools to Draw This

1. **draw.io** (diagrams.net) - Free, web-based
2. **Lucidchart** - Professional, paid
3. **Miro** - Collaborative whiteboard
4. **Excalidraw** - Hand-drawn style
5. **Figma** - Design tool with flowchart plugins
6. **Whimsical** - Quick flowcharts
7. **Paper + Pen** - Always works!

