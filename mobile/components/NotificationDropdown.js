import React from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, FlatList, TouchableWithoutFeedback } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme';

export default function NotificationDropdown({ visible, onClose }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigation = useNavigation();

  const handleNotificationPress = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    onClose();

    // Navigate based on related_type
    if (notification.related_type === 'purchase_request' && notification.related_id) {
      navigation.navigate('PRDetail', { prId: notification.related_id });
    }
    // Add logic for PO, SR, CR if needed
  };

  const renderItem = ({ item }) => {
    const isUnread = !item.is_read;
    return (
      <TouchableOpacity 
        style={[styles.notificationItem, isUnread && styles.unreadItem]} 
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.iconContainer}>
          <MaterialIcons 
            name={isUnread ? "mark-email-unread" : "notifications"} 
            size={20} 
            color={isUnread ? colors.primary : colors.textMuted} 
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, isUnread && styles.unreadText]}>{item.title}</Text>
          <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dropdownContainer}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Notifications ({unreadCount})</Text>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={markAllAsRead}>
                    <Text style={styles.markAllText}>Mark all as read</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No notifications yet.</Text>
                </View>
              ) : (
                <FlatList
                  data={notifications}
                  keyExtractor={item => item.id.toString()}
                  renderItem={renderItem}
                  style={styles.list}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 90,
    paddingRight: 10,
  },
  dropdownContainer: {
    width: 320,
    maxHeight: 450,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#fafafa',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  markAllText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  list: {
    flexGrow: 0,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  unreadItem: {
    backgroundColor: '#f8fafc', // slight tint for unread
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: 'bold',
  },
  message: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 6,
  },
  time: {
    fontSize: 11,
    color: '#94a3b8',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  }
});
