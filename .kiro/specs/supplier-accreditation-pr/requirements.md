# Requirements Document

## Introduction

This feature enforces supplier accreditation during the purchase request (PR) creation flow. When a user creates a PR from the Items dashboard, the system must check whether the selected supplier is already accredited. If the supplier is not accredited, the user must upload accreditation documents as part of the PR submission, and the resulting PR is placed in a **Pending Accreditation** status until a Super Admin reviews and approves the supplier's accreditation. If the supplier is already accredited, the PR proceeds through the normal review workflow without interruption.

The project already has an `accredited` field on the `suppliers` table, an `accreditation_files` column for storing uploaded document paths, and a file upload directory at `backend/uploads/accreditation/`. This feature builds on that existing infrastructure.

---

## Glossary

- **PR**: Purchase Request — a formal request to procure items from a supplier.
- **System**: The procurement web application (Node.js/Express backend + React frontend).
- **PR_Modal**: The "Create Purchase Request" modal rendered inside the Items dashboard page (`Items.jsx`).
- **Accreditation_Document**: A file (PDF, DOCX, XLSX, JPG, or PNG) uploaded to support a supplier's accreditation.
- **Accreditation_Status**: The `accredited` flag (boolean) on the `suppliers` table that indicates whether a supplier has been approved by a Super Admin.
- **Accreditation_Checker**: The backend logic that queries the `suppliers` table to determine a supplier's accreditation status at PR creation time.
- **File_Uploader**: The backend middleware (extending the existing `upload.js` / `suppliers.js` infrastructure) that handles multipart file uploads for accreditation documents.
- **Super_Admin**: A user with the `super_admin` role who has authority to approve or reject supplier accreditation.
- **Pending_Accreditation**: A new PR status value indicating the PR is on hold until the associated supplier's accreditation is resolved.
- **Normal_Workflow**: The existing PR review chain (`For Engineer Review` → `For Admin Review` → `For Procurement Review` → `For Super Admin Final Approval`), unchanged for accredited suppliers.

---

## Requirements

### Requirement 1: Accreditation Status Check on PR Submission

**User Story:** As a user creating a purchase request, I want the system to automatically check whether my selected supplier is accredited, so that unaccredited suppliers are flagged before the PR enters the normal review workflow.

#### Acceptance Criteria

1. WHEN a user submits a PR with a `supplier_id` or free-text `supplier_name`, THE Accreditation_Checker SHALL query the `suppliers` table and return the supplier's `accredited` value (1 = accredited, 0 = not accredited, or absent = not yet in the table).
2. WHEN the supplier's `accredited` value is 1, THE System SHALL proceed with the Normal_Workflow status assignment (e.g., `For Engineer Review`) without requiring any accreditation document upload.
3. WHEN the supplier's `accredited` value is 0 or the supplier does not exist in the `suppliers` table, THE System SHALL require at least one Accreditation_Document to be uploaded before the PR can be submitted (non-draft).
4. IF a user attempts to submit a non-draft PR for an unaccredited supplier without attaching at least one Accreditation_Document, THEN THE System SHALL return HTTP 400 with the message: `"Supplier is not accredited. Please upload at least one accreditation document to proceed."`.
5. WHEN a PR is saved as a Draft, THE System SHALL NOT enforce the accreditation document requirement, regardless of the supplier's accreditation status.

---

### Requirement 2: Accreditation Document Upload in the PR Modal

**User Story:** As a user creating a purchase request for an unaccredited supplier, I want to upload accreditation documents directly in the PR creation modal, so that I can submit the PR in a single workflow without navigating to a separate page.

#### Acceptance Criteria

1. WHEN the user types or selects a supplier name in the PR_Modal and the supplier's `accredited` value is 0 or the supplier is not found in the `suppliers` table, THE PR_Modal SHALL display a file upload section labeled "Supplier Accreditation Documents (Required)".
2. WHEN the supplier's `accredited` value is 1, THE PR_Modal SHALL NOT display the accreditation file upload section.
3. THE File_Uploader SHALL accept files of type PDF, DOCX, DOC, XLSX, XLS, JPG, and PNG only.
4. IF a user attempts to attach a file whose MIME type is not in the allowed list, THEN THE PR_Modal SHALL display the message: `"Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG"` and SHALL NOT add the file to the upload queue.
5. THE File_Uploader SHALL enforce a maximum file size of 10 MB per file.
6. IF a user attempts to attach a file larger than 10 MB, THEN THE PR_Modal SHALL display the message: `"File exceeds the 10 MB size limit"` and SHALL NOT add the file to the upload queue.
7. THE PR_Modal SHALL allow the user to attach up to 5 accreditation documents per PR submission.
8. WHEN a file is added to the upload queue, THE PR_Modal SHALL display the file name and a remove button so the user can deselect it before submitting.
9. WHEN the user removes a file from the upload queue, THE PR_Modal SHALL update the displayed file list to reflect the removal immediately.

---

### Requirement 3: PR Status Assignment for Unaccredited Suppliers

**User Story:** As a procurement officer or Super Admin, I want PRs from unaccredited suppliers to be clearly separated from the normal review queue, so that accreditation can be resolved before the PR proceeds.

#### Acceptance Criteria

