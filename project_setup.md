# Procurement Project Setup — Beginner's Guide

**Prepared:** October 14, 2026

**For:** The employee taking over the Procurement system, including someone with no programming experience.

You do not need to know programming to use the website or carry out the basic checks in this guide. Installing the system, restoring its database, changing approval rules, and updating the production server require the company's IT maintainer. This guide explains which tasks belong to each person and how to tell whether a step worked.

The system already runs online. **Start with Part A if you only need to use it.** Use Part B for a separate local copy on a Windows computer. Part C explains the existing server for the incoming maintainer. These are separate setups; completing one does not complete the others.

For instructions on requests, approvals, receiving, releases, and liquidation, read [user manual.md](user%20manual.md).

For named responsibilities, access-transfer forms, training, backup/recovery, and acceptance, open the [complete turnover package](turnover/README.md). Marc Justin Arzadon is the supplied business owner; Admin operators are Elain Aguilar, Marjorie Garcia, and Lyra Javonillo. No IT maintainer is currently assigned, so the business owner must arrange qualified support for the IT tasks in this guide.

## Contents

- [1. What the system contains](#1-what-the-system-contains)
- [2. Information to receive during turnover](#2-information-to-receive-during-turnover)
- [Part A — Use the existing online system](#part-a--use-the-existing-online-system)
- [Part B — Set up or start a Windows local copy](#part-b--set-up-or-start-a-windows-local-copy)
- [Part C — Understand the existing production server](#part-c--understand-the-existing-production-server)
- [Part D — Simple troubleshooting](#part-d--simple-troubleshooting)
- [Part E — Setup acceptance checklist](#part-e--setup-acceptance-checklist)

## 1. What the system contains

Think of the system as an office with a reception desk, staff working behind the desk, and a records cabinet:

| Name | Plain-language explanation |
| --- | --- |
| Frontend | The website you see: forms, buttons, tables, and menus. |
| Backend / API | The service behind the website that checks permissions, saves requests, and processes actions. |
| Database | The records cabinet holding employees, requests, amounts, approvals, and history. |
| Receipt storage | Files containing delivery receipts, cash evidence, and other attachments. The database stores their references, not all file contents. |
| Redis | A helper for reference information and live update distribution. It does not hold the official request records. |
| GitHub repository | The company project's code and its change history. |
| VPS / server | The remote computer that keeps the online system running. |
| Docker | Software that runs separate packaged services on the server. |
| Nginx | Software that directs website addresses to the correct service. Other company projects also use it. |
| Environment file | A private settings file containing addresses, passwords, and connection information. |
| Terminal / PowerShell | A window where you type commands. Commands can check information or change the computer. |

**Online** means the company system that employees use for actual transactions. **Local** means a separate copy running on your computer for development or training. `localhost` always means the computer running the browser or command; it does not mean the VPS.

## 2. Information to receive during turnover

Ask the departing employee and responsible manager to transfer these through company-controlled accounts and secure channels:

| Needed information | Why it matters |
| --- | --- |
| Your own employee login and correct role | Access to the online application. |
| Business owner and approval-policy contact | Someone who can decide how exceptions should be handled. |
| Assigned IT maintainer and escalation contact | Help with setup, server errors, updates, and recovery. |
| GitHub access | Access to the repository and future approved changes. |
| Hosting, server, and DNS ownership | Ability to maintain the VPS, website addresses, and HTTPS. |
| Private environment settings | Correct database, authentication, Redis, and integration configuration. |
| Verified database and attachment backups | Ability to recover records and supporting evidence. |
| Current deployed version and unfinished tasks | Avoid repeating incomplete migration or deploying an unreviewed change. |
| Branch/attendance integration owner | The project list depends on a separate PHP application. |

Do not request passwords in a public group chat or put them in this document. Use your own account; do not continue using the resigning employee's login. Keep their historical identity so old approvals and requests still show the correct person.

## Part A — Use the existing online system

### A1. What you need

- A computer or approved mobile browser with internet access.
- An active employee account created by an authorized manager.
- Your employee number and privately supplied password.

**You do not need WAMP, Node.js, Git, Docker, or a downloaded project just to use the online website.**

### A2. Open and sign in

1. Open your browser.
2. Go to **https://procurement.xandree.com**.
3. Enter your employee number and password.
4. Check that the displayed name and role are yours.
5. Open **Settings** and change an initial or reset password immediately.
6. Read the relevant sections of [the user manual](user%20manual.md).

Different roles see different menus. This is expected. Ask the responsible manager to confirm your role if you cannot find an action you are assigned to perform.

### A3. Check whether the system is available

Open this address in a new browser tab:

**https://procurement-api.xandree.com/api/health**

The page displays text rather than a normal dashboard. A healthy production example is:

```json
{
  "status": "OK",
  "message": "Server is running",
  "database": "Connected",
  "redis": { "configured": true, "connected": true }
}
```

This means the API can reach the database and Redis. It does not prove that every feature, project integration, or payment record is correct. If it fails, note the time and send the error to the IT maintainer.

### A4. Your normal daily start and finish

1. Sign in and check notifications.
2. Open your assigned request/review queue.
3. Check the live connection indicator where shown.
4. Complete only the actions for your role and assignment.
5. Confirm that the record reflects a saved action before clicking again.
6. Log out when finished.

Closing your browser does not stop the online system. Turning off your computer does not turn off the VPS.

## Part B — Set up or start a Windows local copy

### B1. Decide which situation applies

| Situation | Start here |
| --- | --- |
| The existing project and private settings are already on the turnover computer | Ask IT to verify the database/settings, then follow B5 through B8. |
| This is a new Windows computer | IT completes B2 through B4, then you can follow B5 through B8. |
| You only need the online application | Return to Part A. |

The working project location used during this handover is:

```text
C:\wamp64\www\procurement
```

WAMP supplies the local database. This project's website and API run as Node.js services; starting WAMP alone does not start them. You do not open the application by browsing to a PHP-style `/procurement` folder.

### B2. Install tools — IT-assisted first-time task

Have IT install or confirm:

| Tool | Purpose |
| --- | --- |
| Node.js 22 with npm | Runs the API and local website; matches the server build environment. |
| Git for Windows | Downloads and updates the project from GitHub. |
| The company-approved WAMP installation | Runs the local MySQL database. |
| A text editor | Opens configuration and documentation files. |
| A browser | Opens the application and health checks. |

Use company-approved installers and settings. Redis is needed to test its production behavior; IT should provide an authenticated Redis instance if that testing is required. The new workflow code has a Redis-unavailable fallback, but that does not make a Redis-free local setup a full production test.

After installing Node and Git, close and reopen PowerShell so it recognizes the new tools. In PowerShell, type these commands one at a time:

```powershell
node --version
npm --version
git --version
```

**Expected result:** Each command prints a version. Node should report version 22.x for this setup. If a command says it is not recognized, stop and ask IT to check the installation. Do not change Windows security policy merely to work around an error. If only `npm` is blocked as a PowerShell script, IT can check whether `npm.cmd` is available.

### B3. Obtain the project — choose one method

**Existing turnover folder:** Keep the folder and its private local settings intact. Do not run another clone into it or overwrite its `.env` files. IT should inspect any local changes and create a separate copy for training if necessary.

**New computer:** After confirming that the destination folder does not already exist, IT or an authorized employee can run:

```powershell
cd C:\wamp64\www
git clone https://github.com/Dane-22/procurement_new.git procurement
```

**Expected result:** A `procurement` folder containing `frontend`, `backend`, documentation, and other project files.

Downloading code does not download the current company database, uploads, production credentials, or server configuration. Those are separate turnover items.

### B4. Prepare the database and settings — IT task

Do not skip this step on a new computer. A blank database cannot be repaired just by starting the website.

IT must:

1. Start WAMP's MySQL service and confirm its actual port/account.
2. Create a separate local database, for example `procurement_training`.
3. Restore a verified compatible baseline schema and approved training data into that database. Use anonymized data if a production backup contains personal or financial information.
4. Supply the backend connection settings for that local database.
5. Apply the explicit additive workflow schema preparation after the baseline tables exist.
6. Create active training employees and confirm enough eligible reviewers exist for the intended scenarios.
7. Confirm how project data will be provided for training. Do not treat built-in sample project fallback as real company data.

**Do not run `npm run setup-db`, import every `.sql` file, or run an old generic migration script against an existing company database.** The old setup script imports schema files and can insert sample employees. The workflow schema tool adds upgrade prerequisites; it does not replace a full initial database restore.

The backend reads a private file at:

```text
C:\wamp64\www\procurement\backend\.env
```

The following is a field guide for IT, not a ready-to-use credential file:

```dotenv
PORT=5001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=procurement_training
DB_USER=<local database user supplied by IT>
DB_PASSWORD=<local database password supplied by IT>
JWT_SECRET=<unique local secret generated by IT>
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Replace every placeholder with the correct local value. Do not copy the production password into a public training document. Database port 3306 is an example; WAMP's actual port may differ.

If IT supplies Redis, add the correct authenticated `REDIS_URL` privately. For a training environment, IT should review reminder/push/integration settings and disable external side effects that are not part of the exercise.

The frontend needs this in `frontend\.env.local`:

```dotenv
VITE_API_URL=http://localhost:5001/api
```

Older examples use port 5000, while the backend code's fallback is 5005. This guide deliberately sets both ends to **5001**. The two addresses must agree.

### B5. Install the project's libraries

Open PowerShell using the Windows Start menu. These commands install the libraries listed in each package's lockfile. They do not start the application.

Backend:

```powershell
cd C:\wamp64\www\procurement\backend
npm ci
```

Frontend:

```powershell
cd C:\wamp64\www\procurement\frontend
npm ci
```

**Expected result:** Each installation finishes and returns to a prompt where you can type again. Download time varies. A warning is not always a failure, but a final error must be resolved before continuing. Send the last error lines to IT; do not blindly run suggested force-update commands.

You usually repeat library installation after a project update changes dependency files, not every morning.

After IT restores the baseline database and confirms `.env` points to the local training database, IT can prepare the workflow tables:

```powershell
cd C:\wamp64\www\procurement\backend
npm run workflow:schema
```

**Expected result:** A success message states that workflow and cash/petty-cash/payment prerequisites were applied, with no requests restarted. If the command reports missing baseline tables, return to B4 instead of running random migration files.

### B6. Start the local backend — PowerShell window 1

1. Start WAMP and confirm that MySQL is running. A green tray icon is useful, but IT should check MySQL specifically if connection fails.
2. Open a PowerShell window.
3. Run:

```powershell
cd C:\wamp64\www\procurement\backend
npm run dev
```

**Expected result:** Messages report that the database connected and the server is running on port 5001.

Leave this window open. A running service may keep showing messages without returning to a normal prompt. That is expected. Closing this window stops this local backend.

### B7. Start the local website — PowerShell window 2

Open a second PowerShell window and run:

```powershell
cd C:\wamp64\www\procurement\frontend
npm run dev -- --port 5173 --strictPort
```

**Expected result:** Vite displays a local website address on port 5173. Open:

**http://localhost:5173**

Leave this window open too. `--strictPort` makes the command stop if 5173 is occupied instead of silently switching to an address that does not match the configured allowed origin.

If you change `.env` or `.env.local`, stop and restart the affected local service. A browser refresh alone does not reload its process settings.

### B8. Confirm the local setup works

1. Open **http://localhost:5001/api/health** and check that the database is connected.
2. Open **http://localhost:5173** and log in using an account from the local database.
3. Confirm the correct menus for that account.
4. Check project data and request lists.
5. On the isolated training copy, prepare a draft and exercise approved training scenarios with IT.
6. Confirm that a saved change survives a backend restart and that uploaded evidence can be reopened.

Production employee credentials do not automatically exist in a new training database. Ask the local administrator for the correct account. The requester cannot review their own request, so training approvals need separate eligible employees. A missing Admin, Senior Project Engineer, Super Admin, or CEO can correctly block a scenario.

If local Redis is deliberately absent, the health response may show Redis unconfigured/disconnected. Database-backed workflow reads can still work, but record that Redis distribution/recovery has not been tested.

### B9. Stop and restart the local copy

To stop, press **Ctrl+C** in each of the two PowerShell windows. If prompted to terminate the batch job, confirm it. Close the browser afterward. Stop WAMP only if no other local application needs it.

To start the next day:

1. Start WAMP/MySQL.
2. Start the backend using B6.
3. Start the frontend using B7.
4. Open `http://localhost:5173`.

Do not reinstall tools or libraries just to restart the local application.

## Part C — Understand the existing production server

**This part is for the assigned IT maintainer.** A nontechnical employee can use it to identify the services and report accurate information. Do not paste all commands into the server without reading the conditions beside them.

### C1. Important locations

| Item | Current location |
| --- | --- |
| VPS IP | `72.62.254.60` |
| Application folder | `/var/www/Procurement` — capital P matters on Linux. |
| Private production settings | `/opt/procurement/.env.prod` |
| Main service configuration | `/var/www/Procurement/docker-compose.yml` |
| GitHub | `https://github.com/Dane-22/procurement_new` |
| Website | `https://procurement.xandree.com` |
| Backend health on VPS | `http://127.0.0.1:5001/api/health` |
| Public API | `https://procurement-api.xandree.com/api` |

The current stack runs frontend, backend, MariaDB, and Redis services. Adminer is an optional database-administration tool. The VPS also hosts other projects; changes to global Nginx, PHP, database services, or server firewall settings can affect them.

### C2. Connecting to the server

The current server session uses SSH. Obtain your own authorized SSH access from IT. Do not request the departing employee's private key or reuse a temporary support key.

From Windows PowerShell, an authorized maintainer uses the account supplied by IT:

```powershell
ssh your_assigned_user@72.62.254.60
```

Replace `your_assigned_user` before running it. The previous maintenance session used `root`; routine access should follow the company's assigned-account policy. On first connection, have IT verify the server fingerprint before accepting it. When typing an SSH password, the screen may show no characters; that is normal.

After login, the prompt changes to the Linux server. From that point, commands run on the VPS, not on Windows. Type `exit` to leave the session.

### C3. Read-only checks

These commands inspect service status and health:

```bash
cd /var/www/Procurement
docker compose --env-file /opt/procurement/.env.prod ps
curl -fsS http://127.0.0.1:5001/api/health
docker logs --since 10m --timestamps procurement_backend
```

Expected: required containers are running; database and Redis health are connected. This does not prove every workflow is complete.

To watch only new backend activity:

```bash
docker logs --since 1m --timestamps -f procurement_backend
```

Press Ctrl+C to stop watching. It does not stop the backend. Old log entries can describe problems that have already been fixed; use the timestamps.

### C4. Updating the application — maintainer task

Before updating, IT must record the current version, inspect local modifications, back up the database and all evidence files, and review the release's schema requirements. The petty cash storage gap in C6 must be handled before any backend recreation.

For an approved **frontend-only** update:

```bash
cd /var/www/Procurement
git status --short
git pull --ff-only origin main
docker compose --env-file /opt/procurement/.env.prod up -d --build --no-deps frontend
```

Check each command's result before running the next. If Git shows unexpected local changes, a pull fails, or a build fails, stop and resolve the issue. Do not use `git reset --hard` as a routine workaround.

After a successful frontend update, hard-refresh the browser with **Ctrl+Shift+R**. Frontend API addresses are saved inside the built website; changing the environment file alone is not enough.

Backend releases may require explicit schema preparation before replacing the running backend. Follow [the technical handover section of the user manual](user%20manual.md#16-technical-handover-and-deployment). Do not run every old migration script. The checked `requestWorkflowMigration.js --schema` command prepares additive prerequisites but does not restart historical requests.

### C5. Redis settings

The production Compose file requires both:

- `REDIS_PASSWORD`: the Redis service password.
- `REDIS_URL`: the backend's authenticated connection URL using the same password.

They belong in the private production environment file. If Compose reports that either is missing, ask IT to reconcile the existing service credentials. Do not generate another password every time you deploy; that could make the backend and Redis disagree.

Redis is internal-only in the current stack. It supports reference caching and socket distribution. Request approvals, amounts, receipt records, and history remain in the database. Workflow responses are read from current server data rather than a Redis response cache.

### C6. Backups and receipt storage — important before updates

A complete backup needs **both records and files**:

| What to preserve | Where it is held |
| --- | --- |
| Business records | MariaDB database. |
| Public uploaded files | Docker volume mounted at `/app/uploads`. |
| New PO/SR/ordinary CR receipts | Docker volume mounted at `/app/private`. |
| Petty cash liquidation receipts | Currently `/app/private_uploads/petty_cash` in the backend container. |
| Deployment/integration configuration | Private environment file, Nginx settings, and company-owned credentials. |

**Known issue:** Petty cash liquidation receipt storage has no persistent mount in root Compose. Recreating the backend can lose those files. IT must copy any existing files out before backend replacement and implement/test the persistence fix. Do not assume the SQL backup includes their contents.

The SQL backup action is under **Settings** for the permitted Super Admin UI role. The production URL fix was pushed in `d3a5952`; verify that it has been deployed and that an authorized download succeeds. Store backups privately and test recovery in a separate environment.

Do not run `docker compose down -v`, delete Docker volumes, or import an old SQL dump into the live database to solve an ordinary error. These actions can remove company data. There is no web restore button; recovery requires the maintainer's approved plan.

### C7. Project list and attendance dependency

The project list comes from:

**https://jajr.xandree.com/get_branches_api.php**

This must return JSON containing real branches, not an attendance homepage. It currently reaches the original PHP application on port 8888 through one exact Nginx route. The rest of `jajr.xandree.com` remains the separate attendance frontend on port 7001.

The exact route, PHP dependency, and verified backup path are recorded in [the user manual](user%20manual.md#165-branch-api-dependency--preserve-this-route). Keep that route when maintaining attendance. Do not replace the attendance site's entire Nginx configuration to fix Procurement.

If the dropdown shows **HQ Office**, **Warehouse A**, or **Site B (Archived)** with sample addresses, report it. The current helper's fallback contains sample projects; do not use them for real requests.

### C8. Existing records and approval staffing

Schema preparation and review migration are different tasks. The agreed policy restarts unpaid/unfulfilled eligible PO/SR/ordinary CR requests, including approved ones, with each linked document reviewed individually. Admin performs the migration review; actual payments, releases, deliveries, and earlier history must be preserved.

Before deactivating the resigning employee, assign replacement ownership and review outstanding assignments. Do not delete the employee record or invent historical reviewers. Ask management to resolve approval-policy differences in legacy PR routes; see the outstanding-items section of the user manual.

## Part D — Simple troubleshooting

| Problem | Meaning / first action |
| --- | --- |
| `node` / `npm` / `git` not recognized | Tool is missing or PowerShell was opened before installation. Reopen PowerShell; ask IT if it persists. |
| `npm ci` says it cannot find `package.json` | You are in the wrong folder. Use the exact `backend` or `frontend` path. |
| `npm ci` fails while downloading | Check internet/proxy access with IT; keep the actual error. |
| Database connection failed | MySQL may be stopped, or database name/port/user/password is incorrect. Return to B4/B6. |
| Server running on an unexpected port | Backend settings are missing or not loaded. IT checks `.env`; this guide expects 5001 locally. |
| Port already in use | Another program is using that port. Ask IT to identify it; do not randomly terminate processes. |
| Local website cannot reach the API | Confirm both PowerShell windows are running and frontend API URL matches backend port. |
| Browser reports CORS | The configured allowed browser address and actual local URL may differ. IT checks CORS settings. |
| Local login fails | Your local account may not exist or may be inactive; production accounts are separate. |
| `localhost` request fails on production | Browser is trying to reach the employee's PC. IT verifies the production build API setting and the affected code. |
| Redis variable missing during deployment | IT checks both private Redis settings; do not overwrite credentials blindly. |
| HTTP 500 / unknown database column | IT reads recent backend logs and checks the approved schema preparation. |
| Wrong/sample projects | Branch integration failed. Do not submit using sample data. |
| No approval action | Check role, active stage, assignment, and whether you are the requester. |
| Website works but receiving/release is blocked | Required approval, linked payment readiness, quantities, or evidence may still be missing. |
| Uploaded petty cash receipts disappear after update | Escalate immediately; check C6 backups and the missing persistent mount. |

Send support the action, page, document number, time, role, and last error lines. Hide passwords, session tokens, private keys, and financial details that are not needed for diagnosis.

## Part E — Setup acceptance checklist

### For an employee using the online application

- [ ] I have my own active login with the correct role.
- [ ] I can open the application and sign in.
- [ ] I changed my initial/reset password.
- [ ] I know which menus and review tasks belong to me.
- [ ] I know who handles business decisions and technical issues.
- [ ] I have read the relevant workflow sections of `user manual.md`.

### For a Windows training/development installation

- [ ] IT confirmed Node 22, Git, and the local MySQL service.
- [ ] Project files and package libraries are installed.
- [ ] The local database is separate from production and has a verified baseline.
- [ ] Private backend settings and frontend API address agree.
- [ ] Explicit workflow schema preparation succeeded.
- [ ] Training employee roles and required reviewers exist.
- [ ] Backend and frontend start in separate PowerShell windows.
- [ ] Local health check connects to the local database.
- [ ] Training login, real/approved project data, saves, and receipt reopening were checked.
- [ ] Redis configuration/test limitations and external integration behavior are documented.

### For the incoming production maintainer

- [ ] GitHub, hosting, DNS, integration, and SSH access are company-controlled.
- [ ] The currently deployed version and outstanding changes are recorded.
- [ ] DB and all evidence storage have verified backups and a tested recovery plan.
- [ ] Petty cash receipt persistence risk is resolved or assigned with protective backups.
- [ ] Health, real branch JSON, login, and authorized backup download are verified.
- [ ] Historical migration status and legacy approval-policy differences have owners.
- [ ] Other applications' Nginx/PHP routes are preserved.
- [ ] Departure access is removed after ownership and pending assignments are transferred.

This guide does not require you to learn programming before taking over daily operations. It gives you the addresses, checks, and vocabulary to work with the assigned maintainer and recognize when a setup step has succeeded.
