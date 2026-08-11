# Production Deployment Checklist

## Pre-Deployment Checklist

### 1. Server Preparation
- [ ] Server has Docker and Docker Compose installed
- [ ] Server has Nginx installed and configured
- [ ] SSL certificates are obtained for procurement.xandree.com and procurement-api.xandree.com
- [ ] Firewall allows HTTP (80) and HTTPS (443) traffic
- [ ] Server has sufficient disk space for Docker volumes
- [ ] Server has sufficient RAM (minimum 2GB recommended)

### 2. Environment Configuration
- [ ] Create `/opt/procurement/.env.prod` from `deploy/.env.prod.example`
- [ ] Set strong `MYSQL_ROOT_PASSWORD` (minimum 32 characters, mix of letters, numbers, symbols)
- [ ] Set strong `MYSQL_PASSWORD` for app user (minimum 32 characters)
- [ ] Set strong `JWT_SECRET` (minimum 64 characters, random string)
- [ ] Set `VITE_API_URL` to `https://procurement-api.xandree.com/api`
- [ ] Set `CORS_ALLOWED_ORIGINS` to `https://procurement.xandree.com`
- [ ] Configure attendance integration variables if needed (ATTENDANCE_SYNC_API_KEY, ATTENDANCE_API_URL, ATTENDANCE_API_KEY)
- [ ] Verify `.env.prod` file permissions are restricted (chmod 600)

### 3. Code Repository
- [ ] Clone repository to `/var/www/Procurement`
- [ ] Verify git remote is correctly configured
- [ ] Pull latest code from main branch
- [ ] Verify docker-compose.yml exists at root
- [ ] Verify backend/database/procurement_db (3).sql exists

### 4. Database Preparation
- [ ] Review database schema in `backend/database/procurement_db (3).sql`
- [ ] Remove or update mock employee accounts with placeholder passwords
- [ ] Ensure production employees have strong passwords
- [ ] Review and update sample data if needed
- [ ] Backup existing database if migrating from another system

### 5. Nginx Configuration
- [ ] Copy `deploy/nginx-procurement.conf` to `/etc/nginx/sites-available/procurement`
- [ ] Copy `deploy/nginx-procurement-api.conf` to `/etc/nginx/sites-available/procurement-api`
- [ ] Create symlinks to sites-enabled:
  ```bash
  ln -sf /etc/nginx/sites-available/procurement /etc/nginx/sites-enabled/procurement
  ln -sf /etc/nginx/sites-available/procurement-api /etc/nginx/sites-enabled/procurement-api
  ```
- [ ] Test Nginx configuration: `nginx -t`
- [ ] Remove default Nginx site if conflicting: `rm /etc/nginx/sites-enabled/default`

### 6. SSL Certificate Setup
- [ ] Obtain SSL certificates using certbot:
  ```bash
  certbot --nginx -d procurement.xandree.com
  certbot --nginx -d procurement-api.xandree.com
  ```
- [ ] Verify certificate paths in Nginx configs match certbot output
- [ ] Test SSL certificate renewal: `certbot renew --dry-run`

## Deployment Steps

### 1. Initial Deployment (Fresh Server)
```bash
cd /var/www/Procurement
docker compose --env-file /opt/procurement/.env.prod up -d --build
```

### 2. Verify Container Status
```bash
docker compose --env-file /opt/procurement/.env.prod ps
```
Expected output: All services should show "Up" status
- procurement_db
- procurement_backend
- procurement_frontend

### 3. Check Container Logs
```bash
docker logs procurement_backend --tail 50
docker logs procurement_frontend --tail 50
docker logs procurement_db --tail 50
```

### 4. Health Checks
```bash
# Check backend health locally
curl -i http://127.0.0.1:5001/api/health

# Check backend health via Nginx
curl -i https://procurement-api.xandree.com/api/health

# Check frontend
curl -i https://procurement.xandree.com
```

### 5. Database Verification
```bash
# Connect to database container
docker exec -it procurement_db mysql -u procurement_app -p procurement_db

# Verify tables exist
SHOW TABLES;

# Exit database
exit
```

### 6. Reload Nginx
```bash
sudo systemctl reload nginx
```

## Post-Deployment Verification

### 1. Application Testing
- [ ] Access frontend at https://procurement.xandree.com
- [ ] Login with a known employee account
- [ ] Verify dashboard loads correctly
- [ ] Test navigation to different modules (Items, Suppliers, Purchase Requests, etc.)
- [ ] Test creating a new item
- [ ] Test creating a purchase request
- [ ] Verify file uploads work (if applicable)
- [ ] Check that Socket.IO connections work (real-time notifications)

