# Project Worklog

## October 14, 2026 — Workflows, production support, and turnover

### Workflow implementation

- Reviewed and revised the PO, SR, and ordinary CR flow against the PR reference and agreed business rules.
- Implemented dedicated approval rounds, requester exclusion, all-member Engineer/Admin/Senior Project Engineer groups, and full-amount threshold routing.
- New PO/SR/ordinary CR final approval requires one eligible Super Admin and one eligible CEO. PHP 100,000 is included in the higher approval bracket; supported higher-role SR/CR requesters enter the final stage directly.
- Added draft correction/resubmission, holds, private receiving/release receipts, partial PO delivery verification, SR acceptance, and ordinary cash release/confirmation.
- Added linked-payment approval guards, duplicate/source checks, historical-request migration inventory, and individual linked-document dispositions.
- Added SQL-backed live workflow reads, authenticated socket updates, reconnect/focus refresh, reconciliation polling, durable event delivery, and Redis reference-cache/socket support.
- Preserved the separate PR and petty cash implementations; legacy PR approval paths remain an identified policy/implementation follow-up.
- Published implementation commit `7454d02` — `Implement PO, service and cash workflows with live reviews and Redis support`.

### Schema upgrade repair

- Investigated reported production HTTP 500 errors caused by missing cash-request kind, payment-request cash linkage, and payment-order reimbursement linkage columns.
- Added a checked additive schema-preparation service covering workflow, cash, petty cash, and payment prerequisites for older installations.
- Preserved existing records, enum values/defaults, and history; schema preparation does not restart requests.
- Added an isolated older-schema upgrade check and verified repeated preparation plus affected endpoint reads on synthetic test data.
- Published repair commit `4aa2303` — `Fix workflow upgrade prerequisites for older production schemas`.

### Verification recorded during workflow work

- Backend unit suite: 20 tests passed.
- Frontend test suite: 8 tests passed.
- Isolated workflow integration checks: 17 passed after the prerequisite repair.
- Frontend production builds passed, including the backup URL fix.
- Integration checks used a generated schema-only test database and synthetic fixtures, not production test transactions.
- These results are recorded from the workflow work; they are not a full security audit, recovery exercise, or production capacity benchmark.

### Production setup and branch API repair

- Guided production Redis environment setup and service startup after Compose reported missing `REDIS_URL` / `REDIS_PASSWORD`.
- Recorded successful production health output with database and Redis connected.
- Investigated the branch API returning the attendance frontend HTML with HTTP 200 instead of JSON.
- Confirmed the original PHP endpoint existed under `/var/www/jajr-project`, served by the existing port-8888 site.
- Used explicitly authorized temporary SSH access to back up and add only the exact `/get_branches_api.php` route in the `jajr.xandree.com` HTTPS configuration.
- Validated Nginx configuration, verified 14 real branches from the public endpoint, checked the backend container and Procurement project loader, and confirmed the attendance homepage content was unchanged.
- Verified database and Redis health after the repair. No other project code or routes were changed.
- The verified route backup is `/root/jajr-nginx.backup-20261014-142414`.
- Removed temporary SSH authorization and the local temporary key pair after completing the work.
- Subsequent log review distinguished historical branch warnings from new timestamped activity. Ongoing availability requires normal monitoring.

### Settings backup URL fix

- Replaced the Settings backup button's hardcoded localhost URL with the configured shared API client and authenticated blob download.
- Frontend production build passed.
- Published commit `d3a5952` — `Fix backup download to use configured API URL`.
- Supplied the frontend-only VPS update command. Actual VPS deployment and an authorized successful backup download were not confirmed afterward.

### Turnover documentation

- Created [user manual.md](user%20manual.md) covering roles, navigation, request/review/payment flows, evidence, liquidation, troubleshooting, hosting, backup/recovery, and handover acceptance.
- Created [project_setup.md](project_setup.md) for employees without programming experience, separating online use, Windows local setup, and qualified-maintainer server tasks.
- Created the [turnover package](turnover/README.md):
  - Named ownership and responsibility register.
  - Secure access-transfer and departure-revocation register.
  - Prioritized outstanding-work register with completion evidence.
  - Backup, isolated recovery, and support runbook.
  - Practical training scenarios and individual completion record.
  - Acceptance form distinguishing prepared documents from completed handover tasks.
- Linked the manuals to the package and added the supplied incoming owners.
- Checked all nine documents for relative file links, closed code blocks, and formatting; reviewed for accidental credential strings.
- Published documentation commit `6bead05` — `Add employee turnover manuals, ownership and acceptance package`.
- Backup/recovery commands are documented procedures; they were not executed as part of the documentation work.
- Unrelated local daily-report edits and screenshots were excluded from these commits.

### Named receivers and unresolved ownership

| Responsibility | Supplied person(s) / status |
| --- | --- |
| Business owner | Marc Justin Arzadon |
| Admin operators | Elain Aguilar, Marjorie Garcia, Lyra Javonillo |
| Approving managers | Michelle Norial, Mar Justin Arzadon |
| IT maintainer | None assigned |
| Finance officer | Not confirmed |
| Departing employee / last working day | Not provided |

Confirm Marc/Mar Justin Arzadon's spelling and whether these identify the same person before acceptance. Names in documentation do not assign application roles, grant access, or constitute receiver acknowledgment.

### Remaining work

- Assign qualified technical support and a finance owner; verify actual application roles and approval coverage.
- Protect and fix petty cash liquidation file persistence before any backend recreation. Its current `/app/private_uploads/petty_cash` path has no persistent root Compose mount.
- Produce complete database/evidence/configuration backups, retain a protected second copy, and complete an isolated recovery exercise.
- Reconcile production unpaid/unfulfilled requests and linked documents individually; preserve actual payments, cash releases, deliveries, and history.
- Resolve legacy PR approval-path policy differences with management before changing business logic.
- Replace fabricated project fallback with approved outage behavior, review PO receiver-assignment UI visibility, and verify live behavior across older pages.
- Verify backup fix deployment/download, review legacy authorization and backup concurrency, and confirm password/mobile integration ownership and support.
- Transfer company-controlled access, complete practical training, obtain written acceptance, and revoke departure access after ownership and pending assignments are handled.

Use [OUTSTANDING_WORK.md](turnover/OUTSTANDING_WORK.md) for issue IDs, proposed accountable parties, completion evidence, and execution updates. Documentation preparation is complete; operational turnover and unresolved technical remediation are not recorded as complete.
