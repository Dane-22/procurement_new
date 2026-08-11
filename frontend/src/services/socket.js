import { io } from 'socket.io-client';
import { clearApiCache } from './api';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://procurement-api.xandree.com';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.fetchingRef = false;
  }

  connect(token, userId, role) {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Track connection state for observability
    this.connectionState = 'connecting';
    this.connectionAttempts = 0;
    this.lastConnectedAt = null;
    this.lastDisconnectedAt = null;
    this.disconnectReason = null;

    this.socket.on('connect', () => {
      this.connectionState = 'connected';
      this.connectionAttempts = 0;
      this.lastConnectedAt = new Date().toISOString();
      console.log('[Socket] Connected:', this.socket.id, 'at', this.lastConnectedAt);
      
      // Join user-specific room
      if (userId) {
        this.socket.emit('join', userId);
        console.log('[Socket] Joined user room:', userId);
      }
      
      // Join role-specific room
      if (role) {
        this.socket.emit('join_role', role);
        console.log('[Socket] Joined role room:', role);
      }
      
      // Register any queued listeners
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach(cb => {
          this.socket.on(event, cb.wrapped);
          console.log('[Socket] Registered listener for event:', event);
        });
      });
    });

    this.socket.on('disconnect', (reason) => {
      this.connectionState = 'disconnected';
      this.lastDisconnectedAt = new Date().toISOString();
      this.disconnectReason = reason;
      console.log('[Socket] Disconnected at', this.lastDisconnectedAt, 'reason:', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.connectionAttempts++;
      console.error('[Socket] Connection error (attempt', this.connectionAttempts, '):', error.message);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket] Reconnection attempt', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('[Socket] Reconnection error:', error.message);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed after all attempts');
      this.connectionState = 'failed';
    });

    this.socket.on('error', (error) => {
      console.error('[Socket] Error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Subscribe to events with automatic cache clearing for realtime updates
  on(event, callback, options = {}) {
    // Wrap callback with error handling and cache clearing
    const wrappedCallback = (data) => {
      try {
        if (options.clearCache !== false) {
          clearApiCache();
          console.log(`[Socket] Cache cleared for event: ${event}`);
        }
        callback(data);
      } catch (error) {
        console.error(`[Socket] Error in event handler for ${event}:`, error);
        // Re-throw to not swallow errors completely, but log them
        throw error;
      }
    };

    // Store wrapped callback for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push({ original: callback, wrapped: wrappedCallback });

    // Register immediately if socket exists
    if (this.socket) {
      this.socket.on(event, wrappedCallback);
    }
  }

  off(event, callback) {
    if (!this.socket) return;
    
    // Find and remove the wrapped callback
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.findIndex(cb => cb.original === callback);
      if (index > -1) {
        const wrapped = callbacks[index].wrapped;
        this.socket.off(event, wrapped);
        callbacks.splice(index, 1);
      }
    }
  }

  // Check if connected
  isConnected() {
    return this.socket?.connected || false;
  }

  // Get connection diagnostics for observability
  getDiagnostics() {
    return {
      state: this.connectionState,
      isConnected: this.isConnected(),
      socketId: this.socket?.id || null,
      connectionAttempts: this.connectionAttempts,
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectedAt: this.lastDisconnectedAt,
      disconnectReason: this.disconnectReason,
      activeListeners: Array.from(this.listeners.keys()).reduce((acc, event) => {
        acc[event] = this.listeners.get(event).length;
        return acc;
      }, {})
    };
  }

  // Log current state for debugging
  logDiagnostics() {
    const diagnostics = this.getDiagnostics();
    console.log('[Socket Diagnostics]', diagnostics);
    return diagnostics;
  }
}

export const socketService = new SocketService();
export default socketService;
