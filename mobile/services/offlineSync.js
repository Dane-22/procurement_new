import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import api from './api';

let db;

// Initialize the SQLite database
export const initDB = async () => {
  if (db) return;
  try {
    // For Expo SDK 50+, we use openDatabaseSync
    db = SQLite.openDatabaseSync('procurement.db');
    
    // Create the pending requests table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Offline SQLite DB initialized');
  } catch (error) {
    console.error('Failed to initialize SQLite DB:', error);
  }
};

// Add a pending request to the local database
export const addPendingRequest = async (endpoint, method, payload) => {
  if (!db) await initDB();
  try {
    await db.runAsync(
      'INSERT INTO pending_requests (endpoint, method, payload) VALUES (?, ?, ?)',
      [endpoint, method, JSON.stringify(payload)]
    );
    console.log('Saved pending request to offline storage');
  } catch (error) {
    console.error('Failed to save pending request:', error);
  }
};

// Sync all pending requests when online
export const syncPendingRequests = async () => {
  const networkState = await NetInfo.fetch();
  if (!networkState.isConnected) {
    console.log('Cannot sync: Device is offline');
    return;
  }

  if (!db) await initDB();

  try {
    const allRows = await db.getAllAsync('SELECT * FROM pending_requests ORDER BY id ASC');
    if (allRows.length === 0) {
      return;
    }

    console.log(`Attempting to sync ${allRows.length} pending requests...`);

    for (const row of allRows) {
      try {
        const payload = JSON.parse(row.payload);
        
        // --- Conflict Resolution (Server-Wins with Status Validation) ---
        const prMatch = row.endpoint.match(/\/purchase-requests\/(\d+)/);
        if (prMatch && payload.expectedStatus) {
           const prId = prMatch[1];
           try {
             const statusRes = await api.get(`/purchase-requests/${prId}`);
             const currentStatus = statusRes.data.status || statusRes.data.purchaseRequest?.status;
             if (currentStatus && currentStatus !== payload.expectedStatus) {
                 console.warn(`Conflict detected for PR ${prId}. Expected ${payload.expectedStatus} but got ${currentStatus}.`);
                 await db.runAsync('DELETE FROM pending_requests WHERE id = ?', [row.id]);
                 Alert.alert('Sync Conflict', `Failed to sync action for PR #${prId} because it was modified by someone else.`);
                 continue; // skip sending this request
             }
           } catch (e) {
             console.log('Could not verify PR status, proceeding anyway...', e.message);
           }
        }
        
        // Remove expectedStatus from payload before sending
        const { expectedStatus, ...dataToSubmit } = payload;
        
        // Use the API service to make the request
        if (row.method.toUpperCase() === 'POST') {
          await api.post(row.endpoint, dataToSubmit);
        } else if (row.method.toUpperCase() === 'PUT') {
          await api.put(row.endpoint, dataToSubmit);
        }
        
        // On success, delete from local DB
        await db.runAsync('DELETE FROM pending_requests WHERE id = ?', [row.id]);
        console.log(`Successfully synced request ID: ${row.id}`);
      } catch (reqError) {
        console.error(`Failed to sync request ID: ${row.id}`, reqError.message);
        // We'll leave it in the database to retry next time
      }
    }
  } catch (error) {
    console.error('Error during syncPendingRequests:', error);
  }
};

// Listen for network changes to trigger auto-sync
export const setupNetworkListener = () => {
  return NetInfo.addEventListener(state => {
    if (state.isConnected) {
      console.log('Network connected. Triggering sync...');
      syncPendingRequests();
    }
  });
};
