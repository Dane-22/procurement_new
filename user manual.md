# Procurement System — User Manual and Turnover Guide

**Prepared:** October 14, 2026

**Audience:** Requesters, reviewers, Admin staff, finance staff, management, and the employee maintaining the system.

**Application:** ProcureSys / JAJR Construction Procurement System

**Review baseline:** Repository through commit `d3a5952`, current workflow code, and deployment results recorded during this turnover session.

This manual explains daily operation and the information needed to take over the project. It describes the current implementation; outstanding differences and deployment tasks are listed in section 18. A working button or a status label does not replace the company's approval, payment, or evidence requirements.

The complete [turnover package](turnover/README.md) includes named owners, access transfer, training records, the issue register, backup/recovery instructions, and an acceptance form.

## Contents

1. [System access and purpose](#1-system-access-and-purpose)
2. [Roles and responsibility](#2-roles-and-responsibility)
3. [Logging in and account settings](#3-logging-in-and-account-settings)
4. [Navigation and daily routine](#4-navigation-and-daily-routine)
5. [Projects, items, and suppliers](#5-projects-items-and-suppliers)
6. [Purchase Requests](#6-purchase-requests)
7. [Shared reviews and Request Workflows](#7-shared-reviews-and-request-workflows)
8. [Purchase Orders](#8-purchase-orders)
9. [Service Requests](#9-service-requests)
10. [Cash Requests](#10-cash-requests)
11. [Petty Cash Requests and liquidation](#11-petty-cash-requests-and-liquidation)
12. [Payment documents and reimbursements](#12-payment-documents-and-reimbursements)
13. [Statuses, corrections, and evidence](#13-statuses-corrections-and-evidence)
14. [Reports, notifications, and audit](#14-reports-notifications-and-audit)
15. [Troubleshooting](#15-troubleshooting)
16. [Technical handover and deployment](#16-technical-handover-and-deployment)
17. [Backup and recovery](#17-backup-and-recovery)
18. [Outstanding items for the next maintainer](#18-outstanding-items-for-the-next-maintainer)
19. [Turnover acceptance checklist](#19-turnover-acceptance-checklist)
20. [Source reference and glossary](#20-source-reference-and-glossary)

## 1. System access and purpose

The system records requests for materials, services, and cash; routes reviews; links purchasing and payment documents; and preserves evidence and history. Approval, purchasing, payment, receiving, and liquidation are separate activities.

| Resource | Address / location |
| --- | --- |
| Production application | https://procurement.xandree.com |
| Production API | https://procurement-api.xandree.com/api |
| API health | https://procurement-api.xandree.com/api/health |
| GitHub repository | https://github.com/Dane-22/procurement_new |
| Local project | `C:\wamp64\www\procurement` |
| VPS project | `/var/www/Procurement` |
| VPS | `72.62.254.60` |
| Production environment file | `/opt/procurement/.env.prod` |

Use an individual employee account. Give the next maintainer company-owned access to hosting, GitHub, DNS, and credentials through the company's approved secure channel. Passwords, database credentials, JWT secrets, Redis passwords, and private keys are deliberately omitted from this manual.

The web application is the operating guide's primary interface. A separate Expo/React Native project exists in `mobile/`; attendance belongs to separate applications. Mobile release status and supported mobile workflows must be confirmed before promising employees the same features as the web application.

## 2. Roles and responsibility

| Role | Main responsibility |
| --- | --- |
| Engineer | Prepare requests, review assigned requests, record delivery when eligible, and confirm work/cash actually received. |
| Procurement | Use available request/catalog functions and coordinate purchasing according to assigned access. This role is still present in code; older documentation saying it was removed is not authoritative. |
| Admin | Review assigned requests, prepare POs and payment documents, coordinate suppliers, verify PO/SR receipts, release ordinary cash, and individually review existing-request migration. |
| Senior Project Engineer | Review assigned final-stage requests below the applicable threshold and use permitted management functions. Stored role code is `senior_project_manager`; some older screens/statuses say Senior Project Manager or Super Admin Representative. |
| CEO | Review assigned final-stage requests and use visible management/approval functions. |
| Super Admin | Review assigned final-stage requests, handle supplier accreditation and system administration, and download database backups. |

For the new PO/SR/ordinary CR workflow, an Engineer, Admin, or Senior Project Engineer stage uses all active employees in that role company-wide, excluding the requester/preparer. Every assigned group member must approve. A requester cannot approve their own request.

The new final stage requires **one eligible Super Admin and one eligible CEO**, in either order. It does not require every employee in those two roles to vote. A missing eligible role blocks submission or completion. These rules are enforced by the new workflow service; PR and petty cash retain separate implementations.

Menu visibility, assignment, and authorization are different checks. A missing menu or button does not necessarily mean that a module is unimplemented. Never change employee roles merely to bypass a pending review. Review staffing before deactivating a required approver.

**Maintainer note:** Legacy helpers such as `requireSuperAdmin` also allow Senior Project Engineer and CEO, despite the helper name. Some UI controls are narrower. Confirm the route's actual checks when investigating access; do not assume that every legacy endpoint is strictly Super Admin only.

## 3. Logging in and account settings

1. Open the production application.
2. Enter your employee number and password.
3. Confirm your name and role after login.
4. Open **Settings** and change an initial or reset password immediately. Enter the current password, a new password of at least eight characters, and its confirmation.
5. Allow notifications if your browser asks and company policy permits them.
6. Log out when finished, especially on a shared computer.

New accounts and password resets are handled through **Employees** by an authorized manager. Initial/reset credentials must be supplied privately. An inactive account cannot use the API. If a login expires, log in again before retrying an action.

Password synchronization endpoints exist for the attendance integration, but working branch retrieval does not prove that password synchronization is working. Escalate inconsistent passwords to the maintainer rather than repeatedly resetting both systems.

## 4. Navigation and daily routine

The sidebar is filtered by your role. Common visible sections are:

| Menu | Purpose |
| --- | --- |
| Dashboard | Overview of requests, totals, and available summaries. |
| Purchase Requests | Create and follow PRs; includes review and Admin processing tabs. |
| For Reviews | Shared PR, petty cash, PO, SR, and ordinary CR review queue. |
| For Admin Processing | Requests requiring Admin preparation or processing. |
| Request Workflows | Current PO/SR/ordinary CR rounds, review, correction, receipts, and migration handling. |
| Service Requests / Cash Requests / Petty Cash Requests | Prepare and follow those request types. |
| Purchase Orders | Prepare and follow POs. |
| Payment Requests / Payment Orders | Prepare and follow linked payment documents. |
| Items / Suppliers | Catalog, supplier details, pricing, and accreditation where permitted. |
| Approvals | Legacy financial/management approvals; visible to CEO and Super Admin. |
| Employees / Audit Logs | Management functions where available. |
| Settings | Change password; database backup for the permitted UI role. |

**Daily requester routine:** Check notices and returned/rejected requests; prepare complete drafts; check the active review stage; and upload/confirm evidence only when goods, services, or cash actually arrive.

**Daily reviewer routine:** Open **For Reviews** or **Request Workflows → Awaiting my review**; check the source, project, full amount, schedules, and supporting documents; approve or reject with a specific reason; verify the result after saving.

**Daily Admin routine:** Check accreditation and processing work; confirm supplier/pricing details; prepare eligible POs/payment documents; verify receiving evidence; reconcile cash releases and petty cash liquidation; follow unresolved staffing/migration exceptions.

Disbursement Vouchers, Reimbursements, Pricing History, and Order Numbers have page routes but are currently omitted from the sidebar. Their routes are listed in section 12. The Attendance page is a placeholder. Do not describe these as normal visible sidebar menus during training.

## 5. Projects, items, and suppliers

### 5.1 Select a real, active project

Select the project from the supplied list and check its address and order number. Archived projects and locked order numbers cannot be used for relevant new operations. Do not invent a project name or manually substitute another project's order number.

Branches come from the original PHP attendance project through `https://jajr.xandree.com/get_branches_api.php`. The endpoint was restored on October 14, 2026 and verified to return 14 real branches. This is a point-in-time count; projects may change afterward.

If you see **HQ Office**, **Warehouse A**, or **Site B (Archived)** with sample addresses, stop preparing the request and report the integration failure. The current backend still contains a sample-data fallback. These are not verified company projects.

### 5.2 Items

1. Open **Items** and search before adding a new record.
2. Where your role exposes the action, add or edit the item name, code/SKU, category, unit, description, and other shown fields.
3. Use consistent units, for example pieces, meters, boxes, or service units.
4. Check supplier-linked prices before using them in a request.

The item catalog is not proof of stock on hand. Quantities belong to request/order lines and receiving records. Avoid deleting items referenced by historical documents; ask the maintainer to resolve dependency errors.

### 5.3 Suppliers and accreditation

1. Open **Suppliers** and search for the supplier before creating another record.
2. Enter accurate contact/address information and the relevant supplier-item prices.
3. Attach accreditation documents where the screen permits it.
4. Obtain the authorized accreditation decision before treating the supplier as accredited.

A PR involving an unaccredited supplier may wait in **Pending Accreditation Review**. The ordinary PR review chain resumes after the supplier accreditation step. Do not bypass this merely because the purchase is urgent; escalate to the authorized decision maker and document any exception.

## 6. Purchase Requests

PR means **Purchase Request**, not Payment Request. Check both the page title and document number when referring to a record.

### 6.1 Create and submit

1. Open **Purchase Requests** and choose the create action.
2. Select the active project and verify its order number.
3. Enter purpose, date needed, item descriptions, quantities, units, supplier information, prices, and payment basis where shown.
4. Verify the full total. For example, PHP 2,500 × 4 units = PHP 10,000.
5. Save a draft if details are incomplete. A draft is not an approval request.
6. Submit the completed request and record its PR number.
7. Follow the active status and assigned reviewers in the request/review screen.

### 6.2 Normal review reference

The maintained diagram describes these entries:

| Requester | Entry |
| --- | --- |
| Engineer | Engineer group → Admin group → amount-based final stage. |
| Admin | Admin group → amount-based final stage. |
| Other supported roles | Super Admin/CEO final stage directly. |

Below PHP 100,000, the diagram sends the normal Engineer/Admin route to the Senior Project Engineer group. PHP 100,000 or more goes to Super Admin/CEO final approval. Normal review excludes the requester and waits for assigned group reviews.

**Important current limitation:** PR has several legacy submission, resubmission, review, final-approval, and Admin-processing endpoints. Its final approval endpoint is not the new PO/SR/CR dual-role vote engine. Do not claim that every PR path enforces one Super Admin **and** one CEO. Follow the visible assignments and require management to confirm that the approval record satisfies company policy. The next maintainer must reconcile these route differences; see section 18.

### 6.3 After review

- **For Purchase:** The eligible purchase can proceed to the relevant purchasing/payment preparation. A debt PR is an eligible PO source under the new guard; non-debt processing follows its payment path.
- **Rejected / returned:** Read overall and item-specific remarks, correct the affected information, and use the PR screen's resubmission action. PR resubmission is separate from the new workflow round mechanism.
- **Pending Admin Processing:** Admin supplies the required supplier/pricing details before the next applicable reviews.
- **Completed / Received:** Inspect linked documents and actual receiving facts. Some legacy payment paths set completion statuses; a status alone is not delivery evidence.

Mobile item requests can enter Admin processing before prices/suppliers are filled in. Do not confuse an unpriced item request with a fully priced submitted PR.

The legacy **Bypass Approvals** action exists for permitted management roles, with an amount restriction on the Senior Project Engineer role. Treat it as an explicit management exception with supporting authority, not as the ordinary review process.

## 7. Shared reviews and Request Workflows

### 7.1 Reviewing

1. Open **For Reviews** and identify the request type. PO/SR/ordinary CR entries lead to **Request Workflows**.
2. Alternatively, open **Request Workflows**, choose **Awaiting my review**, and open the record.
3. Check the document, approved/submitted full amount, round number, active stage, assignments, comments, schedules, and available receipt history.
4. Enter a useful comment. Reject with the specific correction needed.
5. Choose **Approve** or **Reject** once. Wait for the result and check the refreshed record.

Only an eligible assigned reviewer in the active stage may vote. A previous-stage approval or a visible record does not grant current-stage authority. If someone else acts at the same time, refresh and inspect the committed result before retrying.

### 7.2 New PO/SR/ordinary CR approval matrix

| Document / requester | Review route |
| --- | --- |
| PO prepared by Admin | Admin group → amount-based final stage. |
| SR/ordinary CR requested by Engineer | Engineer group → Admin group → amount-based final stage. |
| SR/ordinary CR requested by Admin | Admin group → amount-based final stage. |
| SR/ordinary CR requested by another supported role | Super Admin + CEO final stage directly, including lower amounts. |

| Amount-based final stage | Required approval |
| --- | --- |
| Total below PHP 100,000 | All assigned active Senior Project Engineers. |
| Total PHP 100,000 or more | One eligible Super Admin and one eligible CEO, in either order. |

Installments do not lower approval authority. A PHP 120,000 request with three PHP 40,000 payments still needs the PHP 120,000 approval route. Totals use quantity × unit price, summed over lines where applicable, with cent rounding.

### 7.3 Hold, correction, and resubmission

- Use the available **Hold** action with a reason when the current round needs to pause. Use **Resume** only after resolving that reason.
- The owner can choose **Withdraw for correction** for an eligible review/hold/rejected round.
- Correct SR/CR drafts using **Correct draft** in Request Workflows, including payment schedules. Correct PO lines in **Purchase Orders**.
- Choose **Submit fresh review round** after checking all changes. New votes are required; old history is preserved.
- Approved records require an authorized amendment/migration decision. Do not overwrite approved financial facts or reuse an old approval for a changed amount.

The workflow list shows the latest 200 accessible records per module. Use the original module lists to find older records. An empty review queue can mean that there is no work assigned to you at the current stage.

## 8. Purchase Orders

### 8.1 Prepare the PO

1. Admin opens **Purchase Orders** and selects the eligible source: an approved debt PR in **For Purchase**, or an eligible approved SR.
2. Verify the supplier, source requester, project, delivery information, payment terms, and line items/services.
3. Enter quantities and unit prices; verify each line and the full total.
4. Save as Draft if unfinished. The normal create/submit action starts the PO's own approval round.
5. Open the PO in **Request Workflows** and follow Admin review, then the applicable final approval.

Source approval does not automatically approve the PO. For an SR-based PO, select identifiable catalog items/service lines. Do not use a legacy payment-order document as if it were the new PO workflow.

### 8.2 Record and verify delivery

1. After PO approval, the original source requester or an assigned active receiving Engineer opens the PO workflow.
2. Enter **Delivered quantity** for each delivered line. Enter only the actual delivery for this receipt event, not the full original quantity again.
3. Select the delivery receipt and choose **Record delivery receipt**.
4. Admin opens the receipt, matches its quantities to the actual delivery, and chooses **Verify receipt**.
5. If evidence is incorrect, Admin chooses **Return for correction** and supplies a reason. Upload corrected evidence as a new receipt event.

Partial verified delivery remains **Partial Received**. When all PO quantities are verified, the PO becomes **Completed**. Linked PR completion depends on all its non-cancelled POs being complete; PO approval alone does not complete the PR.

Receiver assignment is an Admin operation using an active Engineer's employee ID. If the assignment control is missing, report the UI limitation rather than changing the requester or approving without evidence; see section 18.

## 9. Service Requests

1. Open **Service Requests** and choose the create action.
2. Select the SR type: **Payment Request (Amount + Quantity)** or **Payment Order (Amount Only)** as offered by the form.
3. Enter purpose, description/scope, amount, quantity/unit where applicable, date needed, active project, supplier, terms, and schedules.
4. Verify the project/order number and full amount. An amount-only request uses quantity one for calculation where required.
5. Ensure payment schedule amounts equal the full request total.
6. Save a draft or submit; review the resulting SR in **Request Workflows**.
7. Complete the assigned approval chain. Prepare the eligible linked PO/payment document only after approval.
8. When the service is actually completed, the original requester uploads the receipt with **Confirm service complete and upload receipt**.
9. Admin verifies the evidence against the agreed work. Verified acceptance sets the SR to **Received**; incorrect evidence can be returned for correction.

Do not confirm service completion merely because a supplier issued a quotation or a payment was approved. Keep scope changes and disputed work in the record's comments and escalate approved-request amendments.

## 10. Cash Requests

Ordinary **Cash Requests** and **Petty Cash Requests** are different workflows even though they share the cash-request database table.

1. Open **Cash Requests** and choose **Create Cash Request**.
2. Select **Payment Request** or **Payment Order** as the CR type.
3. Enter purpose, amount, quantity/unit where shown, date needed, project, payee/supplier information, remarks, terms, and schedules.
4. Check the full total and ensure schedules equal it.
5. Save as Draft or submit the complete record for approval.
6. Follow the new approval round in **Request Workflows**.
7. After approval, create and approve the appropriate linked Payment Request or Payment Order. CR approval alone does not permit release.
8. Admin enters the **Actual cash release amount**, attaches a signed receipt, and chooses **Record actual release**.
9. The original requester chooses **Confirm cash received** for each actual release.

Partial releases are recorded individually. Do not enter the entire approved amount again when only a balance remains. The system rejects over-release. The full confirmed release total sets the CR to **Received**. Actual released cash is not reversed by returning an evidence record; discrepancies need a documented financial reconciliation.

## 11. Petty Cash Requests and liquidation

Petty cash uses its own approval rules. Do not apply the ordinary CR threshold or the PO/SR/CR dual-role final rule to it.

### 11.1 Prepare and review

1. Open **Petty Cash Requests** and choose **Create request** where available.
2. Enter payee name/address, active project, purpose, date needed, remarks, and detailed expense lines.
3. Check the requested amount and save the draft.
4. Submit and follow the active assigned group in the petty cash page or shared review queue.
5. Reviewers approve or reject with a reason. All pending assignments for a petty cash stage must be resolved before it advances.

| Requester | Initial stage | Final stage after Engineer/Admin steps |
| --- | --- | --- |
| Engineer | Engineer → Admin | At or below PHP 100,000: Senior Project Engineer; above PHP 100,000: CEO. |
| CEO | Engineer → Admin | Senior Project Engineer, regardless of amount. |
| Senior Project Engineer | Engineer → Admin | CEO, regardless of amount. |
| Admin / Super Admin | Admin | At or below PHP 100,000: Senior Project Engineer; above PHP 100,000: CEO. |

The current create endpoint excludes the Procurement role. The initial/final routing comes from the separate petty cash rule helper. Older petty cash final-stage records have compatibility handling; follow their actual assignments.

### 11.2 Release and receipt

1. After **Approved**, authorized Admin/Super Admin/CEO staff record cash release through the available action.
2. The petty cash request becomes **Released**.
3. The original requester confirms actual cash receipt. The request becomes **Received**.

This release flow differs from ordinary CR's signed-receipt-per-release workflow. Retain the physical release evidence required by finance even when the petty cash release screen does not collect it.

### 11.3 Liquidate and close

1. After receipt, open the request and start the actual-expenses/liquidation form.
2. Enter each actual expense and attach at least one receipt per expense.
3. Enter any cash returned, its return receipt/reference, and notes.
4. Choose **Submit to Finance**. The request becomes **Liquidation Submitted**.
5. Authorized Finance reviewers (Admin, Super Admin, or CEO in the current implementation) inspect receipts and independently verify returned cash.
6. Use **Verify & close** only when actual expenses plus verified cash returned equal the released amount.
7. If returned for correction, read the finance note, correct the submission, and resubmit. Preserve earlier evidence and submission history.

Example: PHP 5,000 released, PHP 4,200 spent, and PHP 800 returned reconciles to PHP 5,000. **Received** is not the same as **Closed**; it only confirms cash reached the requester.

Petty cash liquidation accepts JPEG, PNG, GIF, or PDF receipts, up to 5 MB per file; its upload handler permits up to 20 files per request. These limits differ from PO/SR/ordinary CR receipts.

## 12. Payment documents and reimbursements

### 12.1 Payment Request

Use the **Payment Requests** page for a payment document tied to the eligible source. Verify source number, payee, project/order number, amount, schedule, and terms. Save/submit according to the available controls, obtain the document's approval, and follow its subsequent payment process.

Do not create a duplicate document merely because a previous create request appeared slow. Inspect the source and existing links first. New workflow guards require current source approval and prevent conflicting payment-document creation. Legacy Payment Request approval can change the linked PR's status; verify delivery separately.

### 12.2 Payment Order

Use **Payment Orders** for the eligible SR/CR/reimbursement payment path. Verify source, payee, amount, terms, and status; use authorized review/hold/rejection actions. A **Payment Order** is not a **Purchase Order**, despite both sometimes being abbreviated PO in older code or documents.

Payment documents retain legacy approval/status endpoints and do not automatically inherit the new dual-role review round. If an existing source is restarted for review, linked-document processing is blocked until the source's required approval is restored.

### 12.3 Disbursement Vouchers

Page route: `/dashboard/disbursement-vouchers`; currently hidden from the sidebar.

Authorized finance staff prepare a voucher from the eligible approved source/payment document, check its amount and payment references, record accounting certification, obtain manager certification, and record actual payment details. Export the voucher where offered and retain the supporting payment evidence.

Do not interpret a voucher certification as a bank transaction. Record **Paid** only after the real payment occurs. The legacy route checks are not a complete substitute for finance's verification of certification and payment evidence.

### 12.4 Reimbursements

Page route: `/dashboard/reimbursements`; currently hidden from the sidebar.

Prepare the expense reimbursement with supporting attachments and schedules; submit through its own page. Its current approval route is Admin review followed by Super Admin review, with approved records entering **For Purchase**. Use its own resubmission/receipt functions and eligible payment-document path. It is not part of the new PO/SR/ordinary CR round engine.

### 12.5 Exporting

Use the record's available **Export** action to download its Excel document. Check the number, totals, project, and approval information before printing or sharing it. Store exports in a company-controlled folder using a consistent convention, for example `PR_<number>_<date>.xlsx`. Exported files are copies; current system records remain the reference for status and history.

## 13. Statuses, corrections, and evidence

| Status / message | Meaning and next action |
| --- | --- |
| Draft | Preparation only. Complete details and explicitly submit. |
| For Engineer / Admin / Senior Project Engineer Review | Assigned members of that active group must review. |
| For Super Admin Final Approval | Identify the module: new PO/SR/CR needs both final roles; legacy modules have different checks. |
| On Hold | Resolve the recorded reason and use the authorized resume/process action. |
| Rejected / Returned | Read the reason; correct through the appropriate module and submit again where allowed. |
| Approved | Approval complete for that document; it does not prove payment, delivery, or receipt. |
| For Purchase | Eligible for the applicable purchasing/payment preparation, subject to source rules. |
| Partial Received | Some PO quantities verified; remaining quantities still require delivery and evidence. |
| Released | Cash release recorded; requester confirmation may still be required. |
| Received | Receipt/acceptance recorded according to that module; petty cash may still need liquidation. |
| Liquidation Submitted / Liquidation Returned / Closed | Petty cash finance review, correction, or fully reconciled closure. |
| Needs submission / migration review | No current new workflow round; inspect eligibility and historical documents. |

PO/SR/ordinary CR evidence accepts PNG, JPEG, or PDF up to 10 MB per file. Files must be actual supported file content, not a renamed unsupported format. Receipt access requires authorization; use the in-app download rather than sharing a private filesystem path.

Keep the document number, round, receipt/release event, and correction reason together when reporting an issue. Never delete a paid or partially fulfilled record to make its status look correct. Do not use direct database edits for ordinary correction.

## 14. Reports, notifications, and audit

Dashboard summaries help identify outstanding work. They are not a certified accounting ledger. Review linked request/payment records and actual evidence when reconciling totals.

The notification bell provides in-app alerts. Browser push and notification sounds depend on permission, browser support, and device settings; a blocked sound or push service does not itself prevent reviews. Open the work queues even when no notification appears.

New workflow screens refresh from committed server data after events, on reconnect/focus, and through 10-second reconciliation. The bell also has a separate 60-second refresh. Network and event delays still exist; watch **Last fetched** and the connection status, and refresh before acting on a disconnected view. The general always-live requirement has not been verified for every older page.

**Audit Logs** records supported application actions. Inspect workflow round/review/receipt history as well when investigating a request. Some legacy logging is separate from the new durable workflow outbox.

Additional page routes: `/dashboard/pricing-history` and `/dashboard/order-numbers`. These are currently hidden from the sidebar. Order-number functions include project breakdowns, budgets, and locks. A lock is a business restriction; do not remove it to bypass a payment/request error without the responsible manager's decision.

## 15. Troubleshooting

| Symptom | What to do |
| --- | --- |
| Cannot log in | Check employee number; ask an authorized manager to confirm account activation/reset. |
| Session expired / HTTP 401 | Log in again. Do not keep retrying with the old session. |
| Access denied / HTTP 403 | Verify role, requester identity, active stage, and review assignment. |
| No requests awaiting review | Check filters, type, assignment, and active stage; the queue may correctly be empty. |
| Other reviewers still pending | Wait for all required assigned group members; check whether anyone was deactivated. |
| Final approval still pending | For new PO/SR/CR, verify both an eligible Super Admin and CEO have approved. |
| Project invalid / archived / order locked | Verify the actual active project and lock reason; escalate data changes to its owner. |
| Sample projects or HTML/JSON parse error | Branch API is failing. Do not use sample projects; maintainer checks the exact PHP route. |
| Release unavailable after CR approval | Check the approved linked Payment Request/Payment Order and any restarted source round. |
| Receipt rejected | Check file content/type/size, authorized uploader, quantities, amount, and approval state. |
| Schedule total error | Make all schedule amounts add up to the full quantity × unit-price total. |
| Connection status disconnected | Check connection, refresh, and verify server health; inspect the saved record before repeating an action. |
| HTTP 500 / Unknown column | Maintainer inspects timestamped backend logs and schema upgrade prerequisites. |
| Backup request calls localhost | Deploy commit `d3a5952` or later, rebuild the frontend with the production API setting, and hard-refresh. |
| Excel export fails | Check the relevant template under `backend/templates/` and backend logs. |

When reporting an error, include the page, document type/number, action, date/time, your role, and a screenshot of the error. Exclude passwords, tokens, full environment files, and private financial records from public tickets.

## 16. Technical handover and deployment

### 16.1 Components and ownership

| Component | Purpose / persistence |
| --- | --- |
| `frontend/` | React/Vite web UI, packaged into an Nginx container. |
| `backend/` | Node/Express API, Socket.IO, workflow services, reminder job, and outbox. |
| `mobile/` | Separate Expo/React Native application and release process. |
| MariaDB | Production business records, approval rounds, receipt metadata, audit/notifications, and events. |
| Redis | Internal reference cache and Socket.IO distribution; not the business-record database. |
| Docker volumes | DB, public uploads, and new private workflow evidence. See petty cash exception below. |
| Host Nginx / Certbot | Domain routing and HTTPS; the VPS hosts other applications too. |

Production uses root `docker-compose.yml`, Node 22 images, MariaDB 10.4, and Redis 7.4. Local development uses the existing Windows/WAMP database setup. Do not mistake the separate `backend/docker-compose.yml`, older deploy manuals, or SQL seed dumps for the live production deployment procedure.

| Service | Container / host binding |
| --- | --- |
| Backend | `procurement_backend`, `127.0.0.1:5001` → container port 5000. |
| Frontend | `procurement_frontend`, `127.0.0.1:8081` → container port 80. |
| Database | `procurement_db`, internal port 3306; no root Compose public DB binding. |
| Redis | Typically `procurement-redis-1`, internal port 6379; no published port. |
| Adminer | `procurement_adminer`, optional profile, localhost port 8082. |

### 16.2 Configuration

Use `/opt/procurement/.env.prod` on the VPS and the example at `deploy/.env.prod.example` as a field reference. Transfer secrets privately; retain restrictive permissions on the production file.

Important settings include database credentials, JWT secret/expiry, `REDIS_PASSWORD`, authenticated `REDIS_URL`, `VITE_API_URL`, allowed CORS origins, VAPID browser-push keys, and attendance integration settings. Redis password/URL must agree; URL-encode passwords when necessary. Frontend `VITE_API_URL` is baked into the build, so changing runtime environment alone does not update the browser bundle.

`BRANCHES_API_URL` is read by the backend helper, but the root Compose backend environment currently does not pass it from the production environment file. The current working URL uses the helper default. Adding a replacement URL requires explicit Compose configuration and verification of the payload fields.

### 16.3 Routine status checks

Run in the VPS project directory:

```bash
cd /var/www/Procurement
docker compose --env-file /opt/procurement/.env.prod ps
curl -fsS http://127.0.0.1:5001/api/health
docker logs --since 10m --timestamps procurement_backend
```

Healthy application output reports database connected and Redis configured/connected. Container startup and application readiness are different; an immediate curl after recreation may fail briefly. Retry the health check after startup and inspect logs if it remains unavailable.

Use `--since` and `--timestamps` when troubleshooting. `--tail 100` can show already-resolved historical errors. Press Ctrl+C to stop following logs; this does not stop the container.

### 16.4 Safe update of this existing production installation

1. Review the change and confirm whether it includes schema changes.
2. Check local changes with `git status --short`; reconcile deployment-specific work before pulling.
3. Back up database and receipt/upload storage; record the previous deployed commit.
4. Fetch and fast-forward the selected approved release. Do not routinely use `git reset --hard`.
5. Build only affected services, run the explicit schema tool if required, then recreate affected application services.
6. Verify health, real project data, login, representative pages, and the changed feature.

Frontend-only fix:

```bash
cd /var/www/Procurement
git status --short
git pull --ff-only origin main
docker compose --env-file /opt/procurement/.env.prod up -d --build --no-deps frontend
```

Backend change, after backup and review:

```bash
docker compose --env-file /opt/procurement/.env.prod build backend
# Run only when the approved release needs additive workflow schema preparation:
docker compose --env-file /opt/procurement/.env.prod run --rm --no-deps backend \
  node scripts/requestWorkflowMigration.js --schema
docker compose --env-file /opt/procurement/.env.prod up -d --no-deps backend
```

Use `&&` or stop immediately if a deployment step fails; never continue after a failed schema preparation. Do not run generic historical migration scripts or import SQL dumps into production as an upgrade. The explicit schema command adds checked workflow/cash/petty-cash/payment prerequisites, preserves existing status values, and does not restart requests.

Do not use `docker compose down -v` on this installation. Its volumes contain company records and evidence. Do not replace database credentials or rotate Redis/JWT secrets casually during a UI update.

### 16.5 Branch API dependency — preserve this route

The original branch endpoint lives at `/var/www/jajr-project/get_branches_api.php`, served through the existing port-8888 PHP site using PHP 8.3 FPM. The `jajr.xandree.com` HTTPS site otherwise proxies the attendance frontend to port 7001.

The following exact location was added to the first HTTPS server block of `/etc/nginx/sites-enabled/jajr`:

```nginx
location = /get_branches_api.php {
    proxy_pass http://127.0.0.1:8888;
    proxy_set_header Host 72.62.256.60;
}
```

The Host value matches the existing PHP site's configured `server_name`; it is a legacy typo, not the VPS IP to use for SSH. Do not copy it as a connection address. Do not edit other attendance routes to fix Procurement. Back up the resolved Nginx configuration, run `nginx -t`, and reload only after validation.

Verification commands:

```bash
curl -fsS --max-time 15 -H 'Host: 72.62.256.60' \
  http://127.0.0.1:8888/get_branches_api.php
curl -fsS --max-time 15 https://jajr.xandree.com/get_branches_api.php
curl -I --max-time 15 https://jajr.xandree.com/
```

Expected branch payload: `success: true` and a `branches` array with `id`, `branch_name`, `branch_address`, `order_number`, and `is_active`. HTTP 200 containing HTML is a failed API result. The Nginx backup made during the verified repair is `/root/jajr-nginx.backup-20261014-142414`.

### 16.6 Existing-request migration

The agreed transition restarts **all unpaid/unfulfilled eligible PO/SR/ordinary CR records, including approved ones**, with linked documents reviewed individually. Completed payments, actual releases, deliveries, and previous history must be preserved. This is not a blanket approval or deletion process.

Admin opens **Request Workflows → Inspect migration inventory and exceptions**, opens an eligible record, chooses **Inspect linked documents**, records a disposition for each document and an overall note, then uses **Record review and restart approval**. Partially fulfilled records require reconciliation of the actual remaining balance. Orphan source/requester/line records are repair exceptions; do not fabricate replacements.

Read-only inventory command:

```bash
docker compose --env-file /opt/procurement/.env.prod run --rm --no-deps backend \
  node scripts/requestWorkflowMigration.js --inventory
```

The CLI restart option is restricted to inspected records without linked documents and an active Admin actor. Use the Admin UI for linked documents. Schema preparation does not prove that production inventory migration is finished.

### 16.7 Development and validation

Use Node 22 for consistency with Docker. Install dependencies using each package's lockfile (`npm ci`). Start WAMP's MySQL service for local database work; set explicit backend port/database configuration and matching frontend API configuration. The backend's fallback port is 5005, while frontend's development API fallback is 5001; do not rely on those mismatched defaults.

Backend: `npm run dev` or `npm start`. Frontend: `npm run dev`. Follow Vite's displayed local URL. Point Redis configuration to an available authenticated instance when testing Redis behavior.

Relevant checks, run from the named package directory:

| Directory | Command |
| --- | --- |
| `backend/` | `npm test -- --runInBand` |
| `backend/` | `npm run test:workflows` |
| `frontend/` | `npm test -- --run` |
| `frontend/` | `npm run build` |

The workflow integration script clones schema into a uniquely named temporary test database and drops that generated database after testing. It needs permission to create/drop that test database. Inspect its configuration before running; use synthetic data, not production test transactions.

Recorded verification: 20 backend unit tests, 8 frontend tests, and 17 workflow integration checks passed during the workflow work; the frontend build passed for `d3a5952`. These results are not a complete security audit or a production load benchmark. Actual production Redis connectivity was verified; multi-worker/outage recovery tests remain separate tasks.

## 17. Backup and recovery

### 17.1 What to preserve

A complete turnover backup includes:

- SQL database and recorded release commit.
- Public uploads volume (`backend_uploads`) and private workflow receipts volume (`backend_private`). Actual volume names depend on the Compose project prefix.
- Petty cash liquidation files at `/app/private_uploads/petty_cash` inside the current backend container; see the persistence issue below.
- Production environment file, company-controlled access credentials, Nginx configuration, and HTTPS/DNS ownership.
- Excel templates and any intentional deployment-specific changes.

Redis contains disposable cache/distribution state and is not a replacement for these backups. An SQL download alone does not contain receipt file contents.

### 17.2 Download database backup

The Super Admin UI provides **Settings → database backup**. Download the SQL file to an approved secure location, verify it is non-empty, record its date, and test restoration on an isolated database. The fix in `d3a5952` uses the configured API URL instead of localhost; its VPS deployment must be verified after the frontend rebuild.

The current backup endpoint uses a date-based temporary SQL filename in the backend application directory. Avoid simultaneous backup downloads because the filename is shared. A backup generated while records are changing is not automatically a verified consistent recovery point; schedule and test backups with the maintainer.

### 17.3 Capture missing-container storage before recreation

**Current gap:** Root Compose persists `/app/private`, but petty cash liquidation writes under `/app/private_uploads/petty_cash`, which has no persistent volume mount. Backend recreation can lose those files. Preserve them before rebuilding/recreating the backend, and have the maintainer implement/test the storage fix.

For the current backend container, this copies that directory without changing it:

```bash
task_backup_dir="/opt/procurement/backups/$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$task_backup_dir"
docker cp procurement_backend:/app/private_uploads/petty_cash \
  "$task_backup_dir/petty_cash"
```

If the directory does not exist, confirm that no liquidation files were uploaded; do not assume a failed copy is a successful backup. Protect the copied data and transfer a second verified copy to company-controlled backup storage. Do not paste receipt contents or database dumps into public support tools.

### 17.4 Recovery procedure

1. Identify the incident time, last good commit, backup, and affected records/files.
2. Stop conflicting writes through a planned maintenance window.
3. Restore first to an isolated environment; verify schema, row counts, attachments, approvals, and financial totals.
4. Decide whether application rollback alone is sufficient or whether data restoration is required. Additive schema changes should not be reversed blindly.
5. Perform the authorized production recovery, verify health and representative workflows, and reconcile any transactions after the backup time.
6. Record the incident, recovery steps, and business owner acceptance.

There is no current web UI restore function. Restoration is a maintainer task. Do not import an old SQL file over a live database without an approved recovery plan.

## 18. Outstanding items for the next maintainer

These findings were identified during the code/documentation review. They are not represented as completed fixes.

| Priority | Finding | Next action |
| --- | --- | --- |
| High | Petty cash liquidation files lack a persistent Compose mount. | Preserve current files before container replacement; add an appropriate private volume/path, migrate existing files, and test authenticated download after recreation. |
| High | PR has differing legacy routes and does not consistently implement the new dual-role final vote requirement. | Review each PR entry/review/final/resubmit/Admin-processing path with management; agree policy and test the exact paths before changing business logic. |
| High | Production existing-request restart completion has not been established. | Run inventory and reconcile unpaid/unfulfilled records individually; preserve payments/deliveries and record exceptions. |
| High | Branch API failure still returns sample projects. | Replace fabricated fallback with a clear unavailable result or an explicitly approved verified-data policy; test validation during outages. |
| Medium | PO receiver assignment UI is nested in a receipt-upload permission section. Admin may not see it when not an eligible uploader. | Separate the authorized assignment control from upload permission; test source-requester/assigned-Engineer/Admin combinations. |
| Medium | Not every legacy view has verified live refresh. | Inventory views, events, polling, and cache behavior; verify the user's always-live requirement beyond the new workflow screens. |
| Medium | Legacy authorization helpers are broader than their names; financial endpoints have differing status checks. | Review role access and transition guards across employee management, backup, payment orders/requests, vouchers, and reimbursements. |
| Medium | Backup endpoint has a shared filename and SQL-only coverage. | Use unique private temporary files, reliable cleanup, tested consistency, and scheduled DB-plus-evidence backups. |
| Medium | Backup URL fix is pushed but VPS/frontend deployment was not verified afterward. | Deploy `d3a5952` or later; test a real authorized download and retain a verified backup. |
| Medium | Password synchronization and mobile release parity are unverified. | Confirm integration endpoint, keys, ownership, release version, supported screens, and release tests. |
| Medium | Windows runtime defaults differ; branch URL is not passed by root Compose. | Document explicit ports and add tested environment wiring when needed. |
| Low | Older manuals/plans contain obsolete roles, threshold assumptions, and deployment guidance. | Prefer current code and this manual; update older documents after approved changes. |

Other known local facts: PO #1 was an orphan repair exception with missing source/preparer/lines; PO #2 was restarted locally. These are local results, not proof of production state. Unrelated daily-report edits and screenshots were not included in the workflow commits; let their owner decide their disposition.

## 19. Turnover acceptance checklist

Fill in the responsible people before the resigning employee's access is removed:

| Responsibility | Incoming employee / team | Acceptance date |
| --- | --- | --- |
| Business/process owner | Marc Justin Arzadon | Pending |
| Admin purchasing operations | Elain Aguilar; Marjorie Garcia; Lyra Javonillo | Pending |
| Finance release/payment/liquidation | Not confirmed | Pending |
| Approving managers | Michelle Norial; Mar Justin Arzadon (confirm spelling/identity) | Pending |
| Super Admin/CEO approval coverage | Actual employee roles/assignments to verify | Pending |
| Application maintainer | None assigned | Pending |
| VPS/Docker/Nginx/backup owner | To be assigned | |
| Branch API / attendance integration owner | To be assigned | |
| GitHub/DNS/hosting account owner | To be assigned | |

The owner name was supplied as Marc Justin Arzadon and an approving manager as Mar Justin Arzadon. Confirm whether these identify the same person. Named responsibilities do not create application accounts or assign approval roles. No last working day was provided. Use the [ownership register](turnover/OWNERSHIP.md) and [acceptance form](turnover/ACCEPTANCE.md) for the completed execution record.

### Employee training and acceptance

- [ ] Incoming employees can log in with their own active accounts and correct roles.
- [ ] Requester can prepare a draft and explain submission versus approval.
- [ ] Reviewers can find assigned requests and identify the current stage.
- [ ] Team can explain the PHP 100,000 boundary, higher-role entry, and separate petty cash rule.
- [ ] Admin can prepare eligible POs/payment documents without duplicating links.
- [ ] Team can demonstrate partial PO receiving, service acceptance, cash release/confirmation, and petty cash liquidation using isolated test data.
- [ ] Team understands rejection/correction history and migration exceptions.
- [ ] Finance can reconcile payment, release, receipt, and liquidation evidence.

### Technical acceptance

- [ ] Repository, approved release, and deployment paths are recorded.
- [ ] Hosting, GitHub, DNS, TLS renewal, integration, and secret ownership transferred securely.
- [ ] Database and every evidence directory backed up; a recovery test completed.
- [ ] Petty cash receipt persistence gap addressed or explicitly assigned with a protective backup procedure.
- [ ] Health, real branches, login, backup, and representative screens verified.
- [ ] Existing-request migration inventory reconciled and exceptions assigned.
- [ ] Outstanding findings have owners and target dates.
- [ ] Departing employee's application, GitHub, VPS, hosting, and integration access removed after acceptance; required approver replacement planned first.
- [ ] Temporary support SSH keys removed. The temporary key used for the October 14 branch-route repair was already removed.

Do not delete the departing employee's historical requester/reviewer identity. Deactivate access after assigning ownership and handling outstanding review assignments so the audit trail remains intact.

## 20. Source reference and glossary

### Maintainer source map

| Topic | Primary source |
| --- | --- |
| Visible menus / page routes | `frontend/src/config/navigation.js`, `frontend/src/routes/AppRoutes.jsx` |
| New workflow screens and receipts | `frontend/src/components/RequestWorkflows.jsx` |
| New rules / totals / groups | `backend/utils/requestWorkflowRules.js`, `backend/services/requestWorkflow.js` |
| Workflow API / receiving / migration | `backend/routes/requestWorkflows.js`, `backend/services/requestWorkflowMigration.js` |
| Legacy mutation/payment guards | `backend/middleware/requestWorkflowGuard.js` |
| PR behavior | `backend/routes/purchaseRequests.js` |
| Petty cash behavior / liquidation | `backend/routes/pettyCashRequests.js`, `backend/utils/pettyCashReviewFlow.js` |
| Payment/voucher/reimbursement behavior | Corresponding files in `backend/routes/` |
| Auth roles / employees / backup | `backend/middleware/auth.js`, `backend/routes/employees.js`, `backend/routes/settings.js` |
| Project integration | `backend/utils/branchProjects.js`, `backend/routes/projects.js` |
| SQL upgrade | `backend/services/requestWorkflowSchema.js`, `backend/scripts/requestWorkflowMigration.js` |
| Live reads / cache / socket/outbox | `frontend/src/services/api.js`, `frontend/src/hooks/useLiveWorkflowRefresh.js`, `backend/services/redisCache.js`, `backend/jobs/requestWorkflowOutbox.js`, backend socket utilities |
| Hosting | Root `docker-compose.yml`, Dockerfiles, `deploy/`, production environment, host Nginx |
| Diagram and implementation details | [system-flowchart.md](system-flowchart.md), [workflow implementation](docs/PO_SR_CR_IMPLEMENTATION.md) |

### Glossary

| Term | Meaning |
| --- | --- |
| PR | Purchase Request; Payment Request is a separate document. |
| PO | Purchase Order; write Payment Order in full to avoid ambiguity. |
| SR / CR / PCR | Service Request / ordinary Cash Request / Petty Cash Request. |
| DV | Disbursement Voucher. |
| Review round | A submission and its assigned decisions; a new round preserves previous history. |
| Source document | Request from which an order/payment document is created. |
| Disposition | Recorded handling decision for an individually inspected linked historical document. |
| Liquidation | Reconciliation of actual petty cash expenses and returned balance against cash released. |
| Redis | Disposable reference cache and socket distribution service; SQL holds business facts. |
| Outbox | SQL record of committed workflow events to be delivered/retried. |
| No-store | Workflow/API responses instruct browsers not to retain a reusable response cache. |

Update this manual when approval policy, screens, hosting, integration, or evidence storage changes. Record the date and reviewed release so the next employee can distinguish current operating instructions from historical plans.
