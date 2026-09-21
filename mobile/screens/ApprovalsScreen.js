import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import NetInfo from '@react-native-community/netinfo';
import { addPendingRequest } from '../services/offlineSync';

const REVIEW_STATUSES = new Set([
  'For Engineer Review',
  'For Admin Review',
  'For Super Admin Rep Review'
]);

export default function ApprovalsScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [filter, setFilter] = useState('pending'); // 'pending' or 'reviewed'
  const [processingId, setProcessingId] = useState(null);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const socket = useSocket();

  useEffect(() => {
    if (isFocused) {
      setPage(1);
      setHasMore(true);
      fetchUserAndRequests(1, true);
    }
  }, [isFocused, filter]);

  useEffect(() => {
    if (socket) {
      const handleUpdate = () => {
        setPage(1);
        setHasMore(true);
        fetchUserAndRequests(1, true);
      };

      socket.on('pr_status_changed', handleUpdate);

      return () => {
        socket.off('pr_status_changed', handleUpdate);
      };
    }
  }, [socket, filter]);

  const fetchUserAndRequests = async (pageNum = page, reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const userStr = await SecureStore.getItemAsync('user');
      let role = null;
      if (userStr) {
        const user = JSON.parse(userStr);
        role = user.role;
        setUserRole(role);
      }
      
      const response = await api.get(`/purchase-requests?my_reviews=${filter}&pageSize=10&page=${pageNum}`); 
      const newPrs = response.data.purchaseRequests || [];
      
      if (reset) {
        setRequests(newPrs);
      } else {
        setRequests(prev => [...prev, ...newPrs]);
      }
      
      if (newPrs.length < 10) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreApprovals = () => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchUserAndRequests(nextPage, false);
    }
  };

  const handleReview = useCallback((id) => {
    navigation.navigate('PRReview', { prId: id });
  }, [navigation]);

  const handleQuickApprove = useCallback((pr) => {
    Alert.alert(
      'Confirm Approval',
      `Are you sure you want to approve PR #${pr.pr_number || pr.id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Approve', 
          style: 'default',
          onPress: async () => {
            setProcessingId(pr.id);
            try {
              const isReview = REVIEW_STATUSES.has(pr.status);
              const endpoint = isReview ? `/purchase-requests/${pr.id}/review` : `/purchase-requests/${pr.id}/approve`;
              const method = isReview ? 'POST' : 'PUT';
              const payload = isReview 
                ? { review_status: 'approved', review_comment: 'Approved from list', expectedStatus: pr.status }
                : { status: 'For Purchase', remarks: 'Approved from list', expectedStatus: pr.status };

              const netInfo = await NetInfo.fetch();
              if (!netInfo.isConnected) {
                await addPendingRequest(endpoint, method, payload);
                Alert.alert('Offline Mode', 'Approval saved offline and will sync automatically.');
              } else {
                if (method === 'POST') {
                  await api.post(endpoint, payload);
                } else {
                  await api.put(endpoint, payload);
                }
              }
              // Remove from the list immediately upon success
              setRequests(prev => prev.filter(item => item.id !== pr.id));
            } catch (error) {
              if (error.message && error.message.includes('Network Error')) {
                const isReview = REVIEW_STATUSES.has(pr.status);
                const endpoint = isReview ? `/purchase-requests/${pr.id}/review` : `/purchase-requests/${pr.id}/approve`;
                const method = isReview ? 'POST' : 'PUT';
                const payload = isReview 
                  ? { review_status: 'approved', review_comment: 'Approved from list', expectedStatus: pr.status }
                  : { status: 'For Purchase', remarks: 'Approved from list', expectedStatus: pr.status };
                await addPendingRequest(endpoint, method, payload);
                Alert.alert('Offline Mode', 'Network failed. Approval saved offline.');
                setRequests(prev => prev.filter(item => item.id !== pr.id));
              } else {
                Alert.alert('Error', error?.response?.data?.message || 'Failed to approve request');
              }
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  }, []);

  const handleQuickReject = useCallback((pr) => {
    Alert.alert(
      'Confirm Rejection',
      `Are you sure you want to reject PR #${pr.pr_number || pr.id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: async () => {
            setProcessingId(pr.id);
            try {
              const isReview = REVIEW_STATUSES.has(pr.status);
              const endpoint = isReview ? `/purchase-requests/${pr.id}/review` : `/purchase-requests/${pr.id}/approve`;
              const method = isReview ? 'POST' : 'PUT';
              const payload = isReview 
                ? { review_status: 'rejected', review_comment: 'Rejected from quick actions', expectedStatus: pr.status }
                : { status: 'Rejected', remarks: 'Rejected from quick actions', expectedStatus: pr.status };

              const netInfo = await NetInfo.fetch();
              if (!netInfo.isConnected) {
                await addPendingRequest(endpoint, method, payload);
                Alert.alert('Offline Mode', 'Rejection saved offline and will sync automatically.');
              } else {
                if (method === 'POST') {
                  await api.post(endpoint, payload);
                } else {
                  await api.put(endpoint, payload);
                }
              }
              // Remove from the list immediately upon success
              setRequests(prev => prev.filter(item => item.id !== pr.id));
            } catch (error) {
              if (error.message && error.message.includes('Network Error')) {
                const isReview = REVIEW_STATUSES.has(pr.status);
                const endpoint = isReview ? `/purchase-requests/${pr.id}/review` : `/purchase-requests/${pr.id}/approve`;
                const method = isReview ? 'POST' : 'PUT';
                const payload = isReview 
                  ? { review_status: 'rejected', review_comment: 'Rejected from quick actions', expectedStatus: pr.status }
                  : { status: 'Rejected', remarks: 'Rejected from quick actions', expectedStatus: pr.status };
                await addPendingRequest(endpoint, method, payload);
                Alert.alert('Offline Mode', 'Network failed. Rejection saved offline.');
                setRequests(prev => prev.filter(item => item.id !== pr.id));
              } else {
                Alert.alert('Error', error?.response?.data?.message || 'Failed to reject request');
              }
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  }, []);
  
  const renderItem = useCallback(({ item }) => {
    const requesterName = `${item.requester_first_name || ''} ${item.requester_last_name || ''}`.trim() || 'Unknown Requester';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.pr_number || `Request #${item.id}`}</Text>
          <Text style={styles.cardAmount}>â‚±{parseFloat(item.total_amount || 0).toFixed(2)}</Text>
        </View>
        <Text style={styles.requesterText}>Requester: {requesterName}</Text>
        <Text style={styles.cardDescription}>{item.purpose || 'No description provided'}</Text>
        
        <View style={styles.actions}>
        {filter === 'pending' ? (
          processingId === item.id ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFBF00" />
            </View>
          ) : (
            <>
              <TouchableOpacity style={[styles.button, styles.smallBtn, styles.viewBtn]} onPress={() => handleReview(item.id)}>
                <Text style={styles.buttonText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.smallBtn, styles.rejectBtn]} onPress={() => handleQuickReject(item)}>
                <Text style={styles.buttonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.smallBtn, styles.approveBtn]} onPress={() => handleQuickApprove(item)}>
                <Text style={styles.buttonText}>Approve</Text>
              </TouchableOpacity>
            </>
          )
        ) : (
          <TouchableOpacity style={[styles.button, styles.viewBtn]} onPress={() => navigation.navigate('PRDetail', { prId: item.id })}>
            <Text style={styles.buttonText}>View Details</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
  }, [filter, navigation, handleReview, handleQuickApprove, handleQuickReject, processingId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFBF00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, filter === 'pending' && styles.activeTab]} 
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.tabText, filter === 'pending' && styles.activeTabText]}>Pending Reviews</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, filter === 'reviewed' && styles.activeTab]} 
          onPress={() => setFilter('reviewed')}
        >
          <Text style={[styles.tabText, filter === 'reviewed' && styles.activeTabText]}>Reviewed Already</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={<Text style={styles.emptyText}>{filter === 'pending' ? 'No pending approvals right now!' : 'No reviewed requests yet.'}</Text>}
        onEndReached={loadMoreApprovals}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator size="small" color="#FFBF00" />
            </View>
          ) : null
        }
      />
    </View>
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
  listContainer: {
    padding: 15,
  },
  card: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981', // green
  },
  requesterText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 15,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtn: {
    paddingHorizontal: 12,
  },
  approveBtn: {
    backgroundColor: '#FFBF00',
  },
  rejectBtn: {
    backgroundColor: '#1f2937',
  },
  reviewBtn: {
    backgroundColor: '#FFBF00',
  },
  viewBtn: {
    backgroundColor: '#6b7280',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 4,
    margin: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#FFBF00',
  },
  tabText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  activeTabText: {
    color: 'white',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#6b7280',
    fontSize: 16,
  }
});
