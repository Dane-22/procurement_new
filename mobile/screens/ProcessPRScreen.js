import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import api from '../services/api';
import NetInfo from '@react-native-community/netinfo';
import { addPendingRequest } from '../services/offlineSync';

export default function ProcessPRScreen({ route, navigation }) {
  const { prId } = route.params;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pr, setPr] = useState(null);
  
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [paymentBasis, setPaymentBasis] = useState('non_debt');
  const [paymentTermsNote, setPaymentTermsNote] = useState('');
  
  const [items, setItems] = useState([]);
  const [paymentSchedules, setPaymentSchedules] = useState([
    { payment_date: '', amount: '', note: '' }
  ]);

  useEffect(() => {
    fetchData();
  }, [prId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch PR and Suppliers in parallel
      const [prRes, supRes] = await Promise.all([
        api.get(`/purchase-requests/${prId}`),
        api.get('/suppliers')
      ]);

      if (prRes.data && prRes.data.purchaseRequest) {
        const fetchedPr = prRes.data.purchaseRequest;
        setPr(fetchedPr);
        setItems(fetchedPr.items ? fetchedPr.items.map(i => ({ ...i, unit_price: i.unit_price ? String(i.unit_price) : '0' })) : []);
        setSelectedSupplier(fetchedPr.supplier_id || '');
        setPaymentBasis(fetchedPr.payment_basis || 'non_debt');
        setPaymentTermsNote(fetchedPr.payment_terms_note || '');
        if (fetchedPr.payment_schedules && fetchedPr.payment_schedules.length > 0) {
          setPaymentSchedules(fetchedPr.payment_schedules.map(s => ({ ...s, amount: String(s.amount || '') })));
        }
      }

      if (supRes.data && supRes.data.suppliers) {
        setSuppliers(supRes.data.suppliers);
      }
    } catch (error) {
      console.error('Error fetching data for process:', error);
      Alert.alert('Error', 'Failed to load details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If we returned from CreateSupplierScreen with a new supplier ID
    if (route.params?.newSupplierId) {
      // Re-fetch suppliers to get the newly created one
      api.get('/suppliers').then(supRes => {
        if (supRes.data && supRes.data.suppliers) {
          setSuppliers(supRes.data.suppliers);
          setSelectedSupplier(route.params.newSupplierId);
        }
      }).catch(console.error);
    }
  }, [route.params?.newSupplierId]);

  const handleUpdateItemPrice = (index, value) => {
    const newItems = [...items];
    newItems[index].unit_price = value;
    setItems(newItems);
  };

  const handleAddSchedule = () => {
    setPaymentSchedules([...paymentSchedules, { payment_date: '', amount: '', note: '' }]);
  };

  const handleUpdateSchedule = (index, field, value) => {
    const newSchedules = [...paymentSchedules];
    newSchedules[index][field] = value;
    setPaymentSchedules(newSchedules);
  };

  const handleRemoveSchedule = (index) => {
    setPaymentSchedules(paymentSchedules.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedSupplier) {
      Alert.alert('Validation Error', 'Please select a supplier.');
      return;
    }

    for (const item of items) {
      if (!item.unit_price || parseFloat(item.unit_price) <= 0) {
        Alert.alert('Validation Error', 'Please provide valid unit prices for all items (must be > 0).');
        return;
      }
    }

    const payload = {
      supplier_id: selectedSupplier,
      payment_basis: paymentBasis,
      payment_terms_note: paymentTermsNote,
      items: items.map(i => ({
        id: i.id,
        item_id: i.item_id,
        quantity: i.quantity,
        unit_price: parseFloat(i.unit_price)
      }))
    };

    if (paymentBasis === 'debt') {
      const cleaned = paymentSchedules.filter(s => s.payment_date || s.amount || s.note).map(s => ({
        payment_date: s.payment_date,
        amount: s.amount ? parseFloat(s.amount) : null,
        note: s.note
      }));
      if (cleaned.length === 0) {
        Alert.alert('Validation Error', 'Please add at least one payment schedule for debt purchases.');
        return;
      }
      payload.payment_schedules = cleaned;
    }

    try {
      setSubmitting(true);
      const endpoint = `/purchase-requests/${prId}/process`;
      const netInfo = await NetInfo.fetch();
      
      if (!netInfo.isConnected) {
        await addPendingRequest(endpoint, 'PUT', payload);
        Alert.alert('Offline Mode', 'No internet connection. Request processed offline and will sync automatically when online.');
      } else {
        await api.put(endpoint, payload);
        Alert.alert('Success', 'Item Request Processed successfully');
      }
      navigation.navigate('MainTabs', { screen: 'Dashboard' }); // Navigate back
    } catch (error) {
      if (error.message && error.message.includes('Network Error')) {
        await addPendingRequest(`/purchase-requests/${prId}/process`, 'PUT', payload);
        Alert.alert('Offline Mode', 'Network failed. Request processed offline and will sync when online.');
        navigation.navigate('MainTabs', { screen: 'Dashboard' });
      } else {
        Alert.alert('Error', error?.response?.data?.message || 'Failed to process request.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFBF00" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Animated.ScrollView contentContainerStyle={styles.scrollContent} entering={FadeIn}>
        
        {/* Supplier Info */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.card}>
          <Text style={styles.sectionTitle}>SUPPLIER INFO</Text>
          <Text style={styles.label}>Select Supplier</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedSupplier}
              onValueChange={(val) => {
                if (val === 'ADD_NEW') {
                  navigation.navigate('CreateSupplier');
                } else {
                  setSelectedSupplier(val);
                }
              }}
            >
              <Picker.Item label="Select a supplier..." value="" color="#9ca3af" />
              {suppliers.map(sup => (
                <Picker.Item key={sup.id} label={sup.supplier_name} value={sup.id} />
              ))}
              <Picker.Item label="+ Add New Supplier..." value="ADD_NEW" color="#3b82f6" />
            </Picker>
          </View>

          <Text style={styles.label}>Payment Basis</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={paymentBasis}
              onValueChange={(val) => setPaymentBasis(val)}
            >
              <Picker.Item label="Cash / Non-Debt" value="non_debt" />
              <Picker.Item label="Debt / Account" value="debt" />
            </Picker>
          </View>

          {paymentBasis === 'debt' && (
            <>
              <Text style={styles.label}>Payment Terms Note</Text>
              <TextInput
                style={styles.input}
                value={paymentTermsNote}
                onChangeText={setPaymentTermsNote}
                placeholder="e.g. 30 days PDC"
                placeholderTextColor="#9ca3af"
              />
            </>
          )}
        </Animated.View>

        {/* Debt Schedules */}
        {paymentBasis === 'debt' && (
          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>PAYMENT SCHEDULES</Text>
              <TouchableOpacity onPress={handleAddSchedule}>
                <Text style={styles.addText}>+ Add</Text>
              </TouchableOpacity>
            </View>
            
            {paymentSchedules.map((schedule, index) => (
              <View key={index} style={styles.scheduleItem}>
                <View style={styles.rowBetween}>
                  <Text style={styles.scheduleIndex}>Schedule #{index + 1}</Text>
                  {paymentSchedules.length > 1 && (
                    <TouchableOpacity onPress={() => handleRemoveSchedule(index)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                <TextInput
                  style={styles.input}
                  placeholder="Date (YYYY-MM-DD)"
                  value={schedule.payment_date}
                  onChangeText={(val) => handleUpdateSchedule(index, 'payment_date', val)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Amount (₱)"
                  keyboardType="numeric"
                  value={schedule.amount}
                  onChangeText={(val) => handleUpdateSchedule(index, 'amount', val)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Note (optional)"
                  value={schedule.note}
                  onChangeText={(val) => handleUpdateSchedule(index, 'note', val)}
                />
              </View>
            ))}
          </Animated.View>
        )}

        {/* Items Pricing */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.card}>
          <Text style={styles.sectionTitle}>ITEM PRICING</Text>
          {items.map((item, index) => (
            <View key={item.id || index} style={styles.itemBox}>
              <Text style={styles.itemName}>{item.item_name}</Text>
              <Text style={styles.itemQty}>Qty: {item.quantity} {item.unit}</Text>
              <Text style={styles.label}>Unit Price (₱)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="numeric"
                value={item.unit_price}
                onChangeText={(val) => handleUpdateItemPrice(index, val)}
              />
            </View>
          ))}
        </Animated.View>

        <View style={styles.bottomPadding} />
      </Animated.ScrollView>

      {/* Action Bar */}
      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.bottomActionBar}>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.submitBtn]} 
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
             <ActivityIndicator color="white" />
          ) : (
             <Text style={styles.actionBtnText}>Process & Submit</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
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
    marginBottom: 15,
    letterSpacing: 1,
  },
  label: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 10,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    marginBottom: 10,
    overflow: 'hidden',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    padding: 12,
    fontSize: 15,
    color: '#1f2937',
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 14,
  },
  scheduleItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#fafafa',
  },
  scheduleIndex: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
  },
  removeText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  itemBox: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 15,
    marginBottom: 15,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  itemQty: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 10,
  },
  bottomPadding: {
    height: 80,
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
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
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
  },
  actionBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
