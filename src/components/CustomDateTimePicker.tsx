import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CustomDateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
  visible: boolean;
}

export const CustomDateTimePicker: React.FC<CustomDateTimePickerProps> = ({
  value,
  onChange,
  onClose,
  minimumDate = new Date(),
  maximumDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  visible,
}) => {
  const [selectedDate, setSelectedDate] = useState(value);

  // Generate days for the next 30 days
  const generateDays = () => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  };

  // Generate hours (0-23)
  const generateHours = () => {
    return Array.from({ length: 24 }, (_, i) => i);
  };

  // Generate minutes (0, 5, 10, 15, ..., 55)
  const generateMinutes = () => {
    return Array.from({ length: 12 }, (_, i) => i * 5);
  };

  const formatDayLabel = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const formatMinute = (minute: number) => {
    return minute.toString().padStart(2, '0');
  };

  const handleDaySelect = (date: Date) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(date.getFullYear());
    newDate.setMonth(date.getMonth());
    newDate.setDate(date.getDate());
    setSelectedDate(newDate);
  };

  const handleHourSelect = (hour: number) => {
    const newDate = new Date(selectedDate);
    newDate.setHours(hour);
    setSelectedDate(newDate);
  };

  const handleMinuteSelect = (minute: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMinutes(minute);
    setSelectedDate(newDate);
  };

  const handleConfirm = () => {
    // Check if selected date meets minimum requirement
    if (minimumDate && selectedDate < minimumDate) {
      onChange(minimumDate);
    } else {
      onChange(selectedDate);
    }
    onClose();
  };

  const days = generateDays();
  const hours = generateHours();
  const minutes = generateMinutes();

  const selectedDay = new Date(selectedDate);
  selectedDay.setHours(0, 0, 0, 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Date & Time</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#4a5568" />
            </TouchableOpacity>
          </View>

          <View style={styles.pickersContainer}>
            {/* Day Picker */}
            <View style={styles.pickerColumn}>
              <Text style={styles.columnLabel}>Day</Text>
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {days.map((day) => {
                  const dayStart = new Date(day);
                  dayStart.setHours(0, 0, 0, 0);
                  const isSelected = dayStart.getTime() === selectedDay.getTime();
                  
                  return (
                    <TouchableOpacity
                      key={day.toISOString()}
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => handleDaySelect(day)}
                    >
                      <Text style={[styles.pickerText, isSelected && styles.pickerTextSelected]}>
                        {formatDayLabel(day)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Hour Picker */}
            <View style={styles.pickerColumn}>
              <Text style={styles.columnLabel}>Hour</Text>
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {hours.map((hour) => {
                  const isSelected = selectedDate.getHours() === hour;
                  
                  return (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => handleHourSelect(hour)}
                    >
                      <Text style={[styles.pickerText, isSelected && styles.pickerTextSelected]}>
                        {formatHour(hour)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Minute Picker */}
            <View style={styles.pickerColumn}>
              <Text style={styles.columnLabel}>Min</Text>
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {minutes.map((minute) => {
                  const isSelected = selectedDate.getMinutes() === minute;
                  
                  return (
                    <TouchableOpacity
                      key={minute}
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => handleMinuteSelect(minute)}
                    >
                      <Text style={[styles.pickerText, isSelected && styles.pickerTextSelected]}>
                        {formatMinute(minute)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Selected Preview */}
          <View style={styles.previewContainer}>
            <Text style={styles.previewLabel}>Selected:</Text>
            <Text style={styles.previewValue}>
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })} at {selectedDate.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
              })}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
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
    maxWidth: 400,
    maxHeight: '80%',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
  },
  closeButton: {
    padding: 4,
  },
  pickersContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  pickerColumn: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#718096',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollView: {
    maxHeight: 240,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: 'center',
  },
  pickerItemSelected: {
    backgroundColor: '#3182ce',
  },
  pickerText: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  pickerTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  previewContainer: {
    padding: 16,
    backgroundColor: '#f7fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#718096',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#cbd5e0',
    alignItems: 'center',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3182ce',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a5568',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
