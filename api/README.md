# API Endpoints (Procurement System)

## Base URL (Production)

https://procurement-api.xandree.com

## Authentication

### Login

- Method: POST
- Path: /api/auth/login
- Body:

```json
{
  "employee_no": "EMP-0001",
  "password": "your-password"
}
```

### Get current user

- Method: GET
- Path: /api/auth/me
- Header:

Authorization: Bearer <token>

## Password

### Change password (logged-in user)

- Method: POST
- Path: /api/auth/change-password
- Header:

Authorization: Bearer <token>

- Body:

```json
{
  "current_password": "old-password",
  "new_password": "new-password-here",
  "confirm_password": "new-password-here"
}
```

### Sync password (attendance -> procurement)

- Method: POST
- Path: /api/auth/sync-password
- Header:

x-api-key: <ATTENDANCE_SYNC_API_KEY>

- Body:

```json
{
  "employee_no": "EMP-0001",
  "password": "newPasswordFromAttendance"
}
```

- Notes:
  - This endpoint is intended for server-to-server calls.
  - Password is stored as a bcrypt hash in this system.
