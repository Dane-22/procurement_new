# Daily Project Status Report
**Date:** September 10, 2026

## Overview
This report outlines the current status of the Procurement System project, including the Web Application (used on computers), the Mobile Application (used on phones/tablets), and the Backend Server (the database and logic that powers everything).

---

## Purchase Request (PR) Approval Flow
*This is the standardized workflow a Purchase Request follows from creation to final approval, as documented in our system flowchart.*

`````
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
`````

---

## 1. Completed Features ✅

### Mobile Application (App for Phones & Tablets)
- **Visual Design & Branding:** The entire mobile app has been redesigned to follow the company's official theme colors (Yellow and Dark Slate). Unappealing default colors (like basic blue/gray) have been completely removed.
- **Requester Identification:** You can now clearly see the name of the person who requested an item (the "Requester") directly on the list of approvals. You no longer need to click into the details just to see who made the request.
- **Approvals List Navigation:** The Approvals page now has two simple tabs: **"Pending Reviews"** (requests waiting for your action) and **"Reviewed Already"** (requests you have already processed).
- **Admin Processing Controls:** Admins can now directly "Approve" or "Reject" purchase requests straight from their mobile phones.
- **Currency Standardization:** All money amounts in the mobile app now correctly display the Philippine Peso sign (₱) instead of the Dollar sign ($).

### Web Application (Main Computer System)
- **Database Backup System:** Super Admins can now easily download a full backup of the system database with a single click from the Settings page. This ensures company data is safe and easily recoverable.
- **Purchase Request (PR) Bypass Feature:** Authorized Super Admins can securely skip or "bypass" standard approval steps for urgent requests. The system automatically tracks who bypassed it and notifies everyone involved.
- **Payment Schedules:** The web application successfully tracks when payments are due for various requests (Cash, Services, Reimbursments) and issues reminders automatically.

### Backend (System Logic & Database)
- **Automatic Data Cleanup:** The database is now configured to automatically clean up related files and schedules if a main request is deleted (e.g., if a Purchase Order is deleted, its attachments are also deleted safely).
- **Secure Logouts:** The system properly handles logging out across both web and mobile, ensuring your session is securely closed and data isn't left hanging.
- **Security Protections:** High-level features (like Database Backups) are strictly locked down so only Super Admins can access them.

---

## 2. Ongoing Work 🔄
- **User Interface Polish:** We are continuously reviewing all screens (both Web and Mobile) to make sure fonts, spacing, and colors look perfectly consistent and professional.
- **Mobile Stability Testing:** We are actively monitoring the mobile app to ensure it doesn't crash or slow down when navigating between many different pages.
- **Offline & Real-Time Synchronization:** We are refining how the mobile app handles losing internet connection. The app is designed to save your actions (like approving a request) locally if you lose service, and then automatically sync those changes with the main server as soon as your internet returns. We are also monitoring real-time notifications to ensure web and mobile users see updates instantly without needing to refresh their screens.

---

## 3. Pending Tasks (Next Steps) ⏳
- **Super Admin & Engineer Testing:** While the Admin features are working perfectly, we still need to thoroughly test the workflows while logged in as an Engineer or a Super Admin across **both the Mobile App and the Web Application** to guarantee a smooth and error-free experience.
- **Including Supplier on Mobile:** Currently, if an Admin needs to add supplier details or set up payment schedules, they must use the Web Application. Our next step is to build the feature to include and select suppliers directly within the Mobile App.
- **Automated Testing Setup:** We need to configure comprehensive testing environments to ensure long-term stability. This includes setting up API testing, backend testing, and frontend visual testing using tools like **Playwright** (for user simulation) and **Autocannon** (for load testing and performance under heavy traffic).
- **General Code Cleanup:** We need to remove old, unused test code from the system to keep the application running as fast and efficiently as possible.

---
*Note: This report is a living document and must be updated daily at the end of each working session to reflect the true status of the procurement project.*
