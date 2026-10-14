# Backup, Recovery, and Support Runbook

**Audience:** A qualified, authorized technical maintainer. No IT maintainer is currently assigned. Marc Justin Arzadon must assign one or arrange qualified external support. Admin operators should report errors and preserve the affected records rather than execute database/server changes.

This runbook is prepared, not executed. Commands refer to the existing Ubuntu VPS, not Windows. Do not copy SQL/configuration backups into GitHub or the source folder.

## 1. Safe incident triage

1. Record time, page, document number, action, and actual payment/delivery facts using the package incident template.
2. Check browser/network and ask whether other users are affected.
3. Open `https://procurement-api.xandree.com/api/health`.
4. Qualified support inspects recent backend logs and container status.
5. Preserve evidence before changing anything. Escalate financial discrepancies to the assigned finance owner and approving managers.

Read-only server checks:

```bash
cd /var/www/Procurement
docker compose --env-file /opt/procurement/.env.prod ps
curl -fsS --max-time 15 http://127.0.0.1:5001/api/health
docker logs --since 10m --timestamps procurement_backend
git status --short
git rev-parse HEAD
```

Do not run full `docker inspect`, full Compose configuration output, or `cat` of environment files into shared incident reports; these can expose secrets. Use narrowly selected diagnostics. A health response is not proof that receipts, branch data, or all workflows are correct.

## 2. Full backup procedure

Before running: confirm authorization, free disk space, the intended project/database/container, a company-approved backup destination, and a coordinated period without business-record or upload changes. `--single-transaction` helps with InnoDB rows; it does not independently make all file copies or nontransactional tables consistent. Qualified support must verify the actual table engines and required consistency method.

**Do not recreate the backend before copying petty cash receipts.** Their current path has no persistent mount. These commands copy data; they do not repair that mount.

### 2.1 Create a protected destination outside the repository

Run all following steps in the same Bash session, checking each result:

```bash
umask 077
task_backup_dir="/opt/procurement/backups/turnover-$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$task_backup_dir"
df -h /opt/procurement
```

Stop if available disk space is inadequate. Record the destination privately. The commands below rely on the database container's existing environment; they do not require printing passwords.

### 2.2 Copy the SQL database

```bash
docker exec procurement_db sh -c \
  'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysqldump -uroot --single-transaction --quick --routines --events --triggers --hex-blob "$MYSQL_DATABASE"' \
  > "$task_backup_dir/database.sql"
test -s "$task_backup_dir/database.sql"
```

Stop if the dump command fails, or the file is empty. A non-empty file alone is not a verified recoverable backup; test it in section 3. Do not post its contents in a ticket.

### 2.3 Copy all evidence locations

```bash
docker cp procurement_backend:/app/uploads "$task_backup_dir/uploads"
docker cp procurement_backend:/app/private "$task_backup_dir/private"
docker cp procurement_backend:/app/private_uploads/petty_cash "$task_backup_dir/petty_cash"
```

Each copy must succeed or its absence must be investigated and documented. A directory may not yet exist if no evidence has been created; qualified support must reconcile database metadata and existing receipts before treating an absent directory as expected. Never silently mark a failed copy complete.

### 2.4 Preserve deployment facts and private settings

```bash
cd /var/www/Procurement
git rev-parse HEAD > "$task_backup_dir/release-commit.txt"
git status --short > "$task_backup_dir/repository-status.txt"
cp docker-compose.yml "$task_backup_dir/docker-compose.yml"
cp /opt/procurement/.env.prod "$task_backup_dir/production.env"
chmod 600 "$task_backup_dir/production.env"
```

The copied environment file contains secrets. Protect it with the backup access controls and approved encrypted storage/transfer. Save any intentional uncommitted deployment configuration separately after inspection; the commit identifier does not capture uncommitted changes.

For the specific relevant host configuration files, after confirming they exist:

```bash
install -d -m 700 "$task_backup_dir/nginx"
cp -L /etc/nginx/sites-enabled/procurement "$task_backup_dir/nginx/procurement"
cp -L /etc/nginx/sites-enabled/procurement-api "$task_backup_dir/nginx/procurement-api"
cp -L /etc/nginx/sites-enabled/jajr "$task_backup_dir/nginx/jajr"
cp -L /etc/nginx/sites-enabled/jajr-project "$task_backup_dir/nginx/jajr-project"
```

These copies include the attendance/PHP dependency's relevant routing configuration. They are not permission to replace other projects' routes. Record TLS renewal and hosting recovery ownership separately; do not put private certificate keys in the public repository.

### 2.5 Verify and retain

```bash
cd "$task_backup_dir"
find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 -r sha256sum > SHA256SUMS
sha256sum -c SHA256SUMS
```

Record every preceding step's success, the maintenance window, SQL/file consistency method, size and evidence counts, and any exceptions. Checksums detect changed copies; they do not prove completeness or restore correctness. Transfer a protected second copy off this VPS to company-approved storage and verify its checksums there. Hosting failure can destroy backups left only on the same server.

Backup schedule, retention, encryption, offsite destination, and responsible person must be approved and filled in:

| Setting | Decision |
| --- | --- |
| Responsible maintainer / backup custodian | Unassigned |
| Schedule and allowable data-loss window | To approve |
| Retention period / capacity | To approve |
| Protected second-copy destination | To approve |
| Recovery time expectation | To approve |
| Recovery exercise frequency | To approve |

## 3. Isolated recovery exercise

This is a plan for qualified support. It deliberately omits a one-command production restore.

1. Prepare a separate database, file storage, environment, and application instance with no connection to the live company database.
2. Disable unneeded push/password-sync/reminder side effects and prevent training records reaching company systems.
3. Verify checksums, inspect the SQL dump's database/schema behavior, and restore into the intended isolated target.
4. Restore file contents to the paths expected by the selected application version. Include the protected petty cash files.
5. Use the recorded release and compatible configuration; apply only reviewed additive upgrade requirements if applicable.
6. Check employee/request counts and sampled financial totals against the backup report.
7. Open historical PR/PO/SR/CR and petty cash records, inspect approvals, and download sampled receipts privately.
8. Confirm duplicate/payment/source guards and role access through approved isolated scenarios.
9. Record elapsed time, exceptions, restored-file evidence, and business verification. Keep the test environment isolated or dispose of it under the company's approved process.

Recovery acceptance report:

```text
Backup identifier and second-copy location:
Backup consistency method:
Recorded application release:
Technical executor / date:
Isolated environment verified by:
SQL restoration result:
Record counts / financial sampling result:
Upload/private/petty cash evidence checks:
Role/login/approval checks:
Recovery duration:
Exceptions and corrective actions:
Business verifier / acceptance date:
```

## 4. Changes, rollback, and escalation

Every change needs an approved scope, previous release/configuration backup, data/evidence protection, and validation of affected behavior. Application rollback may not reverse already-recorded business actions; reconcile those facts before recovery decisions.

Do not run volume deletion, hard Git resets, blanket database imports, or direct approval-status edits to clear an error. Do not rotate JWT/Redis/integration credentials without coordinating dependent systems. Never infer a business approval from a successful API call alone.

Escalation path: Admin operator → Marc Justin Arzadon (business owner) → assigned qualified technical support. Financial matters also go to the assigned finance owner and approving managers. Incident response hours and deadlines are not yet agreed; record them when support is appointed.
