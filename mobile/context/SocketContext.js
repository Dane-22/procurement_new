import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { AuthContext } from './AuthContext';
import { Alert } from 'react-native';

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useContext(AuthContext) || {};

  useEffect(() => {
    let newSocket;
    const initSocket = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://10.0.2.2:5001';
          
          newSocket = io(SOCKET_URL, {
            auth: { token },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
          });

          newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
            if (user) {
              if (user.id) {
                newSocket.emit('join', user.id);
                console.log(`[Socket] Joined user room: ${user.id}`);
              }
              if (user.role) {
                newSocket.emit('join_role', user.role);
                console.log(`[Socket] Joined role room: ${user.role}`);
              }
            }
          });

          newSocket.on('connect_error', (err) => {
            console.warn('Socket connect error:', err.message);
          });

          newSocket.on('pr_updated', (data) => {
            console.log('Socket: PR Updated');
          });

          newSocket.on('new_pr', (data) => {
            console.log('Socket: New PR');
          });

          setSocket(newSocket);
        }
      } catch (error) {
        console.error('Socket init error', error);
      }
    };

    // Only init if we have a user (meaning we are logged in)
    if (user) {
      initSocket();
    }

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
