# Docker VPS Setup (Clean Start)

This guide assumes a fresh production server state (no procurement containers, volumes, or DB).

## 1) Prepare env file on VPS

```bash
mkdir -p /opt/procurement
cp /var/www/Procurement/deploy/.env.prod.example /opt/procurement/.env.prod
nano /opt/procurement/.env.prod
```

## 2) Start Docker stack

```bash
cd /var/www/Procurement
docker compose --env-file /opt/procurement/.env.prod up -d --build
```

Notes:
- DB initializes from `backend/database/procurement_db (3).sql` on first startup only.
- Because this is a fresh setup, the sample data from that file will be imported.

## 3) Install host Nginx configs

```bash
cp /var/www/Procurement/deploy/nginx-procurement.conf /etc/nginx/sites-available/procurement
cp /var/www/Procurement/deploy/nginx-procurement-api.conf /etc/nginx/sites-available/procurement-api
ln -sf /etc/nginx/sites-available/procurement /etc/nginx/sites-enabled/procurement
ln -sf /etc/nginx/sites-available/procurement-api /etc/nginx/sites-enabled/procurement-api
nginx -t && systemctl reload nginx
```

## 4) Re-issue SSL certs

```bash
certbot --nginx -d procurement.xandree.com
certbot --nginx -d procurement-api.xandree.com
```

## 5) Verify

```bash
docker compose --env-file /opt/procurement/.env.prod ps
curl -i http://127.0.0.1:5001/api/health
curl -i https://procurement-api.xandree.com/api/health
```

Open in browser:
- `https://procurement.xandree.com`
- `https://procurement-api.xandree.com/api/health`
