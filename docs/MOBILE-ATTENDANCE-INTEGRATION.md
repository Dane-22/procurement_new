# Mobile Attendance App Integration Guide

## Overview
This document outlines how your mobile attendance app will connect to **both** systems:
- **Old PHP API** - Continues handling all attendance functionality
- **New Procurement System (Node.js)** - Handles procurement-related features

Your mobile app will be extended to support procurement features while keeping existing attendance features connected to the old system.

## Integration Architecture

```
                         ┌─────────────────────┐
                         │    Mobile App       │
                         │  (Attendance +      │
                         │   Procurement)      │
                         └─────────────────────┘
                                    │
                  ┌─────────────────┼─────────────────┐
                  │                 │                 │
                  ▼                 │                 ▼
┌─────────────────────┐             │    ┌─────────────────────┐
│   PHP API (Old)     │             │    │  Procurement System │
│   Attendance System │◄────────────│    │    (Node.js)        │
│                     │  Attendance │    │                     │
│  - Check-in/out     │  Endpoints  │    │  - Purchase Requests│
│  - Attendance logs  │             │    │  - Purchase Orders  │
│  - Employee verify  │             │    │  - Items/Suppliers  │
└─────────────────────┘             │    │  - Approvals        │
                                    │    │  - Notifications    │
                                    │    └─────────────────────┘
                                               ▲
                                               │
                                        Procurement
                                        API Endpoints
```

## What Stays on Old System (PHP API)

Your mobile app **continues using** the existing PHP API for:

| Feature | PHP API Endpoint | Status |
|---------|-----------------|--------|
| Employee Check-in | `POST /api/attendance/check-in` | ✅ Keep |
| Employee Check-out | `POST /api/attendance/check-out` | ✅ Keep |
| Attendance History | `GET /api/attendance/{employee_id}` | ✅ Keep |
| Employee Verification | `GET /api/employees/verify/{code}` | ✅ Keep |
| Attendance Summary | `GET /api/attendance/summary` | ✅ Keep |
| Location/Geofencing | Existing endpoints | ✅ Keep |

## New Procurement API Endpoints (Node.js)

Your mobile app will **add new calls** to the Procurement System for:

### Engineer Role Endpoints

#### Get Categories
```
GET /api/categories
Headers: Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "categories": [
    {
      "id": 1,
      "category_name": "IT Equipment",
      "items_count": 15
    },
    {
      "id": 2,
      "category_name": "Office Supplies",
      "items_count": 8
    }
  ]
}
```

#### Browse Items
```
GET /api/items
Headers: Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "item_code": "ITM001",
      "item_name": "Laptop Dell XPS 15",
      "description": "15.6 inch business laptop",
      "category_name": "IT Equipment",
      "unit": "pc"
    }
  ]
}
```

#### Create Purchase Request
```
POST /api/purchase-requests
Headers: Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "purpose": "IT equipment for new engineer",
  "remarks": "Urgent - starting next week",
  "items": [
    {
      "item_id": 1,
      "quantity": 2,
      "remarks": "For development team"
    },
    {
      "item_id": 5,
      "quantity": 1,
      "remarks": "Backup unit"
    }
  ]
}
```

#### View My Purchase Requests
```
GET /api/purchase-requests/my-requests
Headers: Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 15,
      "pr_number": "PR-2026-0015",
      "purpose": "IT equipment for new engineer",
      "status": "For Procurement Review",
      "created_at": "2026-02-10T08:30:00Z",
      "item_count": 2,
      "total_estimated": 150000.00
    }
  ]
}
```

#### View PR Details
```
GET /api/purchase-requests/{id}
Headers: Authorization: Bearer {token}
```

#### Mark Items as Received
```
PUT /api/purchase-requests/{id}/receive
Headers: Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "items": [
    {
      "purchase_request_item_id": 23,
      "received": true
    },
    {
      "purchase_request_item_id": 24,
      "received": true
    }
  ]
}
```

### Notifications Endpoint

#### Get My Notifications
```
GET /api/notifications
Headers: Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "PR Approved",
      "message": "Your PR #PR-2026-0015 has been approved by Super Admin",
      "type": "PR Approved",
      "is_read": false,
      "created_at": "2026-02-10T09:00:00Z"
    }
  ],
  "unread_count": 3
}
```