### 2. API Testing
- [ ] Test API health endpoint: https://procurement-api.xandree.com/api/health
- [ ] Test authentication endpoint
- [ ] Test items endpoint
- [ ] Verify CORS headers are correct
- [ ] Check rate limiting is working

### 3. Security Verification
- [ ] Verify HTTPS is enforced (no HTTP access)
- [ ] Check SSL certificate validity
- [ ] Verify database is not exposed publicly (only internal Docker network)
- [ ] Verify uploads directory has proper permissions
- [ ] Check that adminer is not enabled in production (or restricted to local access)
- [ ] Verify CORS only allows procurement.xandree.com
- [ ] Check that JWT_SECRET is not exposed in logs

### 4. Performance Verification
- [ ] Check container resource usage: `docker stats`
- [ ] Verify frontend loads quickly
- [ ] Test API response times
- [ ] Check database query performance if slow

### 5. Backup Verification
- [ ] Verify Docker volumes are being backed up
- [ ] Test database backup procedure
- [ ] Document backup and restore process

## Ongoing Maintenance

### 1. Regular Updates
- [ ] Keep Docker images updated
- [ ] Keep Node.js dependencies updated
- [ ] Review and apply security patches
- [ ] Monitor for vulnerabilities: `docker scan`

### 2. Monitoring
- [ ] Set up container monitoring (docker stats, logs)
- [ ] Monitor disk space usage
- [ ] Monitor database size
- [ ] Set up alerts for container failures
- [ ] Monitor SSL certificate expiration

### 3. Backup Schedule
- [ ] Regular database backups (daily recommended)
- [ ] Backup Docker volumes
- [ ] Backup Nginx configurations
- [ ] Backup .env.prod file (secure location)
- [ ] Test restore procedure periodically

### 4. Log Management
- [ ] Set up log rotation for Docker containers
- [ ] Archive old logs
- [ ] Monitor error logs regularly
- [ ] Set up centralized logging if needed

## Rollback Procedure

If deployment fails:

1. **Identify the issue**
   ```bash
   docker logs procurement_backend --tail 100
   docker logs procurement_frontend --tail 100
   docker logs procurement_db --tail 100
   ```

2. **Rollback to previous commit**
   ```bash
   cd /var/www/Procurement
   git log --oneline -10
   git reset --hard <previous-commit-hash>
   ```

3. **Rebuild containers**
   ```bash
   docker compose --env-file /opt/procurement/.env.prod up -d --build
   ```

4. **Verify rollback**
   ```bash
   docker compose --env-file /opt/procurement/.env.prod ps
   curl -i https://procurement-api.xandree.com/api/health
   ```

## Troubleshooting Common Issues

### Issue: Containers won't start
- Check docker-compose.yml syntax
- Verify .env.prod file exists and is readable
- Check port conflicts: `netstat -tlnp`
- Review container logs for specific errors

### Issue: Database connection failed
- Verify database container is running
- Check database credentials in .env.prod
- Verify database volume exists
- Check database initialization logs

### Issue: Frontend not loading
- Check frontend container is running
- Verify Nginx configuration
- Check SSL certificates
- Review frontend container logs

### Issue: API returns 502 Bad Gateway
- Verify backend container is running
- Check Nginx proxy_pass configuration (should be 127.0.0.1:5001)
- Review backend container logs
- Check backend health endpoint

### Issue: CORS errors in browser
- Verify CORS_ALLOWED_ORIGINS in .env.prod
- Check backend CORS configuration
- Rebuild backend container after CORS changes

### Issue: SSL certificate expired
- Renew certificates: `sudo certbot renew`
- Reload Nginx: `sudo systemctl reload nginx`
- Set up auto-renewal with cron

## Security Best Practices

1. **Never commit .env.prod to git** - Keep it outside the repository
2. **Use strong, unique passwords** for all credentials
3. **Regularly update dependencies** for security patches
4. **Enable firewalls** to restrict access
5. **Use SSH key authentication** instead of passwords
6. **Regularly audit user access** and remove inactive accounts
7. **Monitor logs** for suspicious activity
8. **Keep backups** in a secure, off-site location
9. **Use HTTPS only** - Redirect HTTP to HTTPS
10. **Limit admin access** - Use principle of least privilege

## Contact Information

- **Domain**: procurement.xandree.com, procurement-api.xandree.com
- **Project Location**: /var/www/Procurement
- **Environment File**: /opt/procurement/.env.prod
- **Docker Compose**: Use `--env-file /opt/procurement/.env.prod` flag

## Last Updated

- **Date**: June 3, 2026
- **Version**: 1.0
- **Changes**: Fixed database schema path, corrected Nginx proxy ports, updated documentation
