# Daily Project Status Report
**Date:** September 12, 2026

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
```
``

---

## 1. Completed Features ✅

### Codebase & Repository Management
- **Repository Ownership Transfer:** We successfully transferred the local codebase to a new remote repository (`https://github.com/Dane-22/procurement_new.git`). This was done to secure the project's source code, as the former coworker who owned the original repository had resigned and was planning to delete it.
- **CI/CD Pipeline Reconnection:** Successfully generated a new SSH keypair directly on the production VPS, added it to the server's authorized keys, and configured the new GitHub repository's secrets (`VPS_HOST`, `VPS_USERNAME`, `SSH_KEY`). We also repointed the live VPS server's local git origin to the new repository URL, ensuring that our automated deployments continue to function seamlessly.

### Mobile Application (App for Phones & Tablets)
- **Visual Design & Branding:** The entire mobile app has been redesigned to follow the company's official theme colors (Yellow and Dark Slate). Unappealing default colors (like basic blue/gray) have been completely removed.
- **Requester Identification:** You can now clearly see the name of the person who requested an item (the "Requester") directly on the list of approvals. You no longer need to click into the details just to see who made the request.
- **Approvals List Navigation:** The Approvals page now has two simple tabs: **"Pending Reviews"** (requests waiting for your action) and **"Reviewed Already"** (requests you have already processed).
- **Admin Processing Controls:** Admins can now directly "Approve" or "Reject" purchase requests straight from their mobile phones.
- **Currency Standardization:** All money amounts in the mobile app now correctly display the Philippine Peso sign (₱) instead of the Dollar sign ($).
- **Including Supplier on Mobile (`CreateSupplierScreen`):** Admins can seamlessly add new suppliers and auto-populate them in the dropdown directly within the Mobile App instead of requiring the Web App.
- **User Interface Polish:** We have reviewed all screens (both Web and Mobile) to make sure fonts, spacing, and colors look perfectly consistent and professional.
- **Mobile Stability Testing:** We have optimized the mobile app to ensure it doesn't crash or slow down when navigating between many different pages (including global error boundaries and list virtualization).
- **Offline & Real-Time Synchronization:** We have refined how the mobile app handles losing internet connection. The app now saves your actions (like approving a request) locally if you lose service, and then automatically syncs those changes with the main server as soon as your internet returns with proper conflict resolution. We have also integrated seamless real-time notifications to ensure web and mobile users see updates instantly without needing to refresh their screens.
- **iOS Mobile Support & Testing:** Successfully resolved Expo Go and React Native version compatibility issues (including Babel configurations and native worklet dependencies). The mobile app now compiles properly and supports testing across both iOS (via Expo Go on physical devices) and Android (via AVD and Expo Go) platforms. The React Native codebase itself is 100% cross-platform and **iOS ready**; it is fully prepared to be compiled into a standalone iOS app via EAS as soon as a paid Apple Developer Account is provisioned.
- **Production Build Configuration & Testing Logistics:** Successfully initialized and linked Expo Application Services (EAS) to the primary Expo account (`@dantegulapina`) for production builds. During real-world testing today, a coworker attempted to scan a production EAS QR code using an iPhone but received an "Account Not Found" error. We discovered two major restrictions: First, Apple blocks scanning standalone production QR codes on iOS unless the user is logged into the developer's exact Expo account; Second, generating a true standalone iOS app requires a paid $99/year Apple Developer Account, making iOS production builds currently unavailable. *(Note: This paid Apple Developer Account will eventually be required when the company wants to permanently install the app on employee iPhones, distribute it internally via Apple TestFlight, or officially publish it to the Apple App Store).* To solve this for now, we established a firm team workflow: we use `eas build -p android` to generate Android APKs for direct installation, and we explicitly rely on live local development (`npx expo start --tunnel`) to allow coworkers to test on iPhones via Expo Go without needing paid Apple Developer credentials.
- **Purchase Request Creation (Item Cost Calculation):** We updated the Purchase Request creation flow in the mobile app so that users can input individual Unit Prices for each requested item. The app now automatically calculates and displays the total amount dynamically on the requested item cards.
- **Mobile Rate Limiting & Pagination:** To prevent the mobile app from lagging when dealing with thousands of historical records, we implemented robust pagination (rate limiting) on both the "All Requests" and "Approvals" screens. The app now only fetches 10 items at a time and automatically loads more as you scroll down (infinite scrolling). We also built a new lightning-fast `/counts` backend route to accurately calculate and display the total numbers on the UI tabs (e.g., `ALL (12)`) without needing to download all the data.
- **Inline Quick Actions & Offline Approvals:** We added inline "Approve" and "Reject" buttons directly to the pending approvals list. We also integrated rate limiters (loading states) to prevent accidental double-clicks and connected these actions to the offline synchronization engine so approvals queue safely if the internet disconnects.

