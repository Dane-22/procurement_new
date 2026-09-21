import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { socketService } from './services/socket';
import { notificationService, urlBase64ToUint8Array } from './services/notifications';
import Layout from './components/layout/Layout';
import AppRoutes from './routes/AppRoutes';
import './App.css';

function App() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (user && token) {
      console.log('Connecting socket for user:', user.id, 'role:', user.role);
      socketService.connect(token, user.id, user.role);
      console.log('Socket connected?', socketService.isConnected());

      // Listen for real-time notifications
      socketService.on('notification', (data) => {
        console.log('Received notification:', data);
        setNotifications(prev => [data, ...prev]);
        
        // Play notification sound
        try {
          const audio = new Audio('/sounds/notification.ogg');
          audio.play().catch(e => console.log('Audio autoplay prevented:', e));
        } catch (err) {
          console.error('Failed to play notification sound:', err);
        }
      });

      // Register Push Notifications
      const registerPush = async () => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered');
            
            // Ask for permission
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              const publicKey = await notificationService.getVapidPublicKey();
              const applicationServerKey = urlBase64ToUint8Array(publicKey);
              
              const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
              });
              
              await notificationService.subscribeToPush(subscription);
              console.log('Push notification subscribed');
            }
          } catch (error) {
            console.error('Error during service worker registration or push subscription:', error);
          }
        }
      };
      
      registerPush();
    }
    
    return () => {
      socketService.disconnect();
    };
  }, [user, token]);

  // Fetch notifications on load
  useEffect(() => {
    if (!user) return;
    
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
  }, [user]);

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