#### Mark All Notifications as Read
```
PUT /api/notifications/mark-all-read
Headers: Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

#### Mark Notification as Read
```
PUT /api/notifications/{id}/read
Headers: Authorization: Bearer {token}
```

### Authentication for Procurement API

Your mobile app needs to authenticate with the Procurement System using JWT tokens.

#### Login Endpoint
```
POST /api/auth/login
Content-Type: application/json
```

**Request:**
```json
{
  "employee_no": "ENG-2026-0001",
  "password": "jajrconstruction"
}
```

**Response:**
```json
{
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwicm9sZSI6ImVuZ2luZWVyIiwiaWF0IjoxNzcwOTU1ODczLCJleHAiOjE3NzEwNDIyNzN9.TFFiTGMqb7QPOU6F1xqKLxl4GrApz3iWti0yVmJU7co",
    "user": {
        "id": 5,
        "employee_no": "ENG-2026-0001",
        "first_name": "Michelle",
        "middle_initial": "T",
        "last_name": "Norial",
        "role": "engineer",
        "is_active": 1
    }
}
```

**Token Usage:**
```
Authorization: Bearer {jwt_token}
```

### Auto-Login Flow (Attendance ↔ Procurement)

When a user logs in to the **Attendance Mobile App**, the app must also automatically log in to the **Procurement System** to enable procurement features.

**Flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    Mobile App Login                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User enters credentials in Attendance App                   │
│          ↓                                                      │
│  2. Call Attendance API (PHP) to authenticate                   │
│          ↓                                                      │
│  3. If Attendance login SUCCESS →                               │
│          ↓                                                      │
│  4. Call Procurement API /api/auth/login                        │
│     (using same employee_no and password)                     │
│          ↓                                                      │
│  5. Store Procurement JWT token                                 │
│          ↓                                                      │
│  6. User now has access to BOTH:                              │
│     - Attendance features (Check-in/out)                        │
│     - Procurement features (Create PR, View Orders, etc.)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Example:**

```javascript
// services/authService.js
import { API_CONFIG } from '../config/api.config.js';

class AuthService {
  constructor() {
    this.attendanceBaseURL = API_CONFIG.attendance.baseURL;
    this.procurementBaseURL = API_CONFIG.procurement.baseURL;
    this.attendanceApiKey = API_CONFIG.attendance.apiKey;
  }

  async login(employee_no, password) {
    // Step 1: Login to Attendance System
    const attendanceResponse = await fetch(`${this.attendanceBaseURL}/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': this.attendanceApiKey
      },
      body: JSON.stringify({ employee_no, password })
    });
    
    const attendanceData = await attendanceResponse.json();
    
    if (!attendanceData.success) {
      throw new Error('Attendance login failed');
    }
    
    // Step 2: Store Attendance session
    localStorage.setItem('attendance_token', attendanceData.token);
    localStorage.setItem('employee_no', employee_no);
    
    // Step 3: Auto-login to Procurement System
    const procurementResponse = await fetch(`${this.procurementBaseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_no, password })
    });
    
    const procurementData = await procurementResponse.json();
    
    if (procurementData.message === 'Login successful') {
      // Step 4: Store Procurement token
      localStorage.setItem('procurement_token', procurementData.token);
      localStorage.setItem('procurement_user', JSON.stringify(procurementData.user));
    }
    
    return {
      attendance: attendanceData,
      procurement: procurementData,
      success: true
    };
  }

  async logout() {
    // Clear both tokens
    localStorage.removeItem('attendance_token');
    localStorage.removeItem('procurement_token');
    localStorage.removeItem('employee_no');
    localStorage.removeItem('procurement_user');
  }
  
  isLoggedInToProcurement() {
    return !!localStorage.getItem('procurement_token');
  }
}

export const authService = new AuthService();
```

**Important Notes:**
- Both systems use the same `employee_no` and `password` for authentication
- The Procurement token must be stored separately from the Attendance token
- If Procurement login fails, the Attendance login should still succeed (procurement features will be disabled)
- Procurement JWT token expires in 24 hours (re-login required)

## Mobile App Implementation

### Environment Configuration

Create a config file in your mobile app:

```javascript
// config/api.config.js
export const API_CONFIG = {
  // Old Attendance System (PHP)
  attendance: {
    baseURL: 'https://attendance.yourcompany.com/api',
    apiKey: 'your-attendance-api-key',
    timeout: 30000
  },
  
  // New Procurement System (Node.js)
  procurement: {
    baseURL: 'https://procurement-api.xandree.com/api',
    timeout: 30000
  }
};
```

### Service Layer Pattern

Create separate services for each API:

```javascript
// services/attendanceService.js
import { API_CONFIG } from '../config/api.config.js';

