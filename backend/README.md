# Procurement System Backend

Node.js + Express API for the Procurement System. Designed to work with XAMPP MySQL for local development.

## Prerequisites

- [XAMPP](https://www.apachefriends.org/) installed (includes Apache + MySQL)
- [Node.js](https://nodejs.org/) v18+ installed

## Quick Start (XAMPP)

### 1. Start XAMPP Services

1. Open XAMPP Control Panel
2. Start **Apache** and **MySQL**
3. Verify MySQL is running on port 3306 (default)

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Set Up Database

The setup script will:
- Create `procurement_db` database
- Import all tables from `/dbschema/*.sql`
- Insert sample data (3 employees, categories, items, suppliers)

```bash
npm run setup-db
```

### 4. Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:5000`

### 5. Test the API

Visit `http://localhost:5000/api/health` - should return:
```json
{
  "status": "OK",
  "message": "Server is running",
  "database": "Connected"
}
```

## Default Login Credentials

| Role | Employee No | Password |
|------|-------------|----------|
| Engineer | ENG001 | password123 |
| Procurement | PRO001 | password123 |
| Admin | ADM001 | password123 |
| Super Admin | SAD001 | password123 |

## Project Structure

```
backend/
├── config/
│   └── database.js          # MySQL connection pool
├── middleware/
│   └── auth.js              # JWT auth + role authorization
├── routes/
│   ├── auth.js              # Login/me endpoints
│   ├── items.js             # Item CRUD
│   ├── purchaseRequests.js  # PR endpoints
│   ├── purchaseOrders.js    # PO endpoints
│   ├── suppliers.js         # Supplier CRUD
│   ├── categories.js        # Category CRUD
│   ├── notifications.js     # User notifications
│   └── reports.js           # Dashboard + reports
├── scripts/
│   └── setupDatabase.js     # DB initialization script
├── .env                     # Environment variables
├── package.json
└── server.js                # Main Express app
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Login with employee_no + password
- `GET /api/auth/me` - Get current user profile

### Items
- `GET /api/items` - List all items
- `GET /api/items/:id` - Get item with suppliers
- `POST /api/items` - Create item (admin+)
- `PUT /api/items/:id` - Update item (admin+)
- `DELETE /api/items/:id` - Delete item (admin+)

### Purchase Requests
- `GET /api/purchase-requests` - List PRs (engineers see own, admin+ see all)
- `GET /api/purchase-requests/:id` - Get PR with items
- `POST /api/purchase-requests` - Create PR (any authenticated)
- `PUT /api/purchase-requests/:id/approve` - Approve/reject (super admin only)

### Purchase Orders
- `GET /api/purchase-orders` - List POs
- `GET /api/purchase-orders/:id` - Get PO with items
- `POST /api/purchase-orders` - Create PO (admin+)
- `PUT /api/purchase-orders/:id/status` - Update status (admin+)

### Suppliers, Categories, Notifications, Reports
Similar CRUD patterns with appropriate role restrictions.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 5000 | Server port |
| DB_HOST | localhost | MySQL host |
| DB_PORT | 3306 | MySQL port |
| DB_USER | root | MySQL user |
| DB_PASSWORD | (empty) | MySQL password |
| DB_NAME | procurement_db | Database name |
| JWT_SECRET | your-secret-key | JWT signing key |

## Scripts

- `npm start` - Production mode
- `npm run dev` - Development with auto-reload
- `npm run setup-db` - Initialize database

## Connecting Frontend to Backend

In your frontend `.env`:
```
VITE_API_URL=http://localhost:5000/api
```

Then update frontend API calls to use this base URL.

## Next Steps

1. Install dependencies: `npm install`
2. Run setup: `npm run setup-db`
3. Start server: `npm run dev`
4. Test API endpoints with Postman or similar
5. Connect frontend to real API instead of mock data