1. WHEN a non-draft PR is successfully submitted for an unaccredited supplier with at least one Accreditation_Document, THE System SHALL set the PR's `status` to `Pending Accreditation`.
2. WHEN a PR's `status` is `Pending Accreditation`, THE System SHALL NOT assign the PR to the Normal_Workflow review chain.
3. WHEN a PR's `status` is set to `Pending Accreditation`, THE System SHALL send a notification to all Super_Admin users with the message: `"Purchase Request [PR Number] is pending accreditation for supplier [Supplier Name]. Please review the uploaded documents."`.
4. WHEN a Super_Admin approves the supplier's accreditation (sets `accredited = 1` on the `suppliers` table), THE System SHALL transition the PR's `status` from `Pending Accreditation` to the appropriate Normal_Workflow status based on the original requester's role.
5. WHEN a Super_Admin rejects the supplier's accreditation, THE System SHALL transition the PR's `status` to `Rejected` and SHALL send a notification to the PR requester with the message: `"Your Purchase Request [PR Number] was rejected because supplier [Supplier Name] could not be accredited."`.

---

### Requirement 4: Accreditation Document Storage

**User Story:** As a Super Admin reviewing accreditation, I want uploaded documents to be stored reliably and linked to both the supplier and the PR, so that I can access them for review at any time.

#### Acceptance Criteria

1. WHEN accreditation documents are uploaded during PR creation, THE File_Uploader SHALL store the files in the `backend/uploads/accreditation/` directory using a unique filename pattern: `pr_{prId}_{timestamp}_{randomSuffix}{extension}`.
2. WHEN accreditation documents are stored, THE System SHALL persist the file metadata (filename, original name, file path, size, MIME type, upload timestamp) as a JSON array in the `accreditation_files` column of the corresponding `suppliers` table row.
3. WHEN a supplier row does not yet exist in the `suppliers` table at the time of PR submission, THE System SHALL create a new supplier row with the provided `supplier_name` and `supplier_address` before storing the file metadata.
4. THE System SHALL associate the uploaded accreditation document file paths with the PR record so that the PR detail view can display links to the documents.
5. IF a file upload fails during PR creation (e.g., disk error), THEN THE System SHALL roll back the entire PR creation transaction and return HTTP 500 with the message: `"Failed to create purchase request: file upload error"`.

---

### Requirement 5: Super Admin Accreditation Review Interface

**User Story:** As a Super Admin, I want to see PRs that are pending accreditation and review the uploaded documents, so that I can approve or reject the supplier's accreditation and unblock the PR.

#### Acceptance Criteria

1. THE System SHALL display PRs with `status = 'Pending Accreditation'` in a dedicated section or filter within the existing purchase requests list, visible to Super_Admin users.
2. WHEN a Super_Admin opens a PR with `status = 'Pending Accreditation'`, THE System SHALL display the list of uploaded accreditation documents with download or preview links.
3. WHEN a Super_Admin clicks a document link, THE System SHALL serve the file from `backend/uploads/accreditation/` with the correct `Content-Type` header.
4. THE System SHALL provide an "Approve Accreditation" action on the PR detail view that, when confirmed by the Super_Admin, sets `accredited = 1` on the supplier and transitions the PR to the Normal_Workflow.
5. THE System SHALL provide a "Reject Accreditation" action on the PR detail view that, when confirmed by the Super_Admin, sets `accredited = 0` on the supplier and transitions the PR to `Rejected` status.
6. IF a Super_Admin attempts to approve or reject accreditation on a PR whose `status` is not `Pending Accreditation`, THEN THE System SHALL return HTTP 400 with the message: `"This action is only available for PRs with Pending Accreditation status."`.

---

### Requirement 6: Accreditation Status Indicator in the PR Modal

**User Story:** As a user creating a purchase request, I want to see a clear visual indicator of the selected supplier's accreditation status, so that I know upfront whether I need to upload documents.

#### Acceptance Criteria

1. WHEN the user enters a supplier name in the PR_Modal and the supplier is found in the `suppliers` table with `accredited = 1`, THE PR_Modal SHALL display a green badge labeled "Accredited" next to the supplier name field.
2. WHEN the user enters a supplier name in the PR_Modal and the supplier is found in the `suppliers` table with `accredited = 0`, THE PR_Modal SHALL display a yellow badge labeled "Not Accredited — documents required" next to the supplier name field.
3. WHEN the user enters a supplier name in the PR_Modal and the supplier is not found in the `suppliers` table, THE PR_Modal SHALL display a yellow badge labeled "New Supplier — documents required" next to the supplier name field.
4. WHEN the supplier name field in the PR_Modal is empty, THE PR_Modal SHALL NOT display any accreditation status badge.
5. WHILE the PR_Modal is querying the supplier's accreditation status, THE PR_Modal SHALL display a loading indicator next to the supplier name field and SHALL disable the submit button.

---

### Requirement 7: Database Migration for Pending Accreditation Status

**User Story:** As a developer, I want the `purchase_requests` table to support the new `Pending Accreditation` status value, so that the feature can be deployed without breaking existing data.

#### Acceptance Criteria

1. THE System SHALL include a database migration that adds `'Pending Accreditation'` to the `status` ENUM column of the `purchase_requests` table.
2. WHEN the migration is applied, THE System SHALL preserve all existing PR records and their current status values unchanged.
3. THE migration file SHALL be placed in `backend/database/migrations/` and named `add_pending_accreditation_status_to_purchase_requests.sql`.