class AttendanceService {
  constructor() {
    this.baseURL = API_CONFIG.attendance.baseURL;
    this.apiKey = API_CONFIG.attendance.apiKey;
  }

  async checkIn(employeeCode, locationData) {
    const response = await fetch(`${this.baseURL}/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({
        employee_code: employeeCode,
        location: locationData.name,
        latitude: locationData.lat,
        longitude: locationData.lng,
        timestamp: new Date().toISOString()
      })
    });
    return await response.json();
  }

  async getAttendanceHistory(employeeCode, startDate, endDate) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    const response = await fetch(
      `${this.baseURL}/attendance/${employeeCode}?${params}`,
      { headers: { 'X-API-Key': this.apiKey } }
    );
    return await response.json();
  }
}

export const attendanceService = new AttendanceService();
```

```javascript
// services/procurementService.js
import { API_CONFIG } from '../config/api.config.js';

class ProcurementService {
  constructor() {
    this.baseURL = API_CONFIG.procurement.baseURL;
    this.token = localStorage.getItem('procurement_token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('procurement_token', token);
  }

  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  async login(employee_no, password) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_no, password })
    });
    
    const data = await response.json();
    if (data.success) this.setToken(data.token);
    return data;
  }

  async getCategories() {
    const response = await fetch(`${this.baseURL}/categories`, {
      headers: this.getAuthHeaders()
    });
    return await response.json();
  }

  async getItems() {
    const response = await fetch(`${this.baseURL}/items`, {
      headers: this.getAuthHeaders()
    });
    return await response.json();
  }

  async createPurchaseRequest(purpose, items, remarks = '') {
    const response = await fetch(`${this.baseURL}/purchase-requests`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ purpose, items, remarks })
    });
    return await response.json();
  }

  async getMyPurchaseRequests() {
    const response = await fetch(`${this.baseURL}/purchase-requests/my-requests`, {
      headers: this.getAuthHeaders()
    });
    return await response.json();
  }
}

export const procurementService = new ProcurementService();
```

## API Endpoint Mapping

### Existing Attendance API (PHP) - KEEP USING

| Feature | Method | Endpoint | Auth |
|---------|--------|----------|------|
| Check In | POST | `/api/attendance/check-in` | API Key |
| Check Out | POST | `/api/attendance/check-out` | API Key |
| Daily Report | GET | `/api/attendance/daily/{date}` | API Key |
| Monthly Report | GET | `/api/attendance/monthly/{month}` | API Key |

### New Procurement API (Node.js) - ADD TO APP

| Feature | Method | Endpoint | Auth |
|---------|--------|----------|------|
| Login | POST | `/api/auth/login` | None |
| Categories | GET | `/api/categories` | JWT |
| Browse Items | GET | `/api/items` | JWT |
| Create PR | POST | `/api/purchase-requests` | JWT |
| My PRs | GET | `/api/purchase-requests/my-requests` | JWT |
| PR Details | GET | `/api/purchase-requests/{id}` | JWT |
| Mark Items Received | PUT | `/api/purchase-requests/{id}/receive` | JWT |
| Notifications | GET | `/api/notifications` | JWT |
| Mark Notification Read | PUT | `/api/notifications/{id}/read` | JWT |
| Mark All Read | PUT | `/api/notifications/mark-all-read` | JWT |

## Deployment Checklist

- [ ] Add procurement API config to environment files
- [ ] Create `procurementService.js` service layer
- [ ] Add JWT token storage mechanism
- [ ] Create new UI screens for procurement features
- [ ] Handle network errors for both APIs independently

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS Errors | Add mobile app domain to CORS whitelist in both backends |
| Auth Conflicts | Old API uses `X-API-Key`, New API uses `Authorization: Bearer` - keep separate! |
| Employee Not Found | Ensure `employee_code` matches in both systems |

## Next Steps

1. Provide your mobile app tech stack (React Native, Flutter, etc.)
2. Share existing PHP API base URL and auth method
3. Confirm procurement system base URL
4. Test single endpoint from mobile app
5. Add procurement UI screens to mobile app

---

**Document Version**: 1.1
**Created**: February 2026
**Last Updated**: February 2026
