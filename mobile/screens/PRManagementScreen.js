import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString();
};

const STATUS_MAPPING = {
  'PENDING': ['For Admin Processing', 'Draft'],
  'FOR APPROVAL': ['For Engineer Review', 'For Admin Review', 'For Super Admin Rep Review', 'For Super Admin Final Approval'],
  'APPROVED': ['APPROVED'],
  'REJECTED': ['REJECTED', 'Cancelled']
};

export default function PRManagementScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ total: 0, statusCounts: {} });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [statusFilter, setStatusFilter] = useState(''); // Empty means all
  const socket = useSocket();

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchRequests(1, true);
  }, [statusFilter]);

  useEffect(() => {
    fetchCounts();
  }, []);

  const fetchCounts = async () => {
    try {
      const response = await api.get('/purchase-requests/counts');
      const statusCounts = {};
      response.data.counts.forEach(c => {
        statusCounts[c.status] = c.count;
      });
      setCounts({ total: response.data.total, statusCounts });
    } catch (error) {
      console.error('Error fetching PR counts:', error);
    }
  };

  useEffect(() => {
    if (socket) {
      const handleUpdate = () => {
        // Reset to page 1 and refetch
        setPage(1);
        setHasMore(true);
        fetchRequests(1, true);
        fetchCounts();
      };

      socket.on('pr_updated', handleUpdate);
      socket.on('new_pr', handleUpdate);

      return () => {
        socket.off('pr_updated', handleUpdate);
        socket.off('new_pr', handleUpdate);
      };
    }
  }, [socket, statusFilter]);

  const fetchRequests = async (pageNum = page, reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let url = `/purchase-requests?pageSize=10&page=${pageNum}`;
      if (statusFilter) {
        const mappedStatuses = STATUS_MAPPING[statusFilter] || [statusFilter];
        url += `&status=${mappedStatuses.join(',')}`;
      }
      
      const response = await api.get(url);
      const fetchedRequests = response.data.purchaseRequests || [];
      
      if (reset) {
        setRequests(fetchedRequests);
      } else {
        setRequests(prev => [...prev, ...fetchedRequests]);
      }

      if (fetchedRequests.length < 10) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching PRs:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreRequests = () => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchRequests(nextPage);
    }
  };

  const getStatusCount = (statusTab) => {
    if (!statusTab) return counts.total;
    const mappedStatuses = STATUS_MAPPING[statusTab] || [statusTab];
    return mappedStatuses.reduce((sum, s) => sum + (counts.statusCounts[s] || 0), 0);
  };

  const getStatusStyle = (status) => {
    const s = status || '';
    if (STATUS_MAPPING['PENDING'].includes(s)) {
      return { bg: '#ffedd5', text: '#ea580c', border: '#f97316' }; // Soft Orange
    } else if (STATUS_MAPPING['FOR APPROVAL'].includes(s)) {
      return { bg: '#dbeafe', text: '#1d4ed8', border: '#3b82f6' }; // Soft Blue
    } else if (STATUS_MAPPING['APPROVED'].includes(s)) {
      return { bg: '#dcfce7', text: '#15803d', border: '#22c55e' }; // Soft Green
    } else if (STATUS_MAPPING['REJECTED'].includes(s)) {
      return { bg: '#fee2e2', text: '#b91c1c', border: '#ef4444' }; // Soft Red
    }
    return { bg: '#f3f4f6', text: '#4b5563', border: '#9ca3af' }; // Soft Gray
  };

  const renderItem = useCallback(({ item }) => {
    const statusStyle = getStatusStyle(item.status);
    return (
      <TouchableOpacity 
        style={[styles.card, { borderLeftColor: statusStyle.border, borderLeftWidth: 4 }]}
        onPress={() => navigation.navigate('PRDetail', { prId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.pr_number || `PR #${item.id}`}</Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.cardDescription}>{item.purpose || 'No purpose provided'}</Text>
        
        <View style={styles.cardFooter}>
          <View style={styles.row}>
            <MaterialIcons name="person" size={14} color="#9ca3af" style={{ marginRight: 4 }} />
            <View>
              <Text style={styles.requesterText}>{item.first_name} {item.last_name}</Text>
              <Text style={styles.timeText}>{timeAgo(item.created_at || Date.now())}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <MaterialIcons name="payments" size={16} color="#4b5563" style={{ marginRight: 4 }} />
            <Text style={styles.cardAmount}>₱{parseFloat(item.total_amount).toFixed(2)}</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.cardEditBtn}
          onPress={() => navigation.navigate('EditRequest', { editMode: true, requestData: item })}
        >
          <MaterialIcons name="edit" size={16} color="#3b82f6" style={{ marginRight: 4 }} />
          <Text style={styles.cardEditText}>Edit Request</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['', 'PENDING', 'FOR APPROVAL', 'APPROVED', 'REJECTED'].map((status) => {
            const count = getStatusCount(status);
            return (
              <TouchableOpacity 
                key={status}
                style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
                onPress={() => setStatusFilter(status)}
              >
                <Text style={[styles.filterText, statusFilter === status && styles.filterTextActive]}>
                  {status || 'ALL'} {count > 0 && `(${count})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFBF00" />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          ListEmptyComponent={<Text style={styles.emptyText}>No requests found</Text>}
          onEndReached={loadMoreRequests}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color="#FFBF00" />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  filters: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#FFBF00',
    borderColor: '#FFBF00',
  },
  filterText: {
    color: '#64748b',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#ffffff',
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
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardDescription: {
    color: '#6b7280',
    marginBottom: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requesterText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  timeText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#6b7280',
    fontSize: 16,
  },
  cardEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardEditText: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 14,
  }
});
