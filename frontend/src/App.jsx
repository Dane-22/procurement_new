import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { socketService } from './services/socket';
import { notificationService, urlBase64ToUint8Array } from './services/notifications';
import Layout from './components/layout/Layout';
import AppRoutes from './routes/AppRoutes';
import './App.css';

let pushRegistrationPromise;

const registerPushNotifications = () => {
  if (pushRegistrationPromise) return pushRegistrationPromise;

  pushRegistrationPromise = (async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const registration = await navigator.serviceWorker.register('/sw.js');
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== 'granted') return;

    const publicKey = await notificationService.getVapidPublicKey();
    if (!publicKey) return;

    const subscription = await registration.pushManager.getSubscription()
      || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    await notificationService.subscribeToPush(subscription);
  })().catch((error) => {
    // Browser push can fail independently of the app's in-page notifications.
    if (error.name === 'AbortError') {
      console.warn('Browser push service is unavailable:', error.message);
    } else {
      console.error('Failed to register push notifications:', error);
    }
  }).finally(() => {
    pushRegistrationPromise = null;
  });

  return pushRegistrationPromise;
};

function App() {
  const { user, logout, token } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (userId && token) {
      console.log('Connecting socket for user:', userId, 'role:', userRole);
      socketService.connect(token, userId, userRole);
      console.log('Socket connected?', socketService.isConnected());

      // Listen for real-time notifications
      const handleNotification = (data) => {
        console.log('Received notification:', data);
        setNotifications(prev => [data, ...prev]);
        
        // Play notification sound
        try {
          const audio = new Audio('/sounds/notification.ogg');
          audio.play().catch(e => console.log('Audio autoplay prevented:', e));
        } catch (err) {
          console.error('Failed to play notification sound:', err);
        }
      };
      socketService.on('notification', handleNotification);

      // Register Push Notifications
      registerPushNotifications();

      return () => {
        socketService.off('notification', handleNotification);
        socketService.disconnect();
      };
    }
  }, [userId, userRole, token]);

  // Fetch notifications on load
  useEffect(() => {
    if (!userId) return;
    
    const fetchNotifications = async () => {
      try {
        const data = await notificationService.getAll();
        const notifications = Array.isArray(data) ? data : data?.notifications || [];
        setNotifications(notifications.filter(n => !n.is_read));
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };
    
    fetchNotifications();
    // Refresh every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Layout 
      user={user}
      notifications={notifications}
      setNotifications={setNotifications}
      onLogout={handleLogout}
    >
      <AppRoutes />
    </Layout>
  );
}

export default App;
