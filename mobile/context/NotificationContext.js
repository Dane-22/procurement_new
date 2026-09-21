import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import api from '../services/api';
import { useSocket } from './SocketContext';
import { AuthContext } from './AuthContext';

const NotificationContext = createContext();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Use expo-audio player
  const player = useAudioPlayer(require('../assets/sounds/notification.mp3'));
  
  const socket = useSocket();
  const { user } = useContext(AuthContext);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    // Ensure audio plays even if the device is in silent mode
    const configureAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
        });
      } catch (e) {
        console.warn('Could not configure audio mode', e);
      }
    };
    configureAudio();
  }, [fetchNotifications]);

  // Socket listener
  useEffect(() => {
    if (!socket || !user) return;

    const handleNewNotification = async (payload) => {
      // Play sound
      if (player) {
        try {
          player.seekTo(0);
          player.play();
        } catch (err) {
          console.warn('Failed to play sound', err);
        }
      }

      // Show in-app banner/toast
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: payload?.title || 'New Notification',
            body: payload?.message || 'You have a new update.',
          },
          trigger: null, // immediate
        });
      } catch (err) {
        console.warn('Failed to show local notification', err);
      }

      // Re-fetch to get the newest list and count
      fetchNotifications();
    };

    // The backend emits 'notification' event with payload
    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, [socket, user, player, fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      refreshNotifications: fetchNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