### Web Application (Main Computer System)
- **Enhanced System Audit Logs:** The web application now features a completely revamped Audit Log interface for Super Admins. It includes dynamic backend-driven filters with a premium Tailwind UI aesthetic, a responsive filter grid with integrated date-range pickers, advanced search, a detailed viewer modal for inspecting payload changes, and a robust "Export to CSV" functionality for compliance reporting.
- **Database Backup System:** Super Admins can now easily download a full backup of the system database with a single click from the Settings page. This ensures company data is safe and easily recoverable.
- **Purchase Request (PR) Bypass Feature:** Authorized Super Admins can securely skip or "bypass" standard approval steps for urgent requests. The system automatically tracks who bypassed it and notifies everyone involved.
- **Super Admin Global Flagging (Reject & Hold):** Super Admins now have global oversight of all Purchase Requests, including those under 10,000 (which normally go to Reps). Super Admins can view these PRs in their Pending tab and can immediately Reject or Hold them from both the web dashboard and the mobile app, regardless of the PR's current approval stage.
- **Payment Schedules:** The web application successfully tracks when payments are due for various requests (Cash, Services, Reimbursments) and issues reminders automatically.
- **Super Admin & Engineer Workflow Stability:** All primary user flows for Engineers (creating/editing PRs) and Super Admins (reviewing, bypassing, managing users) have been stress-tested manually on both Web and Mobile platforms and verified stable.
- **PR Review Workflow UI Fixes:** Fixed a display bug in the PR Details modal where the "Super Admin Rep Review" and "Super Admin Final Approval" stages were incorrectly labeling pending reviewers as "Engineer review" due to missing status mappings. The UI now accurately reflects all current review stages and pending reviewer roles.

### Backend (System Logic & Database)
- **Purchase Request Processing Stability (Bug Fix):** Resolved a critical issue where Admins finalizing a Purchase Request (adding custom suppliers and payment schedules) would encounter a `500 Internal Server Error` or `400 Bad Request`. 
  - *Problem:* A typo in the backend (`sched.paymentDate` instead of `sched.payment_date`) was causing the database to crash when attempting to insert missing data. Additionally, creating a custom "Other" supplier directly from the frontend could result in "orphaned" database entries if the subsequent PR submission failed.
  - *Action:* Fixed the variable naming typo to correctly save payment schedules. Moved the custom "Other" supplier creation into the main backend database transaction, ensuring it safely rolls back and prevents duplicates if any errors occur. Finally, implemented robust frontend validation (verifying unit prices > 0, ensuring custom supplier names aren't empty, and precisely matching payment schedule totals) with clear UI alerts to prevent invalid data from ever reaching the server.
- **Amount-Based PR Routing & Engineer Reviews:** Enforced standardized routing rules for Purchase Requests based on their total amount. PRs less than 10,000 are explicitly routed to Super Admin Representatives for review, while PRs 10,000 or greater automatically bypass the Super Admin Rep stage and go directly to Super Admin Final Approval (automatically cleaning up any pending Rep review records). Additionally, we verified that the system strictly requires all engineers to approve a request before advancing to subsequent stages.
- **Item Request Approval Flow Correction:** Corrected a logic gap in the PR state machine where Mobile Item Requests were getting stuck at "For Admin Review" instead of advancing to "For Super Admin Rep Review". When an Admin processes the Item Request (by adding pricing), the backend now automatically auto-approves their administrative review record, keeping the workflow strictly in sync with the documented System Flowchart rules.
- **Global Role Bypassing (Super Admin Flagging):** Refactored backend endpoints (`PUT /:id/status` and `POST /:id/review`) to specifically allow `super_admin` users to bypass rigid review validations when placing a PR On Hold or Rejecting it.
- **Automatic Data Cleanup:** The database is now configured to automatically clean up related files and schedules if a main request is deleted (e.g., if a Purchase Order is deleted, its attachments are also deleted safely).
- **Secure Logouts:** The system properly handles logging out across both web and mobile, ensuring your session is securely closed and data isn't left hanging.
- **Security Protections:** High-level features (like Database Backups) are strictly locked down so only Super Admins can access them.

### Quality Assurance & Automated Testing
- **API & Backend Testing:** Implemented comprehensive integration tests using Jest and Supertest for core endpoints (`/api/health`, `/api/auth/login`), along with unit tests for our role-based authorization logic.
- **End-to-End (E2E) & UI Testing:** Set up Playwright for E2E workflows against the local development server (starting with the authentication flow). Configured Vitest and React Testing Library to test frontend UI components (like `Button.jsx`) in isolation.
- **Performance & Load Testing:** Added a dedicated load-testing script using Autocannon (`npm run test:load`) to routinely assess API bottlenecks and latency under heavy concurrency.
- **Security & Dependency Auditing:** Executed `npm audit` across both frontend and backend repositories to detect and patch known CVE vulnerabilities (via `npm audit fix`). Verified the integration of Helmet.js for CSP and cross-origin security headers.
- **Code Quality & CI/CD Pipeline:** Enforced structural frontend checks with ESLint. Bootstrapped a complete GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`) that triggers on pushes to the `main` branch to automatically run security audits, linting, and all our test suites, and upon success, automatically deploy the application natively to the production VPS server (`procurement.xandree.com`) via SSH. We have resolved all strict frontend linting errors and pipeline timeouts to ensure clean and stable automated releases.

---

## 2. Pending Tasks (Next Steps) ⏳
- **Purchase Order (PO) Flow Refactoring:** Implement the advanced PO approval workflow based on the existing `PO_FLOW_IMPLEMENTATION_PLAN.md`. This includes adding the Admin review gate, partial per-line item receiving, and Super Admin final approval steps.
- **Service Request (SR) Flow:** Implement the full lifecycle (Pending -> For Supplier Quote -> Admin Pricing -> Super Admin Final Approval -> Job Order) based on the system flowchart.
- **Cash Request (CR) Flow:** Implement the Cash Request lifecycle, including standard (Department Head -> Super Admin) and expedited (< 3 days) approval paths, and Finance cash release.
- **SOP Creation:** Draft and finalize a comprehensive Standard Operating Procedure (SOP) document to officially standardize the new system workflows, mobile testing procedures, and deployment processes for all employees.

---
*Note: This report is a living document and must be updated daily at the end of each working session to reflect the true status of the procurement project.*
