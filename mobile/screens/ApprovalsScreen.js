import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

export default function ApprovalsScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [filter, setFilter] = useState('pending'); // 'pending' or 'reviewed'
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const socket = useSocket();

  useEffect(() => {
    if (isFocused) {
      fetchUserAndRequests();
    }
  }, [isFocused, filter]);

  useEffect(() => {
    if (socket) {
      const handleUpdate = () => {
        fetchUserAndRequests();
      };

      socket.on('pr_updated', handleUpdate);
      socket.on('new_pr', handleUpdate);

      return () => {
        socket.off('pr_updated', handleUpdate);
        socket.off('new_pr', handleUpdate);
      };
    }
  }, [socket, filter]);

  const fetchUserAndRequests = async () => {
    setLoading(true);
    try {
      const userStr = await SecureStore.getItemAsync('user');
      let role = null;
      if (userStr) {
        const user = JSON.parse(userStr);
        role = user.role;
        setUserRole(role);
      }
      
      const response = await api.get(`/purchase-requests?my_reviews=${filter}`); 
      const allPrs = response.data.purchaseRequests || [];
      
      setRequests(allPrs);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = useCallback((id) => {
    navigation.navigate('PRReview', { prId: id });
  }, [navigation]);
  
  const renderItem = useCallback(({ item }) => {
    const requesterName = `${item.requester_first_name || ''} ${item.requester_last_name || ''}`.trim() || 'Unknown Requester';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.pr_number || `Request #${item.id}`}</Text>
          <Text style={styles.cardAmount}>₱{parseFloat(item.total_amount || 0).toFixed(2)}</Text>
        </View>
        <Text style={styles.requesterText}>Requester: {requesterName}</Text>
        <Text style={styles.cardDescription}>{item.purpose || 'No description provided'}</Text>
        
        <View style={styles.actions}>
        {filter === 'pending' ? (
          <TouchableOpacity style={[styles.button, styles.reviewBtn]} onPress={() => handleReview(item.id)}>
            <Text style={styles.buttonText}>Review Request</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, styles.viewBtn]} onPress={() => navigation.navigate('PRDetail', { prId: item.id })}>
            <Text style={styles.buttonText}>View Details</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
  }, [filter, navigation, handleReview]);

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
    gap: 10,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginLeft: 10, // simple gap fallback
  },
  reviewBtn: {
    backgroundColor: '#FFBF00',
  },
  viewBtn: {
    backgroundColor: '#1f2937',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
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
