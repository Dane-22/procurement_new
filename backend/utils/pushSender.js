import { Expo } from 'expo-server-sdk';
import webpush from 'web-push';
import pool from '../config/database.js';

const expo = new Expo();

// Configure Web Push if VAPID keys are available
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('Web Push VAPID keys not configured in .env');
}

export const sendPushNotification = async (employeeId, payload) => {
  try {
    // 1. Mobile Push Notifications (Expo)
    await sendMobilePush(employeeId, payload);
    
    // 2. Web Push Notifications (Browsers)
    await sendWebPush(employeeId, payload);
  } catch (err) {
    console.error('Error in sendPushNotification wrapper:', err);
  }
};

const sendMobilePush = async (employeeId, payload) => {
  try {
    const [rows] = await pool.query(
      'SELECT fcm_token FROM employees WHERE id = ?',
      [employeeId]
    );

    if (rows.length === 0 || !rows[0].fcm_token) return;

    const pushToken = rows[0].fcm_token;

    if (!Expo.isExpoPushToken(pushToken)) {
      // console.error(`Push token ${pushToken} is not a valid Expo push token`);
      return;
    }

    const messages = [{
      to: pushToken,
      sound: 'default',
      title: payload.title || 'Procurement System',
      body: payload.message || 'You have a new notification',
      data: payload,
    }];

    const chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Error sending mobile push chunk:', error);
      }
    }
  } catch (err) {
    console.error('Error sending mobile push:', err);
  }
};

const sendWebPush = async (employeeId, payload) => {
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return;
    }

    // Query for all web push subscriptions for this user
    const [subscriptions] = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE employee_id = ?',
      [employeeId]
    );

    if (subscriptions.length === 0) return;

    // Send to all subscriptions in parallel
    const pushPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(
          pushSubscription, 
          JSON.stringify(payload)
        );
      } catch (error) {
        // If the subscription is no longer valid (e.g. user revoked permission or token expired), delete it
        if (error.statusCode === 404 || error.statusCode === 410) {
          console.log(`Deleting expired web push subscription ID: ${sub.id}`);
          await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        } else {
          console.error('Error sending web push to subscription:', error);
        }
      }
    });

    await Promise.all(pushPromises);
  } catch (err) {
    console.error('Error sending web push:', err);
  }
};
