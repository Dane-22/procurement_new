# Server Administrator's Deployment Manual

Use this procedure to update **procurement.xandree.com** and **procurement-api.xandree.com** whenever new features or fixes are pushed to the repository.

Production runs on a VPS with **Docker Compose**, **Nginx** (reverse proxy + SSL), and **MariaDB**.

---

## 1. The "Daily" Code Update (Full Stack)

When your colleague says "Code is updated on GitHub," run this sequence on the server:

```bash
# 1. Enter the project directory
cd /var/www/procurement_system

# 2. Pull the latest changes from GitHub
git fetch origin main
git reset --hard origin/main

# 3. Rebuild and restart containers (uses /opt/procurement/.env.prod)
docker compose --env-file /opt/procurement/.env.prod up -d --build

# 4. Verify containers are running
docker compose --env-file /opt/procurement/.env.prod ps

# 5. Health checks (adjust host port if your compose mapping differs)
curl -i http://127.0.0.1:5001/api/health
curl -i https://procurement-api.xandree.com/api/health
```

Then hard-refresh the browser on `https://procurement.xandree.com` (Ctrl+F5).

---

## 2. Frontend-Only Update (UI / React changes)

Use this when **only** frontend files changed (for example search-bar fixes in `Items.jsx` or `ServiceRequestsManagement.jsx`). Faster than rebuilding everything.

```bash
cd /var/www/procurement_system
git fetch origin main
git reset --hard origin/main
docker compose --env-file /opt/procurement/.env.prod up -d --build frontend
docker compose --env-file /opt/procurement/.env.prod ps
```

**Files commonly deployed with this path:**

| File | Purpose |
|------|---------|
| `frontend/src/components/items/Items.jsx` | Items catalog UI |
| `frontend/src/components/service-requests/ServiceRequestsManagement.jsx` | Service requests UI |
| Other files under `frontend/src/` | React pages and components |

---

## 3. Backend-Only Update (API changes)

Use when **only** backend files changed (routes, middleware, `server.js`, etc.):

```bash
cd /var/www/procurement_system
git fetch origin main
git reset --hard origin/main
docker compose --env-file /opt/procurement/.env.prod up -d --build backend
docker compose --env-file /opt/procurement/.env.prod ps
curl -i http://127.0.0.1:5001/api/health
```

---

## 4. The Database Update

