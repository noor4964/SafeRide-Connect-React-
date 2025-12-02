import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomDateTimePicker } from './CustomDateTimePicker';
import type { RideRequestType } from '@/types/rideMatching';

interface RequestActionsModalProps {
  visible: boolean;
  request: RideRequestType | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (requestId: string) => Promise<void>;
  onUpdate: (requestId: string, updates: any) => Promise<void>;
}

export const RequestActionsModal: React.FC<RequestActionsModalProps> = ({
  visible,
  request,
  onClose,
  onEdit,
  onDelete,
  onUpdate,
}) => {
  const [showActions, setShowActions] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Edit form states
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [departureTime, setDepartureTime] = useState(request?.departureTime || new Date());
  const [flexibility, setFlexibility] = useState(request?.flexibility || 15);
  const [lookingForSeats, setLookingForSeats] = useState(request?.lookingForSeats || 1);
  const [maxPricePerSeat, setMaxPricePerSeat] = useState(request?.maxPricePerSeat || 200);
  const [maxWalkDistance, setMaxWalkDistance] = useState(request?.maxWalkDistance || 500);
  const [genderPreference, setGenderPreference] = useState<'any' | 'female_only' | 'male_only'>(
    request?.preferences?.genderPreference || 'any'
  );

  React.useEffect(() => {
    if (request) {
      setDepartureTime(request.departureTime);
      setFlexibility(request.flexibility);
      setLookingForSeats(request.lookingForSeats);
      setMaxPricePerSeat(request.maxPricePerSeat);
      setMaxWalkDistance(request.maxWalkDistance);
      setGenderPreference(request.preferences?.genderPreference || 'any');
    }
  }, [request]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Request',
      'Are you sure you want to delete this ride request? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!request) return;
            
            try {
              setIsDeleting(true);
              await onDelete(request.id);
              Alert.alert('Success', 'Request deleted successfully');
              onClose();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete request');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleEditPress = () => {
    setShowActions(false);
    setShowEditForm(true);
  };

  const handleSaveEdit = async () => {
    if (!request) return;

    try {
      setIsUpdating(true);
      
      await onUpdate(request.id, {
        departureTime,
        flexibility,
        lookingForSeats,
        maxPricePerSeat,
        maxWalkDistance,
        preferences: {
          genderPreference,
        },
      });

      Alert.alert('Success', 'Request updated successfully');
      setShowEditForm(false);
      setShowActions(true);
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update request');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setShowEditForm(false);
    setShowActions(true);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (!request) return null;

  // Can only edit/delete if status is 'searching'
  const canModify = request.status === 'searching';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {showActions && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Manage Request</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#4a5568" />
                </TouchableOpacity>
              </View>

              <View style={styles.requestInfo}>
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={18} color="#10b981" />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {request.origin.address}
                  </Text>
                </View>
                <View style={styles.arrowContainer}>
                  <Ionicons name="arrow-down" size={16} color="#718096" />
                </View>
                <View style={styles.locationRow}>
                  <Ionicons name="flag" size={18} color="#ef4444" />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {request.destination.address}
                  </Text>
                </View>
              </View>

              {!canModify && (
                <View style={styles.warningBox}>
                  <Ionicons name="information-circle" size={20} color="#f59e0b" />
                  <Text style={styles.warningText}>
                    You can only edit or delete requests that are still searching for matches
                  </Text>
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, !canModify && styles.actionButtonDisabled]}
                  onPress={handleEditPress}
                  disabled={!canModify}
                >
                  <Ionicons name="create-outline" size={20} color={canModify ? "#3182ce" : "#cbd5e0"} />
                  <Text style={[styles.actionButtonText, !canModify && styles.actionButtonTextDisabled]}>
                    Edit Details
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton, !canModify && styles.actionButtonDisabled]}
                  onPress={handleDelete}
                  disabled={!canModify || isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color={canModify ? "#ef4444" : "#cbd5e0"} />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color={canModify ? "#ef4444" : "#cbd5e0"} />
                  )}
                  <Text style={[styles.deleteButtonText, !canModify && styles.actionButtonTextDisabled]}>
                    {isDeleting ? 'Deleting...' : 'Delete Request'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {showEditForm && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Edit Request</Text>
                <TouchableOpacity onPress={handleCancelEdit} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#4a5568" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.editForm} showsVerticalScrollIndicator={false}>
                {/* Time */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Departure Time</Text>
                  <TouchableOpacity
                    style={styles.timeSelector}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <View>
                      <Text style={styles.timeDateText}>{formatDate(departureTime)}</Text>
                      <Text style={styles.timeValueText}>{formatTime(departureTime)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#718096" />
                  </TouchableOpacity>
                </View>

                {/* Flexibility */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Time Flexibility</Text>
                  <View style={styles.chipGroup}>
                    {[0, 15, 30, 60].map((mins) => (
                      <TouchableOpacity
                        key={mins}
                        style={[styles.chip, flexibility === mins && styles.chipActive]}
                        onPress={() => setFlexibility(mins)}
                      >
                        <Text style={[styles.chipText, flexibility === mins && styles.chipTextActive]}>
                          {mins === 0 ? 'Exact' : `±${mins}m`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Seats */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Seats Needed</Text>
                  <View style={styles.counter}>
                    <TouchableOpacity
                      style={styles.counterButton}
                      onPress={() => setLookingForSeats(Math.max(1, lookingForSeats - 1))}
                    >
                      <Ionicons name="remove" size={20} color="#3182ce" />
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{lookingForSeats}</Text>
                    <TouchableOpacity
                      style={styles.counterButton}
                      onPress={() => setLookingForSeats(Math.min(4, lookingForSeats + 1))}
                    >
                      <Ionicons name="add" size={20} color="#3182ce" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Price */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Max Price per Seat</Text>
                  <View style={styles.chipGroup}>
                    {[100, 150, 200, 300].map((price) => (
                      <TouchableOpacity
                        key={price}
                        style={[styles.chip, maxPricePerSeat === price && styles.chipActive]}
                        onPress={() => setMaxPricePerSeat(price)}
                      >
                        <Text style={[styles.chipText, maxPricePerSeat === price && styles.chipTextActive]}>
                          ৳{price}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Walk Distance */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Max Walk Distance</Text>
                  <View style={styles.chipGroup}>
                    {[300, 500, 1000, 2000].map((distance) => (
                      <TouchableOpacity
                        key={distance}
                        style={[styles.chip, maxWalkDistance === distance && styles.chipActive]}
                        onPress={() => setMaxWalkDistance(distance)}
                      >
                        <Text style={[styles.chipText, maxWalkDistance === distance && styles.chipTextActive]}>
                          {distance}m
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Gender Preference */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Gender Preference</Text>
                  <View style={styles.chipGroup}>
                    {(['any', 'female_only', 'male_only'] as const).map((pref) => (
                      <TouchableOpacity
                        key={pref}
                        style={[styles.chip, genderPreference === pref && styles.chipActive]}
                        onPress={() => setGenderPreference(pref)}
                      >
                        <Text style={[styles.chipText, genderPreference === pref && styles.chipTextActive]}>
                          {pref === 'any' ? 'Any' : pref === 'female_only' ? 'Female Only' : 'Male Only'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelEditButton}
                  onPress={handleCancelEdit}
                  disabled={isUpdating}
                >
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, isUpdating && styles.saveButtonDisabled]}
                  onPress={handleSaveEdit}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>

              <CustomDateTimePicker
                visible={showTimePicker}
                value={departureTime}
                onChange={(date) => setDepartureTime(date)}
                onClose={() => setShowTimePicker(false)}
                minimumDate={new Date()}
                maximumDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  closeButton: {
    padding: 4,
  },
  requestInfo: {
    padding: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    color: '#2d3748',
    marginLeft: 8,
    fontWeight: '500',
  },
  arrowContainer: {
    paddingLeft: 4,
    paddingVertical: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    marginLeft: 8,
  },
  actions: {
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3182ce',
    marginLeft: 8,
  },
  actionButtonTextDisabled: {
    color: '#cbd5e0',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 8,
  },
  editForm: {
    maxHeight: 400,
  },
  formSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 12,
  },
  timeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f7fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timeDateText: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 4,
  },
  timeValueText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a365d',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  chipText: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ebf8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a365d',
    minWidth: 40,
    textAlign: 'center',
  },
  editActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  cancelEditButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  cancelEditText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a5568',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#3182ce',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
