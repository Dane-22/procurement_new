# Outstanding Work and Risk Register

Prepared October 14, 2026. Open findings are based on the reviewed repository and recorded deployment work, not a fresh VPS inspection. Nothing in this register authorizes silent business-rule changes or represents an unresolved item as fixed.

**Accountable owner:** Marc Justin Arzadon.

**Acceptance reviewers:** Michelle Norial and Mar Justin Arzadon, subject to identity/spelling confirmation.

**Technical executor:** None assigned. Technical items require a qualified assigned maintainer.

| ID | Priority | Open item / consequence | Required completion evidence | Proposed accountable party | Status / due date |
| --- | --- | --- | --- | --- | --- |
| T01 | Critical for handover | No IT maintainer; nobody confirmed for deployment, recovery, or technical incidents. | Named qualified maintainer/provider, accepted duties, tested access, and agreed support arrangements. | Business owner | Open; before final technical acceptance |
| T02 | High | Petty cash liquidation receipts under `/app/private_uploads/petty_cash` lack a persistent Docker mount; backend recreation can lose them. | Current files preserved; storage fix reviewed; existing files migrated; authorized receipt downloads succeed after container recreation in an isolated test. | Business owner → assigned IT | Open; protect files before backend recreation |
| T03 | High | Complete backup and recovery readiness not verified. | DB + all evidence + configuration backup inventory, protected second copy, checksum evidence, and successful isolated recovery report. | Business owner → assigned IT | Open; before acceptance |
| T04 | High | Legacy PR routes do not consistently implement the new PO/SR/CR dual-role final mechanism. | Written management decision on PR policy; route-by-route review; approved implementation if required; tests for entry, boundary, correction, and final approval. | Approving managers + assigned IT | Open; deadline to assign |
| T05 | High | Production restart/reconciliation of unpaid/unfulfilled requests not established. | Reviewed production inventory; individual linked-document dispositions; preserved actual payments/deliveries; exceptions assigned. | Admin operators + finance owner | Open; deadline to assign |
| T06 | High | Finance owner and final-role coverage unconfirmed. | Named finance owner and verified eligible actual employee accounts, including requester exclusion. | Business / approving managers | Open; before operational acceptance |
| T07 | High | Branch API failure returns fabricated sample project fallback. | Approved outage behavior without fabricated project acceptance; regression checks for request validation and project list failure. | Assigned IT + business owner | Open; deadline to assign |
| T08 | Medium | PO receiver assignment can be hidden by receipt-upload UI permission. | Admin assignment control available independently of upload permission; correct unauthorized access blocked. | Assigned IT | Open; deadline to assign |
| T09 | Medium | Every legacy view has not been verified against the always-live requirement. | Page/event/polling/cache inventory and checks after other-user changes, reconnect, and browser focus. | Assigned IT | Open; deadline to assign |
| T10 | Medium | Legacy authorization and finance transition checks differ across modules. | Role/transition matrix review and approved fixes/tests where required. Backup endpoint itself uses a strict Super Admin check. | Assigned IT + approving managers | Open; deadline to assign |
| T11 | Medium | Web SQL backup shares a date-based temporary filename and excludes attachment contents. | Unique private temporary backup handling; cleanup/concurrency checks; documented complete backup procedure. | Assigned IT | Open; deadline to assign |
| T12 | Medium | VPS deployment of backup URL fix `d3a5952` not verified after push. | Correct production bundle, authorized non-empty SQL download, and recorded recovery/readability check. | Assigned IT + permitted Super Admin | Open; deadline to assign |
| T13 | Medium | Password synchronization and mobile release parity not verified. | Integration owner, tested private configuration, supported release/screens, and independent acceptance results. | Integration owner + assigned IT | Open; deadline to assign |
| T14 | Medium | Local defaults disagree on API port; branch URL override is not wired through root Compose. | Explicit matched local port settings; tested override configuration if a replacement URL is required. | Assigned IT | Documented in setup guide; configuration work open |
| T15 | Low | Older docs contain obsolete flow/role/deployment assumptions. | Updated approved documents or clear historical labels. | Assigned documentation owner | New manuals prepared; older files remain |
| T16 | High for departure | Access transfers, employee training, and formal acceptance unfinished. | Completed access receipts, training evidence, signed acceptance, and approved revocation record. | Business owner + all receivers | Open; before departure |

## Known baseline and limits

- `7454d02`: New PO/SR/ordinary CR workflows and Redis support were pushed.
- `4aa2303`: Upgrade prerequisite repair was pushed. Previous VPS errors included missing cash/payment-related columns.
- `d3a5952`: Backup frontend URL fix was pushed; its actual production deployment is not confirmed here.
- The October 14 exact branch-route repair was verified with 14 real branches, unchanged attendance homepage, and healthy API/Redis/database. This is point-in-time evidence, not ongoing monitoring.
- Local PO #1 was a missing-source/preparer/lines repair exception; local PO #2 was restarted. These facts are not production migration results.
- Review tests previously passed; they do not certify complete production capacity, all role paths, security, or recovery.

## Recording a decision or completion

```text
Issue ID:
Assigned executor and accountable owner:
Decision and approved scope:
Target date:
Records/payments/evidence affected:
Temporary protection while unresolved:
Change / deployment version:
Validation result and restricted evidence location:
Business verification by:
Closed by / date:
```

If accepting an unresolved issue, record the explicit accepting manager, consequence understood, temporary protection, owner, and deadline. A generic signature is not evidence that all technical issues were resolved.
