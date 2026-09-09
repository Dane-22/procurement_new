import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';
import * as SecureStore from 'expo-secure-store';

const REVIEW_STATUSES = new Set([
  'For Engineer Review',
  'For Admin Review',
  'For Super Admin Rep Review'
]);

export default function PRDetailScreen({ route, navigation }) {
  const { prId } = route.params;
  const [pr, setPr] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    fetchPRDetails();
    getUserRole();
  }, [prId]);

  const getUserRole = async () => {
    const userStr = await SecureStore.getItemAsync('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserRole(user.role);
    }
  };

  const fetchPRDetails = async () => {
    try {
      const response = await api.get(`/purchase-requests`);
      const prData = response.data.purchaseRequests.find(p => p.id === prId);
      
      if (prData) {
        setPr(prData);
        setItems(prData.items || []);
      }
    } catch (error) {
      console.error('Error fetching PR details:', error);
      Alert.alert('Error', 'Failed to load PR details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      if (REVIEW_STATUSES.has(pr.status)) {
        await api.post(`/purchase-requests/${prId}/review`, { review_status: 'approved', review_comment: '' });
      } else {
        // Final approval
        await api.put(`/purchase-requests/${prId}/approve`, { status: 'For Purchase', remarks: '' });
      }
      Alert.alert('Success', 'Request approved');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to approve request');
    }
  };

  const handleReject = async () => {
    try {
      if (REVIEW_STATUSES.has(pr.status)) {
        await api.post(`/purchase-requests/${prId}/review`, { review_status: 'rejected', review_comment: 'Rejected from mobile' });
      } else {
        await api.put(`/purchase-requests/${prId}/approve`, { status: 'Rejected', remarks: 'Rejected from mobile' });
      }
      Alert.alert('Success', 'Request rejected');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to reject request');
    }
  };

  const handleBypass = async () => {
    try {
      await api.put(`/purchase-requests/${prId}/bypass`);
      Alert.alert('Success', 'Request bypassed');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to bypass request');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!pr) {
    return (
      <View style={styles.center}>
        <Text>PR not found</Text>
      </View>
    );
  }

  const canApprove = () => {
    if (pr.status === 'For Engineer Review' && userRole === 'engineer') return true;
    if (pr.status === 'For Admin Review' && userRole === 'admin') return true;
    if (pr.status === 'For Super Admin Final Approval' && userRole === 'super_admin') return true;
    if (pr.status === 'For Super Admin Rep Review' && userRole === 'super_admin_rep') return true;
    return false;
  };

  const canBypass = () => {
    return userRole === 'super_admin' && (pr.status !== 'For Purchase' && pr.status !== 'Rejected' && pr.status !== 'Draft');
  };

  const canEdit = () => {
    return true;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>{pr.pr_number || `PR #${pr.id}`}</Text>
          <Text style={styles.status}>{pr.status}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status Tracking</Text>
          <View style={styles.timeline}>
            {['Pending', 'Under Admin Review', 'For Super Admin Rep Review', 'For Super Admin Final Approval', 'For Purchase'].map((step, index, arr) => {
              const isActive = pr.status === step;
              const isPast = arr.indexOf(pr.status) > index || pr.status === 'Completed' || pr.status === 'Received' || pr.status === 'PO Created';
              const isRejected = pr.status === 'Rejected' && isActive;
              
              return (
                <View key={step} style={styles.timelineItem}>
                  <View style={[styles.timelineDot, isPast ? styles.timelineDotPast : (isActive ? (isRejected ? styles.timelineDotRejected : styles.timelineDotActive) : styles.timelineDotFuture)]} />
                  <Text style={[styles.timelineText, isActive && styles.timelineTextActive]}>{step}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Requester:</Text>
            <Text style={styles.value}>{pr.first_name} {pr.last_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Purpose:</Text>
            <Text style={styles.value}>{pr.purpose}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Amount:</Text>
            <Text style={styles.amount}>${parseFloat(pr.total_amount).toFixed(2)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {canApprove() && (
          <View style={styles.actionContainer}>
            <TouchableOpacity style={[styles.button, styles.approveBtn]} onPress={handleApprove}>
              <Text style={styles.buttonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.rejectBtn]} onPress={handleReject}>
              <Text style={styles.buttonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        {canBypass() && (
          <View style={styles.actionContainer}>
             <TouchableOpacity style={[styles.button, styles.bypassBtn]} onPress={handleBypass}>
              <Text style={styles.buttonText}>Bypass to PO</Text>
            </TouchableOpacity>
          </View>
        )}

        {canEdit() && (
          <View style={styles.actionContainer}>
             <TouchableOpacity style={[styles.button, styles.editBtn]} onPress={() => navigation.navigate('EditRequest', { editMode: true, requestData: pr })}>
              <Text style={styles.buttonText}>Edit Request</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  status: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 10,
  },
  timeline: {
    paddingLeft: 10,
    marginTop: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  timelineDotPast: {
    backgroundColor: '#10b981', // green
  },
  timelineDotActive: {
    backgroundColor: '#3b82f6', // blue
  },
  timelineDotRejected: {
    backgroundColor: '#ef4444', // red
  },
  timelineDotFuture: {
    backgroundColor: '#d1d5db', // gray
  },
  timelineText: {
    fontSize: 14,
    color: '#6b7280',
  },
  timelineTextActive: {
    color: '#1f2937',
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  label: {
    width: 100,
    color: '#6b7280',
    fontWeight: '500',
  },
  value: {
    flex: 1,
    color: '#1f2937',
  },
  amount: {
    flex: 1,
    color: '#10b981',
    fontWeight: 'bold',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  approveBtn: {
    backgroundColor: '#10b981',
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
  },
  bypassBtn: {
    backgroundColor: '#f59e0b',
  },
  editBtn: {
    backgroundColor: '#3b82f6',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
