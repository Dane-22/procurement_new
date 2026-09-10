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

const getPendingReviewerRole = (requesterRole) => {
  if (requesterRole === 'engineer') return 'engineer';
  if (requesterRole === 'admin') return 'admin';
  return null;
};

const getReviewerRoleLabel = (role) => {
  const roles = {
    engineer: 'Engineer',
    admin: 'Admin',
    super_admin_rep: 'Super Admin Rep',
    super_admin: 'Super Admin',
    procurement: 'Procurement'
  };
  return roles[role] || role;
};

const getCurrentReviewStage = (status, requesterRole) => {
  const stages = {
    'For Engineer Review': { role: 'engineer', label: 'Engineer review' },
    'For Admin Review': { role: 'admin', label: 'Admin review' },
    'For Procurement Review': { role: 'procurement', label: 'Procurement review' }
  };
  if (stages[status]) return stages[status];
  const requesterStageRole = getPendingReviewerRole(requesterRole);
  return requesterStageRole
    ? { role: requesterStageRole, label: `${getReviewerRoleLabel(requesterStageRole)} review` }
    : { role: null, label: 'Review status' };
};

export default function PRReviewScreen({ route, navigation }) {
  const { prId } = route.params;
  const [pr, setPr] = useState(null);
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
      const response = await api.get(`/purchase-requests/${prId}`);
      if (response.data && response.data.purchaseRequest) {
        setPr(response.data.purchaseRequest);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFBF00" />
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
    if ((pr.status === 'For Admin Review' || pr.status === 'For Admin Processing' || pr.status === 'Pending Admin Processing') && userRole === 'admin') return true;
    if (pr.status === 'For Super Admin Final Approval' && userRole === 'super_admin') return true;
    if (pr.status === 'For Super Admin Rep Review' && userRole === 'super_admin_rep') return true;
    return false;
  };

  const reviewRecords = Array.isArray(pr.reviews)
    ? pr.reviews.filter(review => review.reviewer_is_active === undefined || Boolean(review.reviewer_is_active))
    : [];
  const currentReviewStage = getCurrentReviewStage(pr.status, pr.requester_role);
  const stageReviewers = currentReviewStage.role
    ? reviewRecords.filter(review => review.reviewer_role === currentReviewStage.role)
    : reviewRecords.filter(review => review.reviewer_role !== 'super_admin');
  
  const stageApprovedReviewers = stageReviewers.filter(review => review.review_status === 'approved');
  const stagePendingReviewers = stageReviewers.filter(review => review.review_status !== 'approved' && review.review_status !== 'rejected');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Main Details Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Review: PR #{pr.pr_number}</Text>
          <View style={styles.status}><Text style={styles.statusText}>{pr.status}</Text></View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Requester:</Text>
            <Text style={styles.detailValue}>{pr.requester_first_name} {pr.requester_last_name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Project:</Text>
            <Text style={styles.detailValue}>{pr.project || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Purpose:</Text>
            <Text style={styles.detailValue}>{pr.purpose || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date Needed:</Text>
            <Text style={styles.detailValue}>{pr.date_needed ? pr.date_needed.substring(0,10) : '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Basis:</Text>
            <Text style={styles.detailValue}>{pr.payment_basis === 'non_debt' ? 'Cash / Non-Debt' : 'Debt / Account'}</Text>
          </View>
          {pr.remarks ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Remarks:</Text>
              <Text style={styles.detailValue}>{pr.remarks}</Text>
            </View>
          ) : null}
        </View>

        {/* Reviewer Status Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{currentReviewStage.label ? currentReviewStage.label.toUpperCase() : 'REVIEW'}</Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {stageApprovedReviewers.length}/{stageReviewers.length} reviewed
            </Text>
          </View>
          
          <View style={styles.reviewerList}>
            <Text style={styles.reviewerLabel}>Reviewed by:</Text>
            <Text style={styles.reviewerNames}>
              {stageApprovedReviewers.length ? stageApprovedReviewers.map(r => `${r.reviewer_first_name} ${r.reviewer_last_name}`).join(', ') : 'None yet'}
            </Text>
          </View>
          
          {stagePendingReviewers.length > 0 && (
            <View style={styles.reviewerList}>
              <Text style={styles.reviewerLabel}>Pending:</Text>
              <Text style={styles.pendingNames}>
                {stagePendingReviewers.map(r => `${r.reviewer_first_name} ${r.reviewer_last_name}`).join(', ')}
              </Text>
            </View>
          )}
        </View>

        {/* Items Card */}
        <Text style={styles.itemsHeader}>Requested Items</Text>
        {pr.items && pr.items.map((item, index) => (
          <View key={item.id || index} style={styles.itemCard}>
            <View style={styles.itemTitleRow}>
              <Text style={styles.itemDesc}>{item.item_name}</Text>
            </View>
            <View style={styles.itemDetailsGrid}>
              <View style={styles.gridBox}>
                <Text style={styles.gridLabel}>Qty / Unit</Text>
                <Text style={styles.gridValue}>{item.quantity} {item.unit}</Text>
              </View>
              <View style={styles.gridBox}>
                <Text style={styles.gridLabel}>Unit Cost</Text>
                <Text style={styles.gridValue}>₱{parseFloat(item.unit_price || 0).toFixed(2)}</Text>
              </View>
              <View style={[styles.gridBox, { borderRightWidth: 0 }]}>
                <Text style={styles.gridLabel}>Amount</Text>
                <Text style={styles.gridAmount}>₱{parseFloat(item.total_price || 0).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Amount:</Text>
          <Text style={styles.totalAmount}>₱{parseFloat(pr.total_amount || 0).toFixed(2)}</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      {canApprove() && (
        <View style={styles.bottomActionBar}>
          <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={handleReject}>
            <Text style={styles.actionBtnText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={handleApprove}>
            <Text style={styles.actionBtnText}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}
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
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  status: {
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#d97706',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  detailLabel: {
    width: 110,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 10,
    letterSpacing: 1,
  },
  progressRow: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  reviewerList: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  reviewerLabel: {
    width: 90,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  reviewerNames: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  pendingNames: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  itemsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 10,
    marginTop: 10,
  },
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
    overflow: 'hidden',
  },
  itemTitleRow: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemDesc: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  itemDetailsGrid: {
    flexDirection: 'row',
  },
  gridBox: {
    flex: 1,
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#f3f4f6',
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  gridAmount: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  bottomPadding: {
    height: 80, // Space for the fixed bottom bar
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  approveBtn: {
    backgroundColor: '#FFBF00',
  },
  rejectBtn: {
    backgroundColor: '#1f2937',
  },
  actionBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