If the update includes new tables or columns, apply SQL **before** or **after** the code deploy (match your team's instructions).

**Option A: Run a provided `.sql` patch file**

```bash
# Copy patch to server, then import (replace path and password as needed)
mysql -u root -p procurement_db < /path/to/your/patch.sql

# Verify tables
mysql -u root -p -e "USE procurement_db; SHOW TABLES;"
```

**Option B: Fresh DB init (destructive — only for new environments)**

On first Docker start, MariaDB loads:

- `backend/database/00_init_db.sql`
- `dbschema/procurement_db.sql`

Do **not** recreate the `db` volume on a live server unless you intend to wipe data.

**Option C: Local setup script (development / one-off seeding)**

```bash
cd /var/www/procurement_system/backend
npm install
npm run setup-db
```

Use `setup-db` only when you understand what it does; prefer controlled SQL patches in production.

---

## 5. Environment Persistence (`.env.prod`)

Production secrets live **outside** Git at:

```bash
/opt/procurement/.env.prod
```

This file is **not** overwritten by `git pull` or `git reset`. Create it once from the example:

```bash
mkdir -p /opt/procurement
cp /var/www/procurement_system/deploy/.env.prod.example /opt/procurement/.env.prod
nano /opt/procurement/.env.prod
```

**Required variables (see `deploy/.env.prod.example`):**

| Variable | Purpose |
|----------|---------|
| `MYSQL_ROOT_PASSWORD` | MariaDB root password |
| `MYSQL_PASSWORD` | App DB user password |
| `JWT_SECRET` | API token signing |
| `VITE_API_URL` | Frontend build-time API base (`https://procurement-api.xandree.com/api`) |
| `CORS_ALLOWED_ORIGINS` | Allowed browser origin (`https://procurement.xandree.com`) |

After changing `.env.prod`, rebuild affected services:

```bash
cd /var/www/procurement_system
docker compose --env-file /opt/procurement/.env.prod up -d --build
```

If only `VITE_API_URL` changed, rebuild **frontend** only.

---

## 6. Quick-Reference Table

| Task | Command | Why? |
|------|---------|------|
| Check container status | `docker compose --env-file /opt/procurement/.env.prod ps` | See if frontend/backend/db are up |
| Backend logs | `docker logs procurement_backend --tail 50` | API errors |
| Frontend logs | `docker logs procurement_frontend --tail 50` | Nginx/static container issues |
| DB logs | `docker logs procurement_db --tail 50` | MariaDB startup / connection errors |
| Nginx errors | `sudo tail -f /var/log/nginx/error.log` | 502 / proxy issues |
| Test Nginx config | `sudo nginx -t` | Validate before reload |
| Reload Nginx | `sudo systemctl reload nginx` | Apply config changes |
| API health (local) | `curl -i http://127.0.0.1:5001/api/health` | Backend reachable on host |
| API health (public) | `curl -i https://procurement-api.xandree.com/api/health` | End-to-end check |
| Inspect env file | `ls -la /opt/procurement/.env.prod` | Confirm secrets file exists |

---

## 7. Summary "One-Liner" (Full deploy)

```bash
cd /var/www/procurement_system && \
git fetch origin main && \
git reset --hard origin/main && \
docker compose --env-file /opt/procurement/.env.prod up -d --build && \
docker compose --env-file /opt/procurement/.env.prod ps && \
curl -i https://procurement-api.xandree.com/api/health
```

**Frontend-only one-liner:**

```bash
cd /var/www/procurement_system && \
git fetch origin main && \
git reset --hard origin/main && \
docker compose --env-file /opt/procurement/.env.prod up -d --build frontend && \
docker compose --env-file /opt/procurement/.env.prod ps
```

---

## 8. Troubleshooting Common Issues

### Issue: 502 Bad Gateway on `procurement.xandree.com`

**Fix:** Check frontend container and Nginx upstream (`127.0.0.1:8081`):

```bash
docker compose --env-file /opt/procurement/.env.prod ps
curl -i http://127.0.0.1:8081/
sudo nginx -t && sudo systemctl reload nginx
```

### Issue: 502 / API errors on `procurement-api.xandree.com`

**Fix:** Check backend container and health endpoint:

```bash
docker logs procurement_backend --tail 50
curl -i http://127.0.0.1:5001/api/health
```

Confirm Nginx `proxy_pass` port matches Docker host mapping in `docker-compose.yml`.

### Issue: Frontend calls wrong API URL

**Fix:** `VITE_API_URL` is baked in at **build time**. Update `/opt/procurement/.env.prod`, then rebuild frontend:

```bash
grep VITE_API_URL /opt/procurement/.env.prod
docker compose --env-file /opt/procurement/.env.prod up -d --build frontend
```

### Issue: CORS errors in browser console

**Fix:** Ensure `CORS_ALLOWED_ORIGINS` includes `https://procurement.xandree.com`, then rebuild backend:

```bash
grep CORS_ALLOWED_ORIGINS /opt/procurement/.env.prod
docker compose --env-file /opt/procurement/.env.prod up -d --build backend
```

### Issue: Database connection failed

**Fix:** Verify DB container and credentials in `.env.prod`:

```bash
docker logs procurement_db --tail 50
docker exec -it procurement_db mysql -u procurement_app -p procurement_db
```

### Issue: SSL certificate expired

**Fix:**

```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Issue: Old UI still visible after deploy

**Fix:** Hard refresh (Ctrl+F5) or clear cache. Confirm frontend image was rebuilt:

```bash
docker compose --env-file /opt/procurement/.env.prod up -d --build frontend
```

---

## 9. Project Structure on Server

```
/var/www/procurement_system/
├── backend/              # Node.js Express API
├── frontend/             # React + Vite (built inside Docker)
├── dbschema/             # SQL schema for first-time DB init
├── deploy/
│   ├── DEPLOYMENT-MANUAL.md
│   ├── DOCKER_VPS.md
│   ├── .env.prod.example
│   ├── nginx-procurement.conf
│   └── nginx-procurement-api.conf
├── docker-compose.yml
└── (git tracked files)

/opt/procurement/
└── .env.prod             # Production secrets (NOT in Git)

/etc/nginx/sites-available/
├── procurement           # → https://procurement.xandree.com → :8081
└── procurement-api       # → https://procurement-api.xandree.com → :5001
```

---

## 10. Service Ports (Docker → Host)

| Service | Container | Host bind | Public URL |
|---------|-----------|-----------|------------|
| Frontend (Nginx static) | `procurement_frontend` | `127.0.0.1:8081` | `https://procurement.xandree.com` |
| Backend API | `procurement_backend` | `127.0.0.1:5001` | `https://procurement-api.xandree.com/api` |
| MariaDB | `procurement_db` | internal only | — |
| Adminer (optional profile) | `procurement_adminer` | `127.0.0.1:8082` | local/admin use only |

---

## 11. Emergency Rollback

If a deployment breaks, revert Git and rebuild:

```bash
cd /var/www/procurement_system
git log --oneline -10
git reset --hard <commit-hash>
docker compose --env-file /opt/procurement/.env.prod up -d --build
docker compose --env-file /opt/procurement/.env.prod ps
curl -i https://procurement-api.xandree.com/api/health
```

---

## 12. Post-Deployment Verification Checklist

After every deployment, verify:

- [ ] `docker compose --env-file /opt/procurement/.env.prod ps` — all services **Up**
- [ ] `https://procurement.xandree.com` loads without SSL warnings
- [ ] Login works with a known employee account
- [ ] `https://procurement-api.xandree.com/api/health` returns success
- [ ] Items page search keeps focus while typing (if UI deploy)
- [ ] Service Requests search keeps focus while typing (if UI deploy)
- [ ] No errors in `docker logs procurement_backend --tail 30`

---

## 13. Local Git: Files to Stage Before Push

When committing from a developer machine, stage only the changed files, for example:

```bash
git add frontend/src/components/items/Items.jsx
git add frontend/src/components/service-requests/ServiceRequestsManagement.jsx
git commit -m "Fix search input losing focus on items and service requests pages"
git push origin main
```

Paths are relative to the repository root (often `/var/www/procurement_system` on the server).

---

**Last Updated:** May 22, 2026  
**Domains:** procurement.xandree.com, procurement-api.xandree.com  
**Deploy method:** Docker Compose + Nginx + MariaDB  
**Env file:** `/opt/procurement/.env.prod`
