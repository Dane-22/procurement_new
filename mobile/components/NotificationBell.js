import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import NotificationDropdown from './NotificationDropdown';
import { colors } from '../theme';

export default function NotificationBell({ color = colors.secondary }) {
  const { unreadCount } = useNotifications();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  return (
    <>
      <TouchableOpacity 
        style={styles.container} 
        onPress={() => setDropdownVisible(true)}
      >
        <MaterialIcons name="notifications" size={24} color={color} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <NotificationDropdown 
        visible={dropdownVisible} 
        onClose={() => setDropdownVisible(false)} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 5,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  }
});
