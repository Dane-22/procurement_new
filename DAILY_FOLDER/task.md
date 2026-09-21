# Project Tasks & Management

## 1. Ongoing Tasks 🔄

### Test Entire Purchase Request Flow
- `[ ]` **End-to-End Testing:**
  - `[ ]` Create PR as Engineer
  - `[ ]` Review as Engineer
  - `[ ]` Review as Admin
  - `[ ]` Review as Super Admin Rep
  - `[ ]` Review as Super Admin
  - `[ ]` Receive Items

### Push Notifications (Web & Mobile)
- `[x]` **Phase 1 Implementation:**
  - `[x]` Evaluate Web and Expo Push Notification registration.
  - `[x]` Rewrite backend `pushSender.js` to dispatch to both Web Push and Expo Push endpoints.
  - `[x]` Ensure notifications are delivered even when the app is closed.

### Mobile Notification Bell & Sounds
- `[x]` **Phase 1 Implementation:**
  - `[x]` Develop in-app notification UI component (dropdown overlay).
  - `[x]` Integrate alert sounds for new notifications.
  - `[x]` Connect notification bell to real-time socket events.
  - `[x]` Perform UI refinement and cross-platform testing (iOS/Android).
  - `[x]` Finalize layout consistency across custom headers (avoiding Expo Go UI overlaps).
  - `[x]` Fix notification routing (404 error) and include PR creator's name dynamically.
  - `[x]` Resolve Metro bundler asset resolution crash by migrating notification sound to natively supported `.mp3` format.

### Web Notification Bell & Sounds
- `[x]` **Phase 1 Implementation:**
  - `[x]` Develop web notification UI component (dropdown/modal).
  - `[x]` Integrate alert sounds for new notifications.
  - `[x]` Connect notification bell to real-time socket events.
  - `[x]` Ensure socket connection explicitly joins `user_{ID}` and `role_{ROLE}` rooms.

## 2. Pending Tasks (Next Steps) ⏳


### Purchase Order (PO) Flow Refactoring
*(Reference: `PO_FLOW_IMPLEMENTATION_PLAN.md`)*
- `[ ]` **Admin Review Gate:** Implement logic requiring Admin review before PO proceeds.
- `[ ]` **Partial Receiving:** Enable per-line item receiving functionality for incomplete deliveries.
- `[ ]` **Final Approval:** Add Super Admin final approval steps to the PO workflow.
- `[ ]` **UI Updates:** Update Web and Mobile UI to reflect new PO states.

### Service Request (SR) Flow
- `[ ]` **Pending State:** Create initial state for new SRs.
- `[ ]` **Supplier Quote:** Implement flow to request and attach supplier quotes.
- `[ ]` **Admin Pricing:** Allow Admins to set or review pricing.
- `[ ]` **Final Approval:** Route to Super Admin for final sign-off.
- `[ ]` **Job Order:** Generate finalized Job Order upon approval.

### Cash Request (CR) Flow
- `[ ]` **Standard Path:** Implement Department Head -> Super Admin approval routing.
- `[ ]` **Expedited Path:** Implement accelerated routing for urgent requests (needed < 3 days).
- `[ ]` **Finance Integration:** Add step for Finance department to record cash release.

### SOP Creation
- `[ ]` **System Workflows:** Document standard operating procedures for PR, PO, SR, and CR flows.
- `[ ]` **Mobile Testing:** Outline standardized procedures for testing the mobile app (Expo Go, Android APKs).
- `[ ]` **Deployment:** Document the CI/CD pipeline and manual deployment processes.
