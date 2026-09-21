import React, { useState, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ScrollView, Modal, FlatList, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { BASE_URL } from '../services/api';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import NotificationBell from '../components/NotificationBell';

export default function CreateRequestScreen({ route, navigation }) {
  const { editMode, requestData } = route.params || {};

  const [purpose, setPurpose] = useState('');
  const [remarks, setRemarks] = useState('');
  const [project, setProject] = useState('');
  const [dateNeeded, setDateNeeded] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentBasis, setPaymentBasis] = useState('debt');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);

  // Modals state
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // Search Items state
  const [availableItems, setAvailableItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);

  // Create Item state
  const [newItemName, setNewItemName] = useState('');
  const [newItemImage, setNewItemImage] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    fetchCategories();
    fetchProjects();

    if (editMode && requestData) {
      setPurpose(requestData.purpose || '');
      setRemarks(requestData.remarks || '');
      setProject(requestData.project || '');
      if (requestData.date_needed) {
        setDateNeeded(new Date(requestData.date_needed).toISOString().split('T')[0]);
      }
      setPaymentBasis(requestData.payment_basis || 'debt');
      
      // Items might come as an array of objects from the backend
      if (requestData.items && Array.isArray(requestData.items)) {
        setItems(requestData.items.map(i => ({
          item_id: i.item_id || i.id,
          item_name: i.item_name,
          quantity: String(i.quantity),
          unit_price: String(i.unit_price || 0)
        })));
      }
    }
  }, [editMode, requestData]);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      let data = Array.isArray(res.data) ? res.data : [];
      data = data.filter(p => p.is_active || (editMode && requestData?.project === p.branch_name));
      setProjects(data);
    } catch (e) {
      console.error('Error fetching projects:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      const cats = res.data.categories || [];
      setCategories(cats);
      if (cats.length > 0) {
        setSelectedCategory(cats[0].id.toString());
      }
    } catch (e) {
      console.error('Error fetching categories:', e);
    }
  };

  const fetchAvailableItems = async () => {
    setLoadingItems(true);
    try {
      const res = await api.get('/items');
      setAvailableItems(res.data.items || []);
    } catch (e) {
      console.error('Error fetching items:', e);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleOpenSearch = () => {
    fetchAvailableItems();
    setSearchModalVisible(true);
  };

  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      // Need to adjust for timezone offset
      const offset = selectedDate.getTimezoneOffset();
      selectedDate = new Date(selectedDate.getTime() - (offset*60*1000));
      setDateNeeded(selectedDate.toISOString().split('T')[0]);
    }
  };

  const handleSelectItem = (item) => {
    setItems([...items, { item_id: item.id, item_name: item.item_name, quantity: '1', unit_price: '0' }]);
    setSearchModalVisible(false);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewItemImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (imageUri) => {
    try {
      const formData = new FormData();
      const filename = imageUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      formData.append('image', { uri: imageUri, name: filename, type });

      // Using fetch directly because axios with form-data in React Native can be tricky
      const response = await fetch(`${BASE_URL}/uploads`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();
      if (data.success) {
        return data.imageUrl;
      }
      throw new Error(data.message || 'Upload failed');
    } catch (e) {
      console.error('Upload Error:', e);
      return null;
    }
  };

  const handleCreateItem = async () => {
    if (!newItemName || !selectedCategory) {
      Alert.alert('Validation', 'Please provide item name and category.');
      return;
    }
    
    try {
      let imageUrl = null;
      if (newItemImage) {
        imageUrl = await uploadImage(newItemImage.uri);
      }

      const res = await api.post('/items', {
        item_name: newItemName,
        description: '',
        category_id: selectedCategory,
        image_url: imageUrl,
        unit: 'pcs',
      });
      
      const newItem = res.data;
      setItems([...items, { 
        item_id: newItem.itemId || newItem.id, 
        item_name: newItemName, // We know the name, use the one we just passed
        quantity: '1', 
        unit_price: '0' 
      }]);
      setCreateModalVisible(false);
      setSearchModalVisible(false);
      setNewItemName('');
      setNewItemImage(null);
    } catch (e) {
      console.error('Failed to create item error details:', e.response?.data || e.message);
      Alert.alert('Error', 'Failed to create item');
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!purpose) {
      Alert.alert('Validation', 'Please provide a purpose.');
      return;
    }
    if (!project) {
      Alert.alert('Validation', 'Please select a project/site.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Validation', 'Please add at least one item.');
      return;
    }

    const calculatedTotal = items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)), 0);

    const payload = {
      purpose,
      remarks,
      project,
      date_needed: dateNeeded,
      payment_basis: paymentBasis,
      total_amount: calculatedTotal,
      is_item_request: true,
      items: items.map(i => ({
        item_id: i.item_id,
        quantity: parseFloat(i.quantity),
        unit_price: parseFloat(i.unit_price) || 0
      }))
    };

    setLoading(true);
    try {
      const netInfo = await require('@react-native-community/netinfo').default.fetch();
      if (!netInfo.isConnected) {
        // Save offline
        const { addPendingRequest } = require('../services/offlineSync');
        if (editMode && requestData?.id) {
           await addPendingRequest(`/purchase-requests/${requestData.id}`, 'PUT', payload);
           Alert.alert('Offline Mode', 'No internet connection. Request update saved offline and will sync automatically when online.');
        } else {
           await addPendingRequest('/purchase-requests', 'POST', payload);
           Alert.alert('Offline Mode', 'No internet connection. Request saved offline and will sync automatically when online.');
        }
      } else {
        if (editMode && requestData?.id) {
          const endpoint = requestData.status === 'Rejected' 
            ? `/purchase-requests/${requestData.id}/resubmit` 
            : `/purchase-requests/${requestData.id}/draft`;
          await api.put(endpoint, payload);
          Alert.alert('Success', 'Request updated successfully!');
        } else {
          await api.post('/purchase-requests', payload);
          Alert.alert('Success', 'Request created successfully!');
        }
      }
      
      setPurpose('');
      setRemarks('');
      setProject('');
      setDateNeeded(new Date().toISOString().split('T')[0]);
      setItems([]);
      
      if (editMode) {
        navigation.goBack();
      } else {
        navigation.navigate('MainTabs', { screen: 'Dashboard' });
      }
    } catch (error) {
      console.error('Error creating request:', error);
      // Fallback: If network request failed unexpectedly, we could save it too
      if (error.message.includes('Network Error')) {
        const { addPendingRequest } = require('../services/offlineSync');
        if (editMode && requestData?.id) {
           const endpoint = requestData.status === 'Rejected' 
             ? `/purchase-requests/${requestData.id}/resubmit` 
             : `/purchase-requests/${requestData.id}/draft`;
           await addPendingRequest(endpoint, 'PUT', payload);
           Alert.alert('Offline Mode', 'Network failed during update. It was saved offline and will sync when online.');
        } else {
           await addPendingRequest('/purchase-requests', 'POST', payload);
           Alert.alert('Offline Mode', 'Network failed during request. It was saved offline and will sync when online.');
        }
        if (editMode) {
          navigation.goBack();
        } else {
          navigation.navigate('MainTabs', { screen: 'Dashboard' });
        }
      } else {
        const errorMsg = error.response?.data?.message || 'Could not create the request.';
        console.error('BACKEND ERROR:', error.response?.data);
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = availableItems.filter(i => 
    i.item_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFBF00' }} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.ScrollView entering={FadeIn} style={styles.container} contentContainerStyle={{ paddingBottom: 120 }} bounces={false}>
          <View style={[styles.headerGradient, { backgroundColor: '#FFBF00' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={styles.title}>{editMode ? 'Edit Request' : 'New Request'}</Text>
                <Text style={styles.subtitle}>{editMode ? 'Update your request details' : 'Submit items for procurement processing'}</Text>
              </View>
              <View style={{ marginRight: 56, marginTop: 5 }}>
                <NotificationBell color="#1E293B" />
              </View>
            </View>
          </View>
      
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.formSection}>
        <View style={styles.card}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Site / Project Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {projects.map(p => (
                <TouchableOpacity 
                  key={p.id} 
                  style={[styles.catOption, project === p.branch_name && styles.catOptionSelected]}
                  onPress={() => setProject(p.branch_name)}
                >
                  <Text style={[styles.catOptionText, project === p.branch_name && styles.catOptionTextSelected]}>
                    {p.branch_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Purpose <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Why are you requesting these items?"
                placeholderTextColor="#94a3b8"
                value={purpose}
                onChangeText={setPurpose}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Date Needed <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
              <View style={styles.inputContainer}>
                <MaterialIcons name="calendar-today" size={20} color="#94a3b8" style={styles.inputIcon} />
                <Text style={[styles.input, { textAlignVertical: 'center', paddingTop: 12, color: dateNeeded ? '#0f172a' : '#94a3b8' }]}>
                  {dateNeeded || "YYYY-MM-DD"}
                </Text>
              </View>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(dateNeeded || new Date())}
                mode="date"
                display="default"
                onValueChange={(event, selectedDate) => onChangeDate(event, selectedDate)}
                onDismiss={() => setShowDatePicker(false)}
              />
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Payment Basis <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 25, padding: 4 }}>
              <TouchableOpacity 
                style={[styles.pillOption, paymentBasis === 'debt' && styles.pillOptionActive]}
                onPress={() => setPaymentBasis('debt')}
              >
                <Text style={[styles.pillOptionText, paymentBasis === 'debt' && styles.pillOptionTextActive]}>Debt / Account</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.pillOption, paymentBasis === 'non_debt' && styles.pillOptionActive]}
                onPress={() => setPaymentBasis('non_debt')}
              >
                <Text style={[styles.pillOptionText, paymentBasis === 'non_debt' && styles.pillOptionTextActive]}>Cash / Non-Debt</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Remarks (Optional)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Any additional notes"
                placeholderTextColor="#94a3b8"
                value={remarks}
                onChangeText={setRemarks}
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Requested Items</Text>
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenSearch}>
            <MaterialIcons name="add" size={20} color="#d97706" />
            <Text style={styles.addBtnText}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="inventory" size={48} color="#cbd5e1" />
            <Text style={styles.emptyStateText}>No items added yet.</Text>
          </View>
        ) : (
          items.map((item, index) => (
            <Animated.View entering={SlideInUp.delay(index * 50).springify()} key={index} style={styles.itemCard}>
              <View style={styles.itemIconContainer}>
                <MaterialIcons name="category" size={20} color="#64748b" />
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.item_name}</Text>
                <View style={styles.qtyContainer}>
                  <TouchableOpacity 
                    onPress={() => updateItem(index, 'quantity', String(Math.max(1, (parseInt(item.quantity) || 1) - 1)))}
                    style={styles.qtyBtn}
                  >
                    <MaterialIcons name="remove" size={16} color="#d97706" />
                  </TouchableOpacity>
                  
                  <TextInput
                    style={styles.qtyInput}
                    value={String(item.quantity)}
                    onChangeText={(v) => updateItem(index, 'quantity', v)}
                    keyboardType="numeric"
                  />

                  <TouchableOpacity 
                    onPress={() => updateItem(index, 'quantity', String((parseInt(item.quantity) || 0) + 1))}
                    style={styles.qtyBtn}
                  >
                    <MaterialIcons name="add" size={16} color="#d97706" />
                  </TouchableOpacity>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                  <Text style={styles.qtyLabel}>Price (₱):</Text>
                  <TextInput
                    style={[styles.qtyInput, { width: 80, marginHorizontal: 0 }]}
                    value={String(item.unit_price || '')}
                    onChangeText={(v) => updateItem(index, 'unit_price', v)}
                    keyboardType="numeric"
                    placeholder="0.00"
                  />
                  <Text style={{ fontSize: 13, color: '#64748b', marginLeft: 12, fontWeight: '600' }}>
                    Total: ₱{((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeBtn}>
                <MaterialIcons name="delete-outline" size={24} color="#ef4444" />
              </TouchableOpacity>
            </Animated.View>
          ))
        )}

        {items.length > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount (₱):</Text>
            <Text style={[styles.totalInput, { fontSize: 24 }]}>
              {items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)), 0).toFixed(2)}
            </Text>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? (editMode ? 'Updating...' : 'Submitting...') : (editMode ? 'Update Request' : 'Submit Request')}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Item Search Modal */}
      <Modal visible={searchModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.bottomSheet, { height: '90%' }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>Select Item</Text>
              <TouchableOpacity onPress={() => setSearchModalVisible(false)} style={styles.iconButton}>
                 <MaterialIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={20} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search inventory..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            
            <TouchableOpacity style={styles.createItemBtn} onPress={() => setCreateModalVisible(true)}>
              <MaterialIcons name="add-circle-outline" size={24} color="#d97706" />
              <Text style={styles.createItemBtnText}>Create New Item</Text>
            </TouchableOpacity>

            {loadingItems ? (
               <ActivityIndicator size="large" color="#FFBF00" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={filteredItems}
                keyExtractor={i => i.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.itemSelectRow} onPress={() => handleSelectItem(item)}>
                    <View>
                      <Text style={styles.itemSelectName}>{item.item_name}</Text>
                      <Text style={styles.itemSelectCode}>{item.category_name || 'Uncategorized'}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Create Item Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>Create New Item</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.iconButton}>
                <MaterialIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Item Name</Text>
              <View style={styles.inputContainer}>
                <MaterialIcons name="label-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  value={newItemName} 
                  onChangeText={setNewItemName}
                  placeholder="E.g. Steel Rebar"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Product Image</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {newItemImage ? (
                  <Image source={{ uri: newItemImage.uri }} style={{ width: 80, height: 80, borderRadius: 12, marginRight: 16 }} />
                ) : (
                  <View style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                    <MaterialIcons name="image" size={32} color="#cbd5e1" />
                  </View>
                )}
                <TouchableOpacity style={styles.addBtn} onPress={pickImage}>
                  <MaterialIcons name="add-a-photo" size={20} color="#d97706" />
                  <Text style={styles.addBtnText}>{newItemImage ? 'Change Image' : 'Select Image'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <ScrollView style={styles.categoryScroll} horizontal showsHorizontalScrollIndicator={false}>
                {categories.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    style={[styles.catOption, selectedCategory === c.id.toString() && styles.catOptionSelected]}
                    onPress={() => setSelectedCategory(c.id.toString())}
                  >
                    <Text style={[styles.catOptionText, selectedCategory === c.id.toString() && styles.catOptionTextSelected]}>
                      {c.category_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateItem}>
              <Text style={styles.primaryButtonText}>Create Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerGradient: { padding: 24, paddingTop: 20, paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  title: { fontSize: 32, fontWeight: '800', color: '#1E293B', letterSpacing: 0.5 },
  subtitle: { fontSize: 16, color: '#334155', marginTop: 8, fontWeight: '600' },
  
  formSection: { padding: 24, marginTop: -20 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5, marginBottom: 24 },
  
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, color: '#64748b', marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16 },
  inputContainerFocus: { borderColor: '#FFBF00', backgroundColor: '#ffffff' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#0f172a' },
  textArea: { height: 100, textAlignVertical: 'top' },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#d97706', fontWeight: '700', marginLeft: 4, fontSize: 14 },
  
  itemCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  itemIconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  qtyContainer: { flexDirection: 'row', alignItems: 'center' },
  qtyLabel: { fontSize: 13, color: '#64748b', marginRight: 8, fontWeight: '500' },
  qtyBtn: { backgroundColor: '#fef3c7', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  qtyInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, color: '#0f172a', width: 50, textAlign: 'center', fontWeight: '600', marginHorizontal: 8 },
  removeBtn: { padding: 10 },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyStateText: { color: '#94a3b8', fontSize: 16, marginTop: 12, fontWeight: '500' },
  
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginTop: 4, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  totalInput: { fontSize: 20, fontWeight: '800', color: '#10b981', textAlign: 'right', minWidth: 100, padding: 0 },
  
  submitButton: { backgroundColor: '#FFBF00', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#FFBF00', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, marginTop: 10, marginBottom: 40 },
  submitButtonDisabled: { backgroundColor: '#94a3b8', shadowOpacity: 0 },
  submitButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 18, letterSpacing: 0.5 },
  
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, minHeight: '60%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  iconButton: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 20 },
  
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 16, paddingHorizontal: 16, marginBottom: 20 },
  searchInput: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#0f172a', marginLeft: 12 },
  
  createItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', marginBottom: 20 },
  createItemBtnText: { color: '#d97706', fontWeight: '700', fontSize: 16, marginLeft: 8 },
  
  itemSelectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemSelectName: { fontWeight: '700', fontSize: 16, color: '#1e293b' },
  itemSelectCode: { color: '#94a3b8', fontSize: 13, marginTop: 4, fontWeight: '500' },
  
  categoryScroll: { flexDirection: 'row', paddingBottom: 10 },
  catOption: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 12, borderWidth: 1, borderColor: 'transparent' },
  catOptionSelected: { backgroundColor: '#fef3c7', borderColor: '#FFBF00' },
  catOptionText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  catOptionTextSelected: { color: '#d97706', fontWeight: '700' },
  
  pillOption: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 20 },
  pillOptionActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  pillOptionText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  pillOptionTextActive: { color: '#1E293B', fontWeight: '700' },
  
  primaryButton: { backgroundColor: '#FFBF00', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 16 }
});
