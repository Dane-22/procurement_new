# Access Transfer Register

Keep the completed register in restricted company storage. Record account owner names and successful access checks, not passwords, private keys, tokens, database dumps, or recovery codes.

**Business owner:** Marc Justin Arzadon.

**Technical receiver:** Unassigned.

**Transfer coordinator:** To be confirmed.

**Departure date:** To be confirmed.

## Transfer checklist

| Resource | Required recipient / responsibility | Verification to record | Status / date |
| --- | --- | --- | --- |
| Procurement application | Each Admin operator and assigned reviewer | Individual active login, correct menus/role, approved training action. | Pending |
| GitHub repository | Company-controlled owner/team and incoming maintainer | Can read repository; authorized maintainer can perform the agreed Git operation. | Pending |
| Hosting provider | Company-owned administrator | Billing, server recovery, account recovery, and renewal ownership verified. | Pending |
| VPS SSH | Assigned qualified maintainer | Individual authorized key/account; verified host identity and successful login. | Pending |
| Domain/DNS | Company-owned custodian | Control of Procurement/API/integration records confirmed. | Pending |
| Nginx / HTTPS configuration | Technical maintainer | Knows current routing, backups, and certificate-renewal responsibility. | Pending |
| Production environment settings | Technical maintainer via secure vault | Required fields accessible privately; existing DB/Redis/API settings understood. | Pending |
| Database administration | Technical maintainer | Can perform approved read/check/backup operation without exposing DB publicly. | Pending |
| Backup destination | Business-approved custodian and maintainer | Can access protected copies and locate a tested recovery report. | Pending |
| Branch PHP / attendance integration | Integration owner and maintainer | Real branch JSON verified; original PHP app and exact Nginx dependency understood. | Pending |
| Push/mobile services, if in use | Assigned release/integration owner | Provider/release accounts and configured service ownership confirmed. | Pending |
| Company document/evidence folder | Operators and approving managers | Can read manuals and permitted evidence; edit permissions appropriate. | Pending |

Privately transfer database passwords, JWT secrets, Redis credentials, VAPID keys, attendance keys, and recovery access using the company's secure process. Do not paste environment file contents into this register or GitHub. Rotate credentials as a coordinated task: changing one side of Redis or integration credentials can break connections; JWT changes can invalidate active sessions.

## Per-person receipt of access

| Receiver | Application role verified | Resource(s) received | Verification date / evidence | Receiver acknowledgment |
| --- | --- | --- | --- | --- |
| Marc Justin Arzadon | Pending | Pending | | |
| Elain Aguilar | Pending | Pending | | |
| Marjorie Garcia | Pending | Pending | | |
| Lyra Javonillo | Pending | Pending | | |
| Michelle Norial | Pending | Pending | | |
| Mar Justin Arzadon — spelling/identity to confirm | Pending | Pending | | |
| Finance owner — to assign | Pending | Pending | | |
| Technical maintainer — to assign | Pending | Pending | | |

## Departure revocation

Perform after access verification, pending-assignment transfer, and manager acceptance:

- [ ] Inventory the departing employee's application, GitHub, SSH, hosting, DNS, backup, integration, and release access.
- [ ] Transfer sole-owner accounts and account-recovery methods to company control.
- [ ] Replace outstanding approval/operational coverage without deleting historical identity.
- [ ] Deactivate application access; retain employee and audit history.
- [ ] Remove departing GitHub and server access according to approved policy.
- [ ] Revoke temporary keys and tokens after their purpose is complete.
- [ ] Coordinate any necessary shared-credential rotation and verify dependent services afterward.
- [ ] Record who performed revocation, when, and how access removal was verified.

The temporary support SSH key used for the October 14 branch-route repair was removed. New technical work needs newly authorized access; this package does not retain a usable private key.
