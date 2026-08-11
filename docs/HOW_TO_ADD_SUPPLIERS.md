# How to Add Suppliers

## Overview

Suppliers in this procurement system are **NOT hardcoded**. They are stored in the MySQL database and managed through a REST API.

---

## Current Status

### Backend: ✅ Complete
- API endpoints exist at `/api/suppliers`
- Full CRUD operations available (Create, Read, Update, Delete)
- Admin-only for write operations

### Frontend: ❌ Missing
- **No dedicated UI page** for managing suppliers
- Suppliers can only be **selected** when creating Purchase Requests
- No ability to add/edit/delete suppliers through the UI

---

## Database Schema

Suppliers are stored in the `suppliers` table:

| Column | Type | Description |
|--------|------|-------------|
| id | int | Primary key, auto-increment |
| supplier_code | varchar(50) | Unique code (e.g., SUP001) |
| supplier_name | varchar(255) | Supplier name |
| contact_person | varchar(255) | Contact name |
| email | varchar(100) | Email address |
| phone | varchar(20) | Phone number |
| address | text | Full address |
| status | enum('Active','Inactive') | Soft delete status |
| created_at | timestamp | Creation date |
| updated_at | timestamp | Last update |

---

## API Endpoints

### Get All Suppliers
```
GET /api/suppliers?page=1&pageSize=20
```
Requires authentication.

### Get Single Supplier
```
GET /api/suppliers/:id
```
Returns supplier with their associated items.

### Create Supplier (Admin Only)
```
POST /api/suppliers
Content-Type: application/json

{
  "name": "Supplier Name",
  "contact_person": "John Doe",
  "phone": "09123456789",
  "email": "john@supplier.com",
  "address": "123 Main St, City"
}
```

### Update Supplier (Admin Only)
```
PUT /api/suppliers/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "contact_person": "Jane Doe",
  "phone": "09999999999",
  "email": "jane@supplier.com",
  "address": "456 New St, City"
}
```

### Delete Supplier (Admin Only - Soft Delete)
```
DELETE /api/suppliers/:id
```
Sets status to 'Inactive' instead of hard delete.

### Add Item to Supplier (Admin Only)
```
POST /api/suppliers/:id/items
Content-Type: application/json

{
  "item_id": 1,
  "price": 100.00,
  "lead_time_days": 7
}
```

---

## How to Add Suppliers Currently

### Option 1: Direct API Call (using cURL)
```bash
curl -X POST http://localhost:5000/api/suppliers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "New Supplier Co",
    "contact_person": "Jane Smith",
    "phone": "09123456789",
    "email": "jane@newsupplier.com",
    "address": "789 Business Ave, Manila"
  }'
```

### Option 2: Re-run Database Setup
The `backend/scripts/setupDatabase.js` script creates 3 sample suppliers:
- Tech Supplies Inc (SUP001)
- Office Depot PH (SUP002)
- Safety First Co (SUP003)

Run with: `node backend/scripts/setupDatabase.js`

### Option 3: Database Direct Insert
```sql
INSERT INTO suppliers (supplier_code, supplier_name, contact_person, phone, email, address)
VALUES ('SUP004', 'New Supplier', 'John Doe', '09123456789', 'john@supplier.com', 'Address here');
```

---

## Recommended: Add Supplier Management UI

To add a proper UI for managing suppliers:

1. **Create a new component**: `frontend/src/components/suppliers/Suppliers.jsx`
2. **Add a route**: Add to `frontend/src/routes/AppRoutes.jsx`
3. **Add to navigation**: Update `frontend/src/components/layout/Layout.jsx`

### Basic UI Features Needed:
- List all suppliers with pagination
- Search/filter suppliers
- Add new supplier form
- Edit existing supplier
- Delete (soft delete) supplier
- View supplier details with associated items/prices

### Example Component Structure:
```jsx
// frontend/src/components/suppliers/Suppliers.jsx
import React, { useState, useEffect } from 'react';
import { supplierService } from '../../services/suppliers';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  // ... form state and handlers

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    const data = await supplierService.getAll();
    setSuppliers(data);
  };

  // ... render table with suppliers, add/edit forms
}
```

---

## Summary

| Aspect | Status |
|--------|--------|
| Database storage | ✅ Yes |
| API endpoints | ✅ Complete |
| Frontend UI | ❌ Missing |
| Seed data | ✅ Available |

**To add a new supplier**, use the API directly or insert directly into the database until a UI is implemented.
