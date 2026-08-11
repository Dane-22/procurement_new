# Notifications System Documentation

## Overview

The notifications system provides real-time and persistent notifications for all procurement workflow events. Notifications are stored in the database and delivered both via REST API polling and Socket.IO real-time events.

**Base URL:** `https://procurement-api.xandree.com/`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NOTIFICATION ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────┘

    Event Triggered
          │
          ▼
    ┌─────────────────────────────────────┐
    │  Backend Logic                      │
    │  (Purchase Request, PO, etc.)       │
    └─────────────────────────────────────┘
          │
          ├──────────────────┬──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
    ┌──────────┐    ┌──────────────┐    ┌──────────────┐
    │ Database │    │  Socket.IO   │    │  Mobile/FE   │
    │  Store   │    │ Real-time    │    │   Poll API   │
    └──────────┘    └──────────────┘    └──────────────┘
          │                  │                  │
          │                  ▼                  │
          │          ┌──────────────┐           │
          │          │  User Room   │           │
          │          │ user_{id}    │           │
          │          └──────────────┘           │
          │                  │                  │
          │                  ▼                  ▼
          │          ┌─────────────────────────────┐
          │          │      Client Receives        │
          │          │    - Socket event (instant) │
          └──────────┤    - API response (poll)  │
                     └─────────────────────────────┘
```

---

## Database Schema

### `notifications` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK, Auto) | Unique notification ID |
| `recipient_id` | INT (FK) | User who receives the notification |
| `title` | VARCHAR(255) | Notification title |
| `message` | TEXT | Full notification message |
| `type` | ENUM | **'PR Created', 'PR Approved', 'PR Rejected', 'PR On Hold', 'PR Modified', 'PO Created', 'Item Received', 'System'** |
| `related_id` | INT | ID of related record (PR ID, PO ID, etc.) |
| `related_type` | VARCHAR(50) | Type: 'purchase_request', 'purchase_order', etc. |
| `is_read` | BOOLEAN | **false** = unread, **true** = read |
| `created_at` | TIMESTAMP | When notification was created |

**Foreign Key:**
- `recipient_id` → `employees.id`

---

## Notification Types Reference

| Type | Description | Triggered By |
|------|-------------|--------------|
| **'PR Created'** | New purchase request submitted | Engineer submits PR or draft |
| **'PR Approved'** | PR approved at any stage | Procurement or Super Admin approval |
| **'PR Rejected'** | PR rejected | Procurement or Super Admin rejection |
| **'PR On Hold'** | PR placed on hold | Super Admin hold action |
| **'PR Modified'** | Procurement changed item values | Procurement approval with modifications |
| **'PO Created'** | New purchase order created | Admin creates PO |
| **'Item Received'** | Item marked as received | Receiving workflow |
| **'System'** | General system notifications | Various system events |

---

## Notification Scenarios (When They Fire)

### 1. Purchase Request (PR) Workflow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       PR NOTIFICATION FLOW                                  │
└────────────────────────────────────────────────────────────────────────────┘

ENGINEER creates PR (not draft)
         │
         ▼
┌────────────────────────────────────────────────┐
│ Recipients: All Procurement Officers          │
│ Title: "New PR Created"                        │
│ Type: "PR Created"                             │
│ Message: "PR {pr_number} ready for review"    │
└────────────────────────────────────────────────┘
         │
         ▼
PROCUREMENT approves (forwards to Super Admin)
         │
         ├──► If changes made to items:
         │    ┌────────────────────────────────────────────────┐
         │    │ Recipients: Engineer (requester)              │
         │    │ Title: "PR Values Modified by Procurement"      │
         │    │ Type: "PR Modified"                             │
         │    │ Message: "Modified: {item}: {changes}"         │
         │    └────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│ Recipients: All Super Admins                   │
│ Title: "PR Pending Final Approval"             │
│ Type: "PR Approved"                              │
│ Message: "PR {pr_number} requires approval"   │
└────────────────────────────────────────────────┘
         │
         ▼
SUPER ADMIN final approves
         │
         ▼
┌────────────────────────────────────────────────┐
│ Recipients: Engineer (requester)              │
│ Title: "PR Fully Approved"                     │
│ Type: "PR Approved"                              │
│ Message: "PR {pr_number} ready for purchase"  │
├────────────────────────────────────────────────┤
│ Recipients: All Admins                         │
│ Title: "PR Ready for PO Creation"              │
│ Type: "PR Approved"                              │
│ Message: "PR {pr_number} ready for PO"        │
└────────────────────────────────────────────────┘
         │
         ▼
ADMIN creates PO
         │
         ▼
┌────────────────────────────────────────────────┐
│ Recipients: All Super Admins                     │
│ Title: "New PO Pending Approval"                 │
│ Type: "PO Created"                               │
│ Message: "PO {po_number} needs approval"        │
└────────────────────────────────────────────────┘
         │
         ▼
SUPER ADMIN approves PO
         │
         ▼
┌────────────────────────────────────────────────┐
│ Recipients: Engineer (requester)              │
│ Title: "PO Approved - Order Placed"             │
│ Type: "PO Created"                               │
│ Message: "PO approved. Related PR: {pr_number}"│
└────────────────────────────────────────────────┘
```

