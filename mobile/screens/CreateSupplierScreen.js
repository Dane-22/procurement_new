import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import api from '../services/api';

export default function CreateSupplierScreen({ navigation }) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    performance_notes: ''
  });

  const handleUpdateField = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Supplier Name is required.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post('/suppliers', formData);
      
      Alert.alert('Success', 'Supplier created successfully!');
      
      // Navigate back and pass the new supplier ID
      navigation.navigate({
        name: 'ProcessPR',
        params: { newSupplierId: response.data.supplierId },
        merge: true,
      });
    } catch (error) {
      console.error('Error creating supplier:', error);
      Alert.alert('Error', error?.response?.data?.message || 'Failed to create supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Animated.ScrollView contentContainerStyle={styles.scrollContent} entering={FadeIn}>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.card}>
          <Text style={styles.sectionTitle}>NEW SUPPLIER DETAILS</Text>

          <Text style={styles.label}>Supplier Name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(val) => handleUpdateField('name', val)}
            placeholder="Enter supplier name"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Contact Person</Text>
          <TextInput
            style={styles.input}
            value={formData.contact_person}
            onChangeText={(val) => handleUpdateField('contact_person', val)}
            placeholder="Enter contact person"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(val) => handleUpdateField('phone', val)}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(val) => handleUpdateField('email', val)}
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.address}
            onChangeText={(val) => handleUpdateField('address', val)}
            placeholder="Enter full address"
            placeholderTextColor="#9ca3af"
            multiline={true}
            numberOfLines={3}
          />

          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.performance_notes}
            onChangeText={(val) => handleUpdateField('performance_notes', val)}
            placeholder="Enter any additional notes"
            placeholderTextColor="#9ca3af"
            multiline={true}
            numberOfLines={2}
          />
        </Animated.View>
        <View style={styles.bottomPadding} />
      </Animated.ScrollView>

      {/* Action Bar */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.bottomActionBar}>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.submitBtn]} 
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
             <ActivityIndicator color="white" />
          ) : (
             <Text style={styles.actionBtnText}>Save Supplier</Text>
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
  required: {
    color: '#ef4444',
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
