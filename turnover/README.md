# Procurement Turnover Package

Prepared October 14, 2026. This folder is the handover starting point for the employees receiving the project. It records the owners supplied by the departing employee, work that remains, and evidence required for acceptance.

**Business owner:** Marc Justin Arzadon.

**Admin operators:** Elain Aguilar, Marjorie Garcia, and Lyra Javonillo.

**Approving managers:** Michelle Norial and Mar Justin Arzadon.

**IT maintainer:** None assigned.

**Finance officer:** Not confirmed.

**Departure date:** Not provided.

The owner was supplied as **Marc** Justin Arzadon and an approving manager as **Mar** Justin Arzadon. Confirm the spelling and whether these are the same person before signing. Names in this package do not create employee accounts or assign technical/system roles.

## Read these in order

| Document | Reader / purpose |
| --- | --- |
| [Ownership and responsibilities](OWNERSHIP.md) | Managers and operators: establish responsibility, coverage, and missing owners. |
| [User manual](../user%20manual.md) | All users: daily operating instructions and current workflow limitations. |
| [Beginner setup guide](../project_setup.md) | Incoming employees: online access, local setup, and escalation. |
| [Access transfer register](ACCESS_TRANSFER.md) | Business owner: transfer access privately and record proof. |
| [Outstanding work register](OUTSTANDING_WORK.md) | Approving managers: assign priorities, owners, and dates. |
| [Backup, recovery, and support runbook](BACKUP_AND_SUPPORT.md) | Assigned technical support: preserve evidence, check health, and test recovery. |
| [Training plan and completion record](TRAINING.md) | Trainers and operators: demonstrate and assess the handover. |
| [Acceptance and departure checklist](ACCEPTANCE.md) | Managers: accept delivery and document unresolved conditions. |

## Immediate actions

1. Marc Justin Arzadon confirms named owners and assigns a qualified internal or external IT maintainer. No technical maintainer has been appointed by preparing these documents.
2. Appoint a finance owner and confirm approval-role coverage in the actual application.
3. Preserve database and all receipt storage, particularly petty cash container files, before any backend replacement.
4. Complete access transfer using company accounts. No passwords or private keys belong in GitHub or these forms.
5. Run training on a separate prepared training database; record evidence and results.
6. Assign every unresolved item an owner and deadline. Finish formal acceptance before departure access is revoked.

Until technical support is assigned, Admin staff should use the existing website and report incidents to the business owner. Backend recreation, database restoration, schema changes, and Nginx changes need qualified support. Creating this package does not fix the identified application or storage issues.

## Package status

| Item | Status |
| --- | --- |
| Manuals, registers, training plan, and acceptance forms | Prepared; review and execution pending. |
| Employee access and company account transfer | Not verified. |
| Named IT and finance owners | Outstanding. |
| Complete backup and successful recovery exercise | Not verified. |
| Production migration reconciliation | Not verified. |
| Training and signed acceptance | Not completed. |

Do not mark a step complete without the named receiver and evidence. Maintain an execution copy in a restricted company folder. Repository versions are templates; private evidence, account details, and signatures belong in the restricted execution copy.

## Evidence folder structure

Create this in approved company storage, outside the Git repository:

```text
Procurement Turnover Evidence/
  01 Ownership and Acceptance/
  02 Access Transfer Receipts/       # confirmation only; no passwords
  03 Backup and Recovery Results/   # reports; backups stored separately and securely
  04 Training Results/
  05 Outstanding Work Decisions/
  06 Deployment and Incident Records/
```

Use dates and document/request identifiers in filenames. Exclude session tokens and unnecessary personal/financial information from screenshots. Protect actual backups and environment files separately with restricted access.

## Incident report template

```text
Date/time and timezone:
Reporter and role:
Page / URL:
Document type and number:
Action attempted:
Expected result:
Actual result / error:
Any amount released, paid, or received already:
Last known successful operation:
Evidence location (restricted company folder):
Business owner notified:
Technical support assigned:
```

Report real financial/evidence discrepancies immediately. Do not delete or recreate the affected request before its records have been reviewed.