### 2. Rejection Scenarios

```
PROCUREMENT rejects PR
         │
         ▼
┌────────────────────────────────────────────────┐
│ Recipients: Engineer (requester)              │
│ Title: "PR Rejected by Procurement"            │
│ Type: "PR Rejected"                             │
│ Message: "PR rejected: {reason}"               │
└────────────────────────────────────────────────┘

SUPER ADMIN rejects (hold)
         │
         ▼
┌────────────────────────────────────────────────┐
│ Recipients: Engineer (requester)              │
│ Title: "PR On Hold"                            │
│ Type: "PR On Hold"                              │
│ Message: "PR on hold: {reason}"                │
└────────────────────────────────────────────────┘

SUPER ADMIN rejects (final)
         │
         ▼
┌────────────────────────────────────────────────┐
│ Recipients: Engineer (requester)              │
│ Title: "PR Rejected"                           │
│ Type: "PR Rejected"                             │
│ Message: "PR rejected: {reason}"               │
└────────────────────────────────────────────────┘
```

### 3. Resubmission Scenarios

```
ENGINEER resubmits rejected PR
         │
         ▼
┌────────────────────────────────────────────────┐
│ Recipients: All Procurement Officers          │
│ Title: "PR Resubmitted"                       │
│ Type: "PR Created"                             │
│ Message: "PR {pr_number} resubmitted"        │
└────────────────────────────────────────────────┘

ADMIN resubmits rejected PO
         │
         ▼
┌────────────────────────────────────────────────┐
│ Recipients: All Super Admins                   │
│ Title: "PO Resubmitted - Pending Approval"     │
│ Type: "PO Created"                               │
│ Message: "PO {po_number} resubmitted"          │
└────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Get User's Notifications

**Endpoint:** `GET /api/notifications`

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "notifications": [
    {
      "id": 123,
      "recipient_id": 5,
      "title": "PR Pending Final Approval",
      "message": "Purchase Request MTN-2026-02-002 has been reviewed by Procurement and requires your final approval",
      "type": "PR Approved",
      "related_id": 45,
      "related_type": "purchase_request",
      "is_read": false,
      "created_at": "2026-02-19T08:15:30.000Z"
    },
    {
      "id": 122,
      "recipient_id": 5,
      "title": "New PR Created",
      "message": "Purchase Request MTN-2026-02-001 has been created and is ready for your review",
      "type": "PR Created",
      "related_id": 44,
      "related_type": "purchase_request",
      "is_read": true,
      "created_at": "2026-02-19T07:30:00.000Z"
    }
  ],
  "unreadCount": 1
}
```

**Notes:**
- Returns up to 50 most recent notifications (sorted by `created_at DESC`)
- `unreadCount` shows total unread notifications for badge display
- Use `related_id` and `related_type` to navigate to relevant screens

---

### 2. Mark Single Notification as Read

**Endpoint:** `PUT /api/notifications/:id/read`

**Authentication:** Required (Bearer token)

**Request Body:** None

**Response:**
```json
{
  "message": "Notification marked as read"
}
```

**Notes:**
- Only marks notification as read if `recipient_id` matches current user
- Safe to call multiple times (idempotent)

---

### 3. Mark All Notifications as Read

**Endpoint:** `PUT /api/notifications/read-all`

**Authentication:** Required (Bearer token)

**Request Body:** None

