# Web & Mobile App Synchronization Architecture

This document outlines the synchronization strategies and architecture between the **Procurement Backend**, **Web Application (React)**, and **Mobile Application (React Native / Expo)**. 

The system utilizes a hybrid approach relying on **REST APIs** for primary data fetching/mutations, **Socket.IO** for real-time notifications, and **SQLite** for robust offline synchronization on the mobile client.

---

## 1. High-Level Overview

- **Backend (Node.js/Express)**: Acts as the central source of truth. Connects to a MySQL database and exposes RESTful endpoints and WebSocket channels.
- **Web Frontend (Vite/React)**: Operates primarily online. Communicates with the backend via REST endpoints (Axios) and maintains a persistent Socket.IO connection for real-time updates.
- **Mobile Frontend (Expo/React Native)**: Operates in both online and offline modes. Utilizes Axios for REST communications, interceptors for auth-token management, `NetInfo` to track network state, and `expo-sqlite` for buffering requests while offline.

---

## 2. Real-Time Synchronization (Socket.IO)

Both the web and mobile applications benefit from real-time events emitted by the backend to keep data synchronized instantly without manual refreshing.

### Backend Implementation (`backend/utils/socket.js`)
The server initializes a Socket.IO instance and supports targeted communication:
- **`emitToUser(userId, event, data)`**: Sends events to a specific user (e.g., when their Purchase Request is approved).
- **`emitToRole(role, event, data)`**: Sends events to all users possessing a certain role (e.g., notifying all `approver` roles of a new PR).
- **`emitToAll(event, data)`**: Broadcasts to all connected clients.

### Client Implementation
Clients connect to the WebSocket and join their respective rooms:
- **User Room**: `socket.emit('join', userId)`
- **Role Room**: `socket.emit('join_role', role)`

When a user performs an action (e.g., approving a request in the web app), the backend processes the change and emits a corresponding socket event. The mobile app (or another web session) receives this event and triggers a local state update or a data refetch to reflect the new state immediately.

---

## 3. Mobile Offline Synchronization

The mobile app includes a robust offline-first caching and synchronization mechanism designed for environments with poor or no connectivity.

### How it Works (`mobile/services/offlineSync.js`)

1. **Local Database (SQLite)**: 
   The app initializes a local SQLite database (`procurement.db`) using `expo-sqlite`. It contains a table named `pending_requests` to queue outgoing operations.

2. **Buffering Requests**: 
   When the user attempts a data mutation (e.g., creating a PR or adding an item) while offline, the payload is intercepted and routed to the `addPendingRequest` function. It records:
   - Endpoint URL
   - HTTP Method (`POST`, `PUT`)
   - Stringified JSON Payload

3. **Network State Monitoring**: 
   The app uses `@react-native-community/netinfo` to listen for connectivity changes (`setupNetworkListener`). 

4. **Auto-Synchronization (`syncPendingRequests`)**: 
   As soon as a connection is restored:
   - The app reads all entries from the `pending_requests` table, ordered chronologically.
   - It iterates through the requests and dispatches them via the `api.js` Axios instance.
   - Upon a successful response, the specific request is deleted from the local SQLite queue.
   - If a request fails (e.g., 500 error), it remains in the queue for the next synchronization attempt.

---

## 4. Authentication State Sync

Authentication states between the apps and the backend are kept in sync using JSON Web Tokens (JWT):

- **Interceptors**: The `mobile/services/api.js` file handles token injection globally. Before any request is sent, it retrieves the stored token from `expo-secure-store` and attaches it to the `Authorization` header.
- **Session Expiry Handling**: If the backend responds with a `401 Unauthorized` (indicating an expired or invalid token), the interceptor automatically clears the local SecureStore (both `token` and `user` data) and kicks the user back to the Login screen.

## 5. Potential Improvements
- **Optimistic UI Updates**: The mobile app could visually reflect changes immediately in the local UI state while placing the request in the offline queue, ensuring the user isn't blocked while waiting for synchronization.
- **Conflict Resolution**: Currently, offline requests are replayed in chronological order. Implementing a robust conflict resolution strategy (e.g., checking timestamps or version hashes) on the backend can prevent overwriting newer web-based changes with older, delayed mobile offline requests.
- **Data Caching for Offline Reads**: In addition to queueing mutations, frequently accessed read-only data (e.g., lists of categories or recent PRs) could be cached locally using `AsyncStorage` or `SQLite` so the user can browse records while entirely offline.
