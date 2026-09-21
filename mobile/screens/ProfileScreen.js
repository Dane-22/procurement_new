import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import NotificationBell from '../components/NotificationBell';

export default function ProfileScreen({ navigation }) {
  const { setUser: setGlobalUser } = useContext(AuthContext) || {};
  const [user, setUser] = useState(null);
  const [profileImage, setProfileImage] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userStr = await SecureStore.getItemAsync('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const pickImage = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
      // In a real app, you would upload this to your server/S3 bucket here
      Alert.alert('Success', 'Profile picture updated successfully!');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Log Out', 
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('user');
          if (setGlobalUser) {
            setGlobalUser(null);
          } else {
            Alert.alert('Logged Out', 'Please restart the app or use the implemented logout context.', [
               { text: 'OK' }
            ]);
          }
        }
      }
    ]);
  };

  if (!user) return <View style={styles.container} />;

  return (
    <ScrollView style={styles.container} bounces={false}>
      <View style={styles.headerGradient}>
        <View style={styles.headerActions}>
           <Text style={styles.headerTitle}>My Profile</Text>
           <View style={{ flexDirection: 'row', alignItems: 'center' }}>
             <View style={{ marginRight: 15 }}>
               <NotificationBell color="#1E293B" />
             </View>
             <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconButton, { marginRight: 56 }]}>
               <MaterialIcons name="close" size={24} color="#1E293B" />
             </TouchableOpacity>
           </View>
        </View>
        
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Text style={styles.placeholderText}>
                  {user.firstname?.[0] || ''}{user.lastname?.[0] || ''}
                </Text>
              </View>
            )}
            <View style={styles.editIconBadge}>
              <MaterialIcons name="edit" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{user.firstname} {user.lastname}</Text>
          <Text style={styles.userRole}>{user.role}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="badge" size={20} color="#64748b" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Employee Number</Text>
              <Text style={styles.infoValue}>{user.employee_no}</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <MaterialIcons name="email" size={20} color="#64748b" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue}>{user.email || 'Not provided'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingIconContainer}>
              <MaterialIcons name="notifications-none" size={20} color="#d97706" />
            </View>
            <Text style={styles.settingText}>Notifications</Text>
            <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingIconContainer}>
              <MaterialIcons name="security" size={20} color="#d97706" />
            </View>
            <Text style={styles.settingText}>Privacy & Security</Text>
            <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
        
        <Text style={[styles.versionText, { paddingBottom: 60 }]}>App Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerGradient: { 
    backgroundColor: '#FFBF00', 
    paddingTop: 60, 
    paddingBottom: 30, 
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30 
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20
  },
  iconButton: {
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  profileSection: { alignItems: 'center' },
  imageContainer: { 
    position: 'relative', 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  profileImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#ffffff' },
  placeholderImage: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: '#ffffff', 
    borderWidth: 4, 
    borderColor: '#ffffff',
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  placeholderText: { fontSize: 36, fontWeight: '700', color: '#1E293B' },
  editIconBadge: { 
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    backgroundColor: '#1E293B', 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff'
  },
  userName: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  userRole: { fontSize: 14, color: '#334155', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  
  content: { padding: 24, marginTop: -20 },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 20, 
    shadowColor: '#0f172a', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 12, 
    elevation: 3, 
    marginBottom: 20 
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoTextContainer: { marginLeft: 16 },
  infoLabel: { fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#1e293b', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f1f5f9', my: 16 },
  
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  settingIconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  settingText: { flex: 1, fontSize: 16, color: '#1e293b', fontWeight: '600' },
  
  logoutButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#fef2f2', 
    padding: 16, 
    borderRadius: 16,
    marginBottom: 24
  },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 16, marginLeft: 8 },
  versionText: { textAlign: 'center', color: '#94a3b8', fontSize: 12, fontWeight: '500' }
});