**Response:**
```json
{
  "message": "All notifications marked as read"
}
```

**Notes:**
- Marks ALL unread notifications for current user as read
- Useful for "Mark all as read" button in mobile app

---

## Socket.IO Real-time Events

### Connection Setup

```javascript
import { io } from 'socket.io-client';

const socket = io('https://procurement-api.xandree.com', {
  transports: ['websocket'],
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

// Join user-specific room for targeted notifications
socket.emit('join', userId);

// Optional: Join role room for role-based broadcasts
socket.emit('join_role', 'procurement');
```

### Event: `notification`

**Description:** Real-time notification delivery

**Payload:**
```json
{
  "id": 123,
  "title": "PR Pending Final Approval",
  "message": "Purchase Request MTN-2026-02-002 has been reviewed...",
  "type": "PR Approved",
  "related_id": 45,
  "related_type": "purchase_request",
  "is_read": false,
  "created_at": "2026-02-19T08:15:30.000Z"
}
```

**Mobile Handler:**
```javascript
socket.on('notification', (notification) => {
  // Show push notification
  showPushNotification(notification.title, notification.message);
  
  // Update badge count
  incrementBadgeCount();
  
  // Add to notification list (if screen is open)
  addToNotificationList(notification);
});
```

---

### Event: `pr_status_changed`

**Description:** PR status update notification

**Payload:**
```json
{
  "id": 45,
  "pr_number": "MTN-2026-02-002",
  "status": "For Super Admin Final Approval",
  "type": "status_update",
  "updated_by": "procurement"
}
```

**Use Cases:**
- Update PR list in real-time without polling
- Show toast/snackbar when PR you're viewing changes status
- Refresh procurement dashboard when new PRs arrive

---

### Event: `pr_updated`

**Description:** New PR submitted (emitted to procurement role room)

**Payload:**
```json
{
  "id": 46,
  "pr_number": "MTN-2026-02-003",
  "status": "For Procurement Review",
  "type": "new_pr"
}
```

**Notes:**
- Only emitted to users in `role_procurement` room
- Triggered when engineer submits draft or creates new PR

---

## Mobile App Integration Guide

### 1. Polling Strategy (REST API)

```javascript
// Fetch notifications on screen focus
const fetchNotifications = async () => {
  const response = await fetch(`${BASE_URL}/api/notifications`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { notifications, unreadCount } = await response.json();
  
  // Update UI
  setNotifications(notifications);
  setBadgeCount(unreadCount);
};

// Mark as read when user opens notification
const markAsRead = async (notificationId) => {
  await fetch(`${BASE_URL}/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  // Update local state
  updateNotificationStatus(notificationId, true);
};

