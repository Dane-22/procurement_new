# Procurement System - Local Development Guide

A full-stack procurement management system with React frontend, Node.js/Express backend, and MySQL database.

---

## Table of Contents

1. [Tech Stack Overview](#tech-stack-overview)
2. [Prerequisites](#prerequisites)
3. [Project Structure](#project-structure)
4. [Setup Instructions](#setup-instructions)
5. [Environment Variables](#environment-variables)
6. [Running the Application](#running-the-application)
7. [Default Login Credentials](#default-login-credentials)
8. [Troubleshooting](#troubleshooting)

---

## Tech Stack Overview

| Component | Technology |
|-----------|------------|
| **Frontend** | React 19 + Vite + Tailwind CSS 4 |
| **Backend** | Node.js + Express.js |
| **Database** | MySQL (via XAMPP) |
| **Real-time** | Socket.IO |
| **Authentication** | JWT |

---

## Prerequisites

### Required Software

1. **[Node.js](https://nodejs.org/)** v18+ with npm
2. **[XAMPP](https://www.apachefriends.org/)** (includes Apache + MySQL) - *Required for database*
3. **Git** (for cloning)

### Verify Installations

```bash
node --version    # Should show v18+
npm --version     # Should show 9+
```

---

## Project Structure

```
Procurement/
├── frontend/           # React + Vite application
│   ├── src/           # React components & pages
│   ├── .env           # Frontend environment config
│   └── package.json
├── backend/           # Node.js + Express API
│   ├── routes/        # API endpoints
│   ├── config/        # Database config
│   ├── scripts/       # DB setup scripts
│   ├── middleware/    # Auth & validation
│   └── package.json
├── backend/database/  # SQL schema files
└── docker-compose.yml # Optional Docker setup
```

---

## Setup Instructions

### Step 1: Start XAMPP MySQL Server

1. Open **XAMPP Control Panel**
2. Start **Apache** (optional, for phpMyAdmin)
3. Start **MySQL**
4. Verify MySQL is running on port `3306`

> **Note:** The backend connects to MySQL directly. You don't need Apache unless you want to use phpMyAdmin.

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
```

### Step 3: Configure Backend Environment

Create `backend/.env` file:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration (XAMPP MySQL defaults)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=procurement_db

# JWT Configuration
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=24h

# CORS (for local development)
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Optional: Payment Schedule Reminders
PAYMENT_REMINDER_ENABLED=true
```

### Step 4: Setup Database

Run the database initialization script:

```bash
cd backend
npm run setup-db
```

This will:
- Create `procurement_db` database
- Import all tables from SQL files
- Create sample data (employees, categories, items, suppliers)

### Step 5: Install Frontend Dependencies

```bash
cd frontend
npm install
```

### Step 6: Configure Frontend Environment

Create `frontend/.env` file:

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Environment Variables

### Backend (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5000 | API server port |
| `DB_HOST` | localhost | MySQL host |
| `DB_PORT` | 3306 | MySQL port |
| `DB_USER` | root | MySQL username |
| `DB_PASSWORD` | (empty) | MySQL password |
| `DB_NAME` | procurement_db | Database name |
| `JWT_SECRET` | - | JWT signing key (required) |
| `JWT_EXPIRES_IN` | 24h | Token expiration |
| `CORS_ALLOWED_ORIGINS` | - | Allowed frontend URLs |

### Frontend (.env)

| Variable | Example | Description |
|----------|---------|-------------|
| `VITE_API_URL` | http://localhost:5000/api | Backend API base URL |

---

## Running the Application

### Option 1: Run Backend + Frontend Separately (Recommended for Development)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Server runs on `http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Vite dev server runs on `http://localhost:5173`

### Option 2: Verify Backend is Working

Visit: `http://localhost:5000/api/health`

Expected response:
```json
{
  "status": "OK",
  "message": "Server is running",
  "database": "Connected"
}
```

### Option 3: Using Docker (Alternative)

If you prefer Docker over XAMPP:

```bash
# Create production .env file
cp .env.example .env.prod
# Edit .env.prod with your values

# Start all services
docker-compose up -d
```

Services:
- Frontend: http://localhost:8081
- Backend API: http://localhost:5001
- Adminer (DB UI): http://localhost:8082

---

## Default Login Credentials

Credentials are stored in the `employees` table with bcrypt-hashed passwords.

| Role | Employee No | Password |
|------|-------------|----------|
| Engineer | `ENG-2026-0001` | `jajrconstruction` |
| Procurement | `PRO-2026-0001` | `jajrconstruction` |
| Admin | `ADMIN-2026-0001` | `jajrconstruction` |
| Super Admin | `SA-2026-004` | `jajrconstruction` |

---

## Available Scripts

### Backend

```bash
npm start          # Production mode
npm run dev        # Development with nodemon
npm run setup-db   # Initialize database
```

### Frontend

```bash
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

---

## API Endpoints Overview

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Core Resources
- `GET/POST /api/items` - Items CRUD
- `GET/POST /api/purchase-requests` - Purchase Requests
- `GET/POST /api/purchase-orders` - Purchase Orders
- `GET/POST /api/suppliers` - Suppliers
- `GET/POST /api/categories` - Categories
- `GET/POST /api/service-requests` - Service Requests
- `GET/POST /api/cash-requests` - Cash Requests
- `GET/POST /api/reimbursements` - Reimbursements
- `GET/POST /api/disbursement-vouchers` - Disbursement Vouchers
- `GET/POST /api/payment-requests` - Payment Requests
- `GET/POST /api/payment-orders` - Payment Orders

### Other
- `GET /api/notifications` - User notifications
- `GET /api/reports/dashboard` - Dashboard stats
- `GET /api/employees` - Employee management

---

## Troubleshooting

### Database Connection Issues

**Problem:** `Database connection failed`

**Solutions:**
1. Verify XAMPP MySQL is running
2. Check `DB_PASSWORD` in `.env` - XAMPP default is empty
3. Try connecting via phpMyAdmin to verify credentials

### Port Already in Use

**Problem:** `EADDRINUSE: address already in use :::5000`

**Solutions:**
```bash
# Find and kill process using port 5000
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

Or change the `PORT` in your `.env` file.

### CORS Errors

**Problem:** `Access-Control-Allow-Origin` errors in browser console

**Solution:** Ensure `CORS_ALLOWED_ORIGINS` in backend `.env` includes your frontend URL:
```env
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend Can't Connect to API

**Problem:** `Network Error` or `Failed to fetch`

**Solutions:**
1. Verify backend is running on port 5000
2. Check `VITE_API_URL` is set to `http://localhost:5000/api`
3. Restart frontend dev server after changing `.env`

### Missing Database Schema

**Problem:** Tables don't exist

**Solution:** Run the setup script:
```bash
cd backend
npm run setup-db
```

---

## Development Tips

1. **Hot Reload:** Both frontend (`npm run dev`) and backend (`npm run dev`) support hot reload
2. **API Testing:** Use the built-in health check at `/api/health` to verify backend status
3. **Database Management:** Use phpMyAdmin (comes with XAMPP) at `http://localhost/phpmyadmin`
4. **Socket.IO:** Real-time notifications work automatically when both frontend and backend are running

---

## Next Steps

1. Login with one of the default credentials
2. Explore different user roles (Engineer, Procurement, Admin, Super Admin)
3. Create a Purchase Request as an Engineer
4. Review and approve workflows as Procurement/Admin
5. Check real-time notifications when actions occur
