# Turnover Training Plan and Completion Record

**Participants:** Elain Aguilar, Marjorie Garcia, Lyra Javonillo, Marc Justin Arzadon, Michelle Norial, and Mar Justin Arzadon (identity/spelling to confirm). Include the finance owner and technical maintainer once appointed.

**Trainer:** To be assigned.

**Training date/location:** To be scheduled.

**Environment:** Separate prepared training database and application. Do not create fake financial transactions or test approvals in production.

The schedule below is proposed. Extend sessions until each receiver can demonstrate the assigned tasks without the trainer operating the screen for them.

## Sessions

| Session | Suggested duration | Audience | Demonstration / receiver task |
| --- | --- | --- | --- |
| 1. Access and navigation | 30 minutes | Everyone | Log in individually, verify role, change initial password, identify menus, find request/review queues, and log out. |
| 2. Requests and reviews | 60 minutes | Operators and reviewers | Prepare PR/SR/CR drafts, verify project and full total, submit, identify active stage, review, reject with reason, and correct/resubmit. Explain PR legacy differences. |
| 3. Purchasing and delivery | 45 minutes | Admin/receiving staff | Create an eligible PO, follow its own review, record partial line delivery with receipt, Admin verifies, then record the balance without duplicating quantities. |
| 4. Payments, release, liquidation | 60 minutes | Admin and finance | Find current approved linked documents, record ordinary cash release/confirmation, reconcile petty cash expenses and cash returned, return incorrect liquidation, and close only after verification. |
| 5. Support and technical handover | 45 minutes | Managers and appointed IT | Use health/log checks, explain backups/storage risks, locate recovery evidence, preserve integration routing, and complete access/revocation planning. |

## Practical scenarios and expected outcomes

| ID | Training exercise | Expected outcome / evidence |
| --- | --- | --- |
| S01 | Draft with missing/incorrect information | Receiver knows Draft is not approval; corrects before submitting. |
| S02 | New Engineer SR/CR | Engineer group then Admin group, then full-amount final stage; requester cannot vote for self. |
| S03 | New PO totals PHP 99,999.99 and PHP 100,000 | First reaches Senior Project Engineer group; second requires one Super Admin and one CEO. Sufficient separate training reviewers exist. |
| S04 | Higher-role SR/CR below threshold | Receiver explains direct final entry and both required final roles. |
| S05 | PHP 120,000 total with three PHP 40,000 installments | Final authority uses PHP 120,000; schedules sum to that amount. |
| S06 | Reject/hold/correct new workflow | Clear reason, authorized correction/resume, correct fresh round, and preserved earlier history. |
| S07 | Partial PO delivery | Only actual line quantities uploaded; Admin verification advances partial/full receiving correctly. |
| S08 | Service acceptance | Receipt represents completed scope; authorized requester upload and Admin verification. |
| S09 | Ordinary CR approval without linked payment approval | Release remains blocked; no simulated real cash movement. |
| S10 | Partial ordinary cash releases | Evidence per actual release, requester confirmation, correct remaining balance, no over-release. |
| S11 | Petty cash exactly PHP 100,000 | Receiver explains the separate at-or-below threshold and requester-specific final routing; does not apply ordinary CR rule. |
| S12 | PHP 5,000 petty cash, PHP 4,200 expenses, PHP 800 returned | Receipts supplied; finance independently verifies return; total reconciles before Closed. |
| S13 | Sample projects, disconnected view, HTTP error | Receiver stops unsafe submission, refreshes/records context, and reports without deleting records. |
| S14 | Unpaid/unfulfilled historical request with linked documents | Admin explains individual dispositions and preserved paid/delivered amounts; no blanket reset. |
| S15 | Backup and isolated recovery | Qualified maintainer demonstrates DB and all receipt files, protected second copy, checksums, and successful test restore. |

If an identified defect prevents a scenario, record it as **Blocked** with the issue ID from `OUTSTANDING_WORK.md`. Do not mark it passed because the trainer explained the intended future behavior.

## Individual completion record

| Receiver | Assigned sessions / scenarios | Passed / blocked / needs practice | Evidence location | Trainer / date | Receiver acknowledgment |
| --- | --- | --- | --- | --- | --- |
| Elain Aguilar | To confirm by role | Pending | | | |
| Marjorie Garcia | To confirm by role | Pending | | | |
| Lyra Javonillo | To confirm by role | Pending | | | |
| Marc Justin Arzadon | Ownership, access, support, policy | Pending | | | |
| Michelle Norial | Approval, policy, acceptance | Pending | | | |
| Mar Justin Arzadon | Approval, policy, acceptance; identity to confirm | Pending | | | |
| Finance owner | Release/payment/liquidation | Unassigned | | | |
| Technical maintainer | Setup/backup/recovery/deployment/support | Unassigned | | | |

Record each attendee's actual system role and account separately in the access register. Attendance at training does not assign application authority.

## Trainer notes

```text
Session/date:
Receiver and verified role:
Training application/database identifier:
Scenario(s) demonstrated by receiver:
Document identifiers (training only):
Pass criteria met:
Blocked items / issue IDs:
Additional practice needed:
Next session / responsible person:
Evidence location:
```