// Mark all as read
const markAllAsRead = async () => {
  await fetch(`${BASE_URL}/api/notifications/read-all`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  // Clear badge
  setBadgeCount(0);
  setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
};
```

### 2. Real-time Strategy (Socket.IO)

```javascript
import { io } from 'socket.io-client';

class NotificationService {
  constructor() {
    this.socket = null;
    this.listeners = [];
  }

  connect(token, userId, role) {
    this.socket = io(BASE_URL, {
      transports: ['websocket'],
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      
      // Join user room for personal notifications
      this.socket.emit('join', userId);
      
      // Join role room for role-based events
      if (role === 'procurement') {
        this.socket.emit('join_role', 'procurement');
      }
    });

    // Handle real-time notifications
    this.socket.on('notification', (notification) => {
      // Show local push notification
      this.showLocalNotification(notification);
      
      // Increment badge
      this.incrementBadge();
      
      // Notify UI components
      this.notifyListeners('new_notification', notification);
    });

    // Handle PR status changes
    this.socket.on('pr_status_changed', (data) => {
      this.notifyListeners('pr_status_changed', data);
    });

    // Handle new PR events (procurement only)
    this.socket.on('pr_updated', (data) => {
      this.notifyListeners('new_pr', data);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  }

  showLocalNotification(notification) {
    // Use React Native Push Notification or similar
    PushNotification.localNotification({
      title: notification.title,
      message: notification.message,
      data: {
        related_id: notification.related_id,
        related_type: notification.related_type,
        type: notification.type
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

export const notificationService = new NotificationService();
```

### 3. Notification Navigation Logic

```javascript
// Handle notification tap/click
const handleNotificationPress = (notification) => {
  // Mark as read
  markAsRead(notification.id);
  
  // Navigate based on related_type
  switch (notification.related_type) {
    case 'purchase_request':
      navigation.navigate('PurchaseRequestDetail', {
        prId: notification.related_id
      });
      break;
      
    case 'purchase_order':
      navigation.navigate('PurchaseOrderDetail', {
        poId: notification.related_id
      });
      break;
      
    default:
      // Generic notification, no navigation
      break;
  }
};
```

### 4. Badge Count Management

```javascript
// For React Native (iOS/Android badge)
import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';

const updateBadgeCount = (count) => {
  // iOS app badge
  if (Platform.OS === 'ios') {
    PushNotification.setApplicationIconBadgeNumber(count);
  }
  
  // Android (using Badges library or custom)
  // Implementation varies by Android launcher
};

// Initial fetch to set badge
useEffect(() => {
  fetchNotifications();
}, []);
```

---

## Notification UI Components

### Notification List Item

```
┌──────────────────────────────────────────────┐
│                                              │
│  🔵  PR Pending Final Approval          2m   │
│      Purchase Request MTN-2026-02-002       │
│      has been reviewed by Procurement...    │
│                                              │
│      [View PR]              [Dismiss]       │
│                                              │
└──────────────────────────────────────────────┘

Unread Indicator: Blue dot (is_read = false)
Read State: No dot, gray text (is_read = true)
```

### Notification Types Styling

| Type | Icon | Color |
|------|------|-------|
| PR Created | 📝 | Blue |
| PR Approved | ✅ | Green |
| PR Rejected | ❌ | Red |
| PR On Hold | ⏸️ | Yellow/Orange |
| PR Modified | ✏️ | Purple |
| PO Created | 📋 | Blue |
| Item Received | 📦 | Green |
| System | ℹ️ | Gray |

---

## Backend Notification Creation (For Reference)

### Helper Functions

```javascript
// backend/utils/notifications.js

// Create notification for specific user
await createNotification(
  recipientId,     // User ID who receives it
  title,           // Short title
  message,         // Full message
  type,            // Enum type
  relatedId,       // PR/PO ID
  relatedType      // 'purchase_request', 'purchase_order'
);

// Get users by role
const procurementOfficers = await getProcurementOfficers();
const superAdmins = await getSuperAdmins();
const admins = await getAdmins();
```

### Socket Emission

```javascript
// Emit to specific user
emitToUser(userId, 'notification', notificationData);

// Emit to role room
emitToRole('procurement', 'pr_updated', prData);

// Emit to all
emitToAll('pr_status_changed', statusData);
```

---

## Important Notes for Mobile Integration

### 1. Token Handling
- Store JWT securely (Keychain for iOS, Keystore for Android)
- Refresh token before Socket.IO connection if needed
- Reconnect socket when app returns from background

### 2. Background Notifications
- Socket.IO only works when app is active
- Implement push notification service (FCM for Android, APNs for iOS)
- Backend should send push when user is offline

### 3. Offline Support
- Cache notifications locally (AsyncStorage, SQLite)
- Sync read status when coming back online
- Handle conflicts (user read on mobile, web still shows unread)

### 4. Pagination
- Current API returns max 50 notifications
- Implement infinite scroll if expecting more history
- Consider adding `?offset=` parameter to backend

### 5. Notification Grouping
- Group by `related_id` to avoid spam
- Show "+3 more updates" for multiple status changes
- Collapse duplicate notification types

---

## Error Handling

```javascript
// Common error responses

// 401 Unauthorized
{
  "message": "Not authenticated"
}

// 500 Server Error
{
  "message": "Failed to fetch notifications"
}

// Socket connection errors
socket.on('connect_error', (error) => {
  console.log('Connection error:', error.message);
  // Fall back to polling
  startPolling();
});
```

---

## File References

- **API Routes:** `backend/routes/notifications.js:1-63`
- **Notification Logic:** `backend/utils/notifications.js`
- **Socket Helper:** `backend/utils/socket.js`
- **Database Schema:** `dbschema/notifications.sql`
- **PR Notifications:** `backend/routes/purchaseRequests.js` (search for `createNotification`)
- **PO Notifications:** `backend/routes/purchaseOrders.js` (search for `createNotification`)
