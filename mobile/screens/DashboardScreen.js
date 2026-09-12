import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myRecentRequests, setMyRecentRequests] = useState([]);
  const [companyRecentRequests, setCompanyRecentRequests] = useState([]);
  const socket = useSocket();

  useEffect(() => {
    loadUserAndStats();
  }, []);

  useEffect(() => {
    if (socket) {
      const handleUpdate = () => {
        // Fetch new data when a PR is updated or created
        if (user) {
          fetchDashboardStats(user);
        } else {
          loadUserAndStats();
        }
      };

      socket.on('pr_updated', handleUpdate);
      socket.on('new_pr', handleUpdate);

      return () => {
        socket.off('pr_updated', handleUpdate);
        socket.off('new_pr', handleUpdate);
      };
    }
  }, [socket, user]);

  const loadUserAndStats = async () => {
    try {
      const userStr = await SecureStore.getItemAsync('user');
      let currentUser = null;
      if (userStr) {
        currentUser = JSON.parse(userStr);
        setUser(currentUser);
      }
      await fetchDashboardStats(currentUser);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDashboardStats = async (currentUser) => {
    try {
      const response = await api.get('/purchase-requests?page=1&pageSize=50');
      const prs = response.data.purchaseRequests || [];
      const total = response.data.total || prs.length;
      
      const pendingAdmin = prs.filter(pr => pr.status === 'Pending Admin Processing' || pr.status === 'Under Admin Review').length;
      const pendingFinal = prs.filter(pr => pr.status === 'Pending Final Approval').length;
      const approved = prs.filter(pr => pr.status === 'Approved').length;
      const rejected = prs.filter(pr => pr.status === 'Rejected').length;
      
      // Sort by created_at descending (assuming id is incremental if created_at is missing)
      const sortedPrs = [...prs].sort((a, b) => (b.id - a.id));
      
      const myReqs = sortedPrs.filter(pr => pr.user_id === currentUser?.id).slice(0, 3);
      const companyReqs = sortedPrs.filter(pr => pr.user_id !== currentUser?.id).slice(0, 3);

      setMyRecentRequests(myReqs);
      setCompanyRecentRequests(companyReqs);

      setStats({
        totalRequests: total,
        pendingAdmin,
        pendingFinal,
        approved,
        rejected
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardStats();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFBF00" />
      </View>
    );
  }

  const role = user?.role || 'Unknown';
  const isEngineer = role === 'Engineer';
  const isAdmin = role === 'Admin';
  const isSuperAdmin = role === 'Super Admin' || role === 'Super Admin Rep';

  const getStatusStyle = (status) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': 
      case 'PENDING ADMIN PROCESSING':
      case 'UNDER ADMIN REVIEW':
      case 'PENDING FINAL APPROVAL':
        return { bg: '#ffedd5', border: '#f97316', dot: '#ea580c' }; // Soft Orange
      case 'APPROVED': 
        return { bg: '#dcfce7', border: '#22c55e', dot: '#15803d' }; // Soft Green
      case 'REJECTED': 
        return { bg: '#fee2e2', border: '#ef4444', dot: '#b91c1c' }; // Soft Red
      default: 
        return { bg: '#f3f4f6', border: '#9ca3af', dot: '#4b5563' }; // Soft Gray
    }
  };

  const renderTimelineItem = (item, index, array) => {
    const isLast = index === array.length - 1;
    const sStyle = getStatusStyle(item.status);
    
    return (
      <View key={item.id} style={styles.timelineRow}>
        <View style={styles.timelineLineContainer}>
          <View style={[styles.timelineDot, { backgroundColor: sStyle.dot }]} />
          {!isLast && <View style={styles.timelineLine} />}
        </View>
        <View style={[styles.timelineContent, { borderLeftColor: sStyle.border }]}>
          <View style={styles.timelineHeader}>
            <Text style={styles.timelineTitle}>{item.pr_number || `PR #${item.id}`}</Text>
            <View style={[styles.timelineBadge, { backgroundColor: sStyle.bg }]}>
              <Text style={[styles.timelineBadgeText, { color: sStyle.dot }]}>{item.status}</Text>
            </View>
          </View>
          <Text style={styles.timelineDesc} numberOfLines={1}>{item.purpose || 'No purpose provided'}</Text>
          <View style={styles.timelineFooter}>
             <Text style={styles.timelineDate}>{new Date(item.created_at || Date.now()).toLocaleDateString()}</Text>
             {item.first_name && <Text style={styles.timelineUser}>By: {item.first_name} {item.last_name}</Text>}
          </View>
          
          <TouchableOpacity 
            style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', padding: 6, borderRadius: 6, alignSelf: 'flex-start' }}
            onPress={() => navigation.navigate('EditRequest', { editMode: true, requestData: item })}
          >
            <MaterialIcons name="edit" size={14} color="#3b82f6" style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 12, color: '#3b82f6', fontWeight: '500' }}>Edit Request</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView 
        style={styles.container} 
      bounces={true}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerGradient}>
        <Text style={styles.welcomeText}>Hello, {user?.firstname || 'User'}</Text>
        <Text style={styles.roleText}>{role}</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Overview</Text>
        
        {/* Role-Specific Stats */}
        <View style={styles.statsGrid}>
          {isEngineer && (
            <>
              <View style={[styles.statCard, { borderLeftColor: '#f59e0b', borderLeftWidth: 4 }]}>
                <Text style={styles.statValue}>{stats?.pendingAdmin || 0}</Text>
                <Text style={styles.statLabel}>My Pending</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#10b981', borderLeftWidth: 4 }]}>
                <Text style={styles.statValue}>{stats?.approved || 0}</Text>
                <Text style={styles.statLabel}>Approved</Text>
              </View>
            </>
          )}

          {isAdmin && (
            <>
              <View style={[styles.statCard, { borderLeftColor: '#3b82f6', borderLeftWidth: 4 }]}>
                <Text style={styles.statValue}>{stats?.pendingAdmin || 0}</Text>
                <Text style={styles.statLabel}>Needs Processing</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#8b5cf6', borderLeftWidth: 4 }]}>
                <Text style={styles.statValue}>{stats?.pendingFinal || 0}</Text>
                <Text style={styles.statLabel}>Waiting Final</Text>
              </View>
            </>
          )}

          {isSuperAdmin && (
            <>
              <View style={[styles.statCard, { borderLeftColor: '#ef4444', borderLeftWidth: 4 }]}>
                <Text style={styles.statValue}>{stats?.pendingFinal || 0}</Text>
                <Text style={styles.statLabel}>Needs Final Approval</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#6366f1', borderLeftWidth: 4 }]}>
                <Text style={styles.statValue}>{stats?.totalRequests || 0}</Text>
                <Text style={styles.statLabel}>Total Requests</Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {isEngineer && (
            <TouchableOpacity 
              style={styles.actionCard} 
              onPress={() => navigation.navigate('New Request')}
            >
              <View style={[styles.iconWrapper, { backgroundColor: '#fef3c7' }]}>
                <MaterialIcons name="add-shopping-cart" size={24} color="#d97706" />
              </View>
              <Text style={styles.actionText}>New Request</Text>
            </TouchableOpacity>
          )}

          {(isAdmin || isSuperAdmin) && (
            <TouchableOpacity 
              style={styles.actionCard} 
              onPress={() => navigation.navigate('Requests')}
            >
              <View style={[styles.iconWrapper, { backgroundColor: '#fef3c7' }]}>
                <MaterialIcons name="fact-check" size={24} color="#d97706" />
              </View>
              <Text style={styles.actionText}>Review Requests</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.actionCard} 
            onPress={() => navigation.navigate('Requests')}
          >
            <View style={[styles.iconWrapper, { backgroundColor: '#f1f5f9' }]}>
              <MaterialIcons name="list-alt" size={24} color="#475569" />
            </View>
            <Text style={styles.actionText}>All Requests</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My Recent Updates</Text>
        </View>
        <View style={styles.cardTimeline}>
          {myRecentRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="hourglass-empty" size={40} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>You have no recent requests.</Text>
              <TouchableOpacity 
                style={styles.ctaButton} 
                onPress={() => navigation.navigate('New Request')}
              >
                <Text style={styles.ctaButtonText}>Create First Request</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {myRecentRequests.map((req, index) => renderTimelineItem(req, index, myRecentRequests))}
              <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('Requests')}>
                <Text style={styles.viewAllText}>View All My Requests</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#d97706" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {(isAdmin || isSuperAdmin) && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Company Updates</Text>
            </View>
            <View style={styles.cardTimeline}>
              {companyRecentRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="notifications-none" size={40} color="#cbd5e1" />
                  <Text style={styles.emptyStateText}>No recent company requests.</Text>
                </View>
              ) : (
                <>
                  {companyRecentRequests.map((req, index) => renderTimelineItem(req, index, companyRecentRequests))}
                  <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('Requests')}>
                    <Text style={styles.viewAllText}>View All Company Requests</Text>
                    <MaterialIcons name="arrow-forward" size={16} color="#d97706" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}

      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFBF00' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerGradient: { backgroundColor: '#FFBF00', padding: 24, paddingTop: 20, paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  welcomeText: { fontSize: 28, fontWeight: '800', color: '#1E293B', letterSpacing: 0.5 },
  roleText: { fontSize: 16, color: '#334155', marginTop: 4, fontWeight: '700', textTransform: 'uppercase' },
  
  content: { padding: 24, marginTop: -20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16, marginTop: 8 },
  
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  statCard: { backgroundColor: 'white', padding: 20, borderRadius: 20, width: '47%', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  statValue: { fontSize: 32, fontWeight: '800', color: '#1e293b' },
  statLabel: { fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: '600' },
  
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  actionCard: { backgroundColor: 'white', padding: 16, borderRadius: 20, width: '48%', alignItems: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, marginBottom: 16 },
  iconWrapper: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#334155', textAlign: 'center' },
  
  card: { backgroundColor: 'white', borderRadius: 16, padding: 24, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3, marginBottom: 24 },
  cardTimeline: { backgroundColor: 'white', borderRadius: 20, padding: 20, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, marginBottom: 30 },
  emptyState: { alignItems: 'center', paddingVertical: 20 },
  emptyStateText: { color: '#94a3b8', fontSize: 14, marginTop: 12, fontWeight: '500' },
  ctaButton: { marginTop: 16, backgroundColor: '#1E293B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  ctaButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  
  timelineRow: { flexDirection: 'row', minHeight: 80 },
  timelineLineContainer: { width: 30, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 8, zIndex: 1 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#f1f5f9', position: 'absolute', top: 20, bottom: -10, zIndex: 0 },
  timelineContent: { flex: 1, backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 16, borderLeftWidth: 4, marginLeft: 8 },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  timelineBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  timelineBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  timelineDesc: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  timelineFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  timelineDate: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  timelineUser: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  viewAllText: { color: '#d97706', fontWeight: '600', fontSize: 14, marginRight: 4 }
});
