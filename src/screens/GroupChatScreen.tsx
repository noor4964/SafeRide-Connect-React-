import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
  getDoc,
  doc,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { firestore as db } from '@/config/firebaseConfig';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useUser } from '@/features/auth/hooks/useUser';
import { useTheme } from '@/context/ThemeContext';
import type { ChatMessageType } from '@/types/rideMatching';
import { UserAvatar } from '@/components/UserAvatar';
import { notifyNewChatMessage } from '@/services/notificationService';

type GroupChatRouteProp = RouteProp<{ GroupChat: { matchId: string } }, 'GroupChat'>;

const GroupChatScreen: React.FC = () => {
  const route = useRoute<GroupChatRouteProp>();
  const { user } = useAuth();
  const { userProfile } = useUser();
  const { colors } = useTheme();
  const matchId = route.params?.matchId;

  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Subscribe to messages in real-time
  useEffect(() => {
    if (!matchId) return;

    const messagesRef = collection(db, 'chatMessages');
    const q = query(
      messagesRef,
      where('matchId', '==', matchId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newMessages: ChatMessageType[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          newMessages.push({
            id: doc.id,
            matchId: data.matchId,
            senderId: data.senderId,
            senderName: data.senderName,
            type: data.type,
            message: data.message,
            location: data.location,
            imageUrl: data.imageUrl,
            timestamp: data.timestamp?.toDate() || new Date(),
          });
        });
        setMessages(newMessages);
        setIsLoading(false);

        // Auto-scroll to bottom when new messages arrive
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      (error) => {
        console.error('Error loading messages:', error);
        setIsLoading(false);
        Alert.alert('Error', 'Failed to load messages');
      }
    );

    return () => unsubscribe();
  }, [matchId]);

  const sendMessage = async (type: 'text' | 'location' | 'system', message?: string, location?: { latitude: number; longitude: number; address?: string }) => {
    if (!user || !userProfile || !matchId) return;

    if (type === 'text' && !message?.trim()) return;

    setIsSending(true);

    try {
      const messagesRef = collection(db, 'chatMessages');
      await addDoc(messagesRef, {
        matchId,
        senderId: user.uid,
        senderName: `${userProfile.firstName} ${userProfile.lastName}`,
        type,
        message: message || '',
        location: location || null,
        imageUrl: null,
        timestamp: serverTimestamp(),
        readBy: [],
      });

      setMessageText('');

      // Send notifications to other participants
      if (type === 'text' || type === 'location') {
        try {
          const matchDoc = await getDoc(doc(db, 'rideMatches', matchId));
          if (matchDoc.exists()) {
            const matchData = matchDoc.data();
            const participantIds = matchData.participants?.map((p: any) => p.userId) || [];
            const messagePreview = type === 'text' 
              ? message || '' 
              : '📍 Shared location';
            
            await notifyNewChatMessage(
              participantIds,
              user.uid,
              `${userProfile.firstName} ${userProfile.lastName}`,
              matchId,
              messagePreview
            );
          }
        } catch (notifError) {
          console.error('Error sending chat notification:', notifError);
          // Don't fail message sending if notification fails
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendText = () => {
    if (!messageText.trim()) return;
    sendMessage('text', messageText);
  };

  const handleShareLocation = async () => {
    setSendingLocation(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to share location');
        setSendingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Reverse geocode to get address
      const addressResults = await Location.reverseGeocodeAsync({ latitude, longitude });
      const address = addressResults[0]
        ? `${addressResults[0].street || ''}, ${addressResults[0].city || ''}`
        : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

      await sendMessage('location', `Shared location: ${address}`, {
        latitude,
        longitude,
        address,
      });
    } catch (error) {
      console.error('Error sharing location:', error);
      Alert.alert('Error', 'Failed to share location');
    } finally {
      setSendingLocation(false);
    }
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
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const renderMessage = ({ item, index }: { item: ChatMessageType; index: number }) => {
    const isOwnMessage = item.senderId === user?.uid;
    const isSystemMessage = item.type === 'system';
    
    // Show date separator
    const showDateSeparator =
      index === 0 ||
      formatDate(item.timestamp) !== formatDate(messages[index - 1].timestamp);

    return (
      <>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{formatDate(item.timestamp)}</Text>
          </View>
        )}

        {isSystemMessage ? (
          <View style={styles.systemMessageContainer}>
            <Text style={styles.systemMessageText}>{item.message}</Text>
          </View>
        ) : (
          <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
            {!isOwnMessage && (
              <View style={styles.senderAvatar}>
                <Text style={styles.senderAvatarText}>
                  {item.senderName.charAt(0)}
                </Text>
              </View>
            )}

            <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
              {!isOwnMessage && (
                <Text style={styles.senderName}>{item.senderName}</Text>
              )}

              {item.type === 'text' && (
                <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
                  {item.message}
                </Text>
              )}

              {item.type === 'location' && item.location && (
                <TouchableOpacity
                  style={styles.locationMessage}
                  onPress={() => {
                    const { latitude, longitude } = item.location!;
                    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                    // Open map
                    Alert.alert('Location', item.message || 'View on map');
                  }}
                >
                  <Ionicons name="location" size={20} color={isOwnMessage ? '#fff' : '#3182ce'} />
                  <Text style={[styles.locationText, isOwnMessage && styles.ownLocationText]}>
                    {item.message || 'Tap to view location'}
                  </Text>
                </TouchableOpacity>
              )}

              {item.type === 'image' && item.imageUrl && (
                <View style={styles.imageMessage}>
                  <Text style={styles.messageText}>📷 Image</Text>
                </View>
              )}

              <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
                {formatTime(item.timestamp)}
              </Text>
            </View>

            {isOwnMessage && (
              <View style={styles.ownMessageSpacer} />
            )}
          </View>
        )}
      </>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3182ce" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e0" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>
              Start the conversation with your ride partners!
            </Text>
          </View>
        }
      />

      {/* Input Container */}
      <View style={styles.inputContainer}>
        {/* Location Share Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleShareLocation}
          disabled={sendingLocation}
        >
          {sendingLocation ? (
            <ActivityIndicator size="small" color="#3182ce" />
          ) : (
            <Ionicons name="location" size={24} color="#3182ce" />
          )}
        </TouchableOpacity>

        {/* Text Input */}
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#a0aec0"
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={500}
        />

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
          onPress={handleSendText}
          disabled={isSending || !messageText.trim()}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Actions Bar */}
      <View style={styles.quickActionsBar}>
        <TouchableOpacity style={styles.quickAction}>
          <Ionicons name="camera" size={20} color="#718096" />
          <Text style={styles.quickActionText}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction}>
          <Ionicons name="cash" size={20} color="#718096" />
          <Text style={styles.quickActionText}>Payment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction}>
          <Ionicons name="car" size={20} color="#718096" />
          <Text style={styles.quickActionText}>Booking</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#718096',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#718096',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageText: {
    fontSize: 13,
    color: '#718096',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3182ce',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  senderAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  ownMessageSpacer: {
    width: 40,
  },
  messageBubble: {
    maxWidth: '70%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ownMessageBubble: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3182ce',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#1a365d',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  locationMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#3182ce',
    textDecorationLine: 'underline',
  },
  ownLocationText: {
    color: '#fff',
  },
  imageMessage: {
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageTime: {
    fontSize: 10,
    color: '#a0aec0',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: '#e2e8f0',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ebf8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f7fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a365d',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3182ce',
    alignItems: 'center',
    justifyContent: 'center',    shadowColor: '#3182ce',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e0',
  },
  quickActionsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
  },
  quickAction: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  quickActionText: {
    fontSize: 11,
    color: '#718096',
    marginTop: 4,
  },
});

export default GroupChatScreen;
