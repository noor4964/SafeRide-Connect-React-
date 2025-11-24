import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/features/auth/context/AuthContext';
import { updateUserProfile } from '@/features/auth/services/userService';
import { useTheme } from '@/context/ThemeContext';
import { MainTabParamList } from '@/types';
import type { EmergencyContact } from '@/services/safetyService';

type EmergencyContactsNavigationProp = BottomTabNavigationProp<MainTabParamList>;

const EmergencyContactsScreen: React.FC = () => {
  const navigation = useNavigation<EmergencyContactsNavigationProp>();
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { colors } = useTheme();

  const [contacts, setContacts] = useState<EmergencyContact[]>(
    (userProfile?.emergencyContacts?.filter(
      (c): c is EmergencyContact => !!c.name && !!c.phone && !!c.relationship
    ) || []) as EmergencyContact[]
  );
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState<EmergencyContact>({
    name: '',
    phone: '',
    relationship: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleAddContact = () => {
    // Validation
    if (!newContact.name.trim()) {
      Alert.alert('Error', 'Please enter contact name');
      return;
    }

    if (!newContact.phone.trim() || newContact.phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    if (!newContact.relationship.trim()) {
      Alert.alert('Error', 'Please enter relationship');
      return;
    }

    // Check for duplicates
    if (contacts.some(c => c.phone === newContact.phone.trim())) {
      Alert.alert('Error', 'This phone number is already added');
      return;
    }

    // Add contact
    setContacts([...contacts, {
      name: newContact.name.trim(),
      phone: newContact.phone.trim(),
      relationship: newContact.relationship.trim(),
    }]);

    // Reset form
    setNewContact({ name: '', phone: '', relationship: '' });
    setIsAdding(false);
  };

  const handleRemoveContact = (index: number) => {
    Alert.alert(
      'Remove Contact',
      `Remove ${contacts[index].name} from emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedContacts = contacts.filter((_, i) => i !== index);
            setContacts(updatedContacts);
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!user) return;

    if (contacts.length === 0) {
      Alert.alert('Warning', 'Add at least one emergency contact for safety features');
      return;
    }

    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, {
        emergencyContacts: contacts,
      });

      await refreshUserProfile();

      Alert.alert(
        'Success',
        'Emergency contacts updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update contacts');
    } finally {
      setIsSaving(false);
    }
  };

  const relationshipOptions = [
    'Parent',
    'Sibling',
    'Spouse',
    'Friend',
    'Roommate',
    'Colleague',
    'Other',
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Emergency Contacts</Text>
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={[styles.saveButtonText, isSaving && styles.saveButtonTextDisabled]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color="#3182ce" />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Add trusted contacts who will be notified in case of emergency. They will receive your location and safety alerts.
            </Text>
          </View>

          {/* Existing Contacts */}
          {contacts.map((contact, index) => (
            <View key={index} style={[styles.contactCard, { backgroundColor: colors.surface }]}>
              <View style={styles.contactHeader}>
                <View style={styles.contactIcon}>
                  <Ionicons name="person" size={24} color="#3182ce" />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{contact.name}</Text>
                  <Text style={[styles.contactPhone, { color: colors.textSecondary }]}>
                    {contact.phone}
                  </Text>
                  <Text style={[styles.contactRelation, { color: colors.textTertiary }]}>
                    {contact.relationship}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveContact(index)}
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Add New Contact */}
          {isAdding ? (
            <View style={[styles.addContactForm, { backgroundColor: colors.surface }]}>
              <Text style={[styles.formTitle, { color: colors.text }]}>Add Emergency Contact</Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Name *</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={newContact.name}
                  onChangeText={(text) => setNewContact({ ...newContact, name: text })}
                  placeholder="e.g., John Doe"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Phone Number *</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={newContact.phone}
                  onChangeText={(text) => setNewContact({ ...newContact, phone: text })}
                  placeholder="e.g., +8801234567890"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Relationship *</Text>
                <View style={styles.relationshipChips}>
                  {relationshipOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.chip,
                        { borderColor: colors.border },
                        newContact.relationship === option && styles.chipActive,
                      ]}
                      onPress={() => setNewContact({ ...newContact, relationship: option })}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: colors.textSecondary },
                          newContact.relationship === option && styles.chipTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setIsAdding(false);
                    setNewContact({ name: '', phone: '', relationship: '' });
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formButton, styles.addButton]}
                  onPress={handleAddContact}
                >
                  <Ionicons name="checkmark" size={20} color="#ffffff" />
                  <Text style={styles.addButtonText}>Add Contact</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addNewButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setIsAdding(true)}
            >
              <Ionicons name="add-circle-outline" size={24} color="#3182ce" />
              <Text style={styles.addNewButtonText}>Add Emergency Contact</Text>
            </TouchableOpacity>
          )}

          {/* Guidelines */}
          <View style={[styles.guidelinesBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.guidelinesTitle, { color: colors.text }]}>Guidelines:</Text>
            <View style={styles.guidelineItem}>
              <Ionicons name="checkmark-circle" size={18} color="#38a169" />
              <Text style={[styles.guidelineText, { color: colors.textSecondary }]}>
                Add 2-3 trusted contacts who can help in emergencies
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Ionicons name="checkmark-circle" size={18} color="#38a169" />
              <Text style={[styles.guidelineText, { color: colors.textSecondary }]}>
                Ensure phone numbers are correct and reachable
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Ionicons name="checkmark-circle" size={18} color="#38a169" />
              <Text style={[styles.guidelineText, { color: colors.textSecondary }]}>
                Inform them they're listed as emergency contacts
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a365d',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    width: 70,
    alignItems: 'flex-end',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3182ce',
  },
  saveButtonTextDisabled: {
    color: '#94a3b8',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ebf8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 2,
  },
  contactRelation: {
    fontSize: 12,
    color: '#a0aec0',
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addContactForm: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a365d',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2d3748',
    backgroundColor: '#f8f9fa',
  },
  relationshipChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e0',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  formButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  cancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  addButton: {
    backgroundColor: '#3182ce',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e0',
    gap: 12,
    marginBottom: 16,
  },
  addNewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3182ce',
  },
  guidelinesBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a365d',
    marginBottom: 12,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  guidelineText: {
    flex: 1,
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
  },
});

export default EmergencyContactsScreen;
