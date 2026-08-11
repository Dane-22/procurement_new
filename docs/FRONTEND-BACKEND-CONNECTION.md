# API Connection Guide

## 1. Environment Setup

Create `.env` file in `frontend/` folder:

```
VITE_API_URL=http://localhost:5000/api
```

## 2. Install axios (optional but recommended)

```bash
cd frontend
npm install axios
```

## 3. API Service Structure

Created files:
- `src/services/api.js` - Base API configuration with axios
- `src/services/auth.js` - Authentication API calls
- `src/services/items.js` - Items API calls
- `src/services/purchaseRequests.js` - PR API calls
- `src/services/purchaseOrders.js` - PO API calls
- `src/services/suppliers.js` - Suppliers API calls
- `src/services/categories.js` - Categories API calls
- `src/services/notifications.js` - Notifications API calls
- `src/services/reports.js` - Reports API calls

## 4. Authentication Context

Created `src/contexts/AuthContext.jsx` to manage:
- User login/logout
- JWT token storage (localStorage)
- Current user state
- Role-based access

## 5. Updated Components

Modified `src/App.jsx` to:
- Use real API calls instead of mock data
- Integrate AuthContext
- Handle loading states
- Handle API errors

## 6. Login Flow

1. User enters employee_code + password
2. Frontend calls `POST /api/auth/login`
3. Backend returns JWT token + user data
4. Frontend stores token in localStorage
5. All subsequent API calls include token in Authorization header

## 7. To Start Both Servers

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:5000

## 8. CORS Note

Backend already has CORS enabled (`app.use(cors())` in server.js),
so frontend can communicate with backend without issues.
