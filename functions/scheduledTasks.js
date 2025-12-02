/**
 * FIREBASE CLOUD FUNCTIONS - SCHEDULED TASKS
 * 
 * These functions should run periodically to maintain data integrity
 * and handle match timeouts/expirations
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Expire old matches every 30 minutes
 * Matches past their departure time with 'pending' status will be cancelled
 */
exports.expireOldMatches = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async (context) => {
    try {
      const now = admin.firestore.Timestamp.now();
      
      // Query matches that are past their departure time and still pending
      const matchesSnapshot = await db
        .collection('rideMatches')
        .where('status', '==', 'pending')
        .where('departureTime', '<', now)
        .get();

      let expiredCount = 0;
      const batch = db.batch();

      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = matchDoc.data();
        
        // Update match to cancelled
        batch.update(matchDoc.ref, {
          status: 'cancelled',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update all associated ride requests back to searching
        for (const requestId of matchData.requestIds) {
          const requestRef = db.collection('rideRequests').doc(requestId);
          batch.update(requestRef, {
            status: 'searching',
            matchId: null,
            matchedWith: [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Create notifications for all participants
        for (const participant of matchData.participants) {
          const notificationRef = db.collection('notifications').doc();
          batch.set(notificationRef, {
            userId: participant.userId,
            type: 'match_cancelled',
            title: '⏰ Match Expired',
            body: 'Your match was cancelled because the departure time has passed.',
            priority: 'normal',
            data: { matchId: matchDoc.id },
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        expiredCount++;
      }

      await batch.commit();

      console.log(`✅ Expired ${expiredCount} old matches`);
      return { expiredCount };
    } catch (error) {
      console.error('Error expiring matches:', error);
      throw error;
    }
  });

/**
 * Check confirmation timeouts every 15 minutes
 * Matches older than 30 minutes without full confirmation will be cancelled
 */
exports.checkConfirmationTimeouts = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    try {
      const now = new Date();
      const timeoutThreshold = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
      
      // Query pending matches created more than 30 minutes ago
      const matchesSnapshot = await db
        .collection('rideMatches')
        .where('status', '==', 'pending')
        .where('createdAt', '<', admin.firestore.Timestamp.fromDate(timeoutThreshold))
        .get();

      let timedOutCount = 0;
      const batch = db.batch();

      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = matchDoc.data();
        const confirmedCount = (matchData.confirmations || []).length;
        const totalParticipants = matchData.participants.length;

        // If not all confirmed, cancel the match
        if (confirmedCount < totalParticipants) {
          batch.update(matchDoc.ref, {
            status: 'cancelled',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Reset unconfirmed users' requests to searching
          const confirmedUserIds = matchData.confirmations || [];
          for (let i = 0; i < matchData.requestIds.length; i++) {
            const requestId = matchData.requestIds[i];
            const participant = matchData.participants[i];
            
            if (!confirmedUserIds.includes(participant.userId)) {
              const requestRef = db.collection('rideRequests').doc(requestId);
              batch.update(requestRef, {
                status: 'searching',
                matchId: null,
                matchedWith: [],
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
          }

          // Notify all participants
          for (const participant of matchData.participants) {
            const notificationRef = db.collection('notifications').doc();
            batch.set(notificationRef, {
              userId: participant.userId,
              type: 'match_cancelled',
              title: '⏰ Confirmation Timeout',
              body: `Match cancelled: Not all participants confirmed in time (${confirmedCount}/${totalParticipants} confirmed)`,
              priority: 'normal',
              data: { matchId: matchDoc.id },
              isRead: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          timedOutCount++;
        }
      }

      await batch.commit();

      console.log(`⏰ Cancelled ${timedOutCount} matches due to confirmation timeout`);
      return { timedOutCount };
    } catch (error) {
      console.error('Error checking confirmation timeouts:', error);
      throw error;
    }
  });

/**
 * Clean up expired ride requests every hour
 * Requests past their expiration time will be marked as expired
 */
exports.cleanupExpiredRequests = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    try {
      const now = admin.firestore.Timestamp.now();
      
      const requestsSnapshot = await db
        .collection('rideRequests')
        .where('status', '==', 'searching')
        .where('expiresAt', '<', now)
        .get();

      let cleanedUpCount = 0;
      const batch = db.batch();

      for (const requestDoc of requestsSnapshot.docs) {
        batch.update(requestDoc.ref, {
          status: 'cancelled',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        cleanedUpCount++;
      }

      await batch.commit();

      console.log(`🧹 Cleaned up ${cleanedUpCount} expired requests`);
      return { cleanedUpCount };
    } catch (error) {
      console.error('Error cleaning up expired requests:', error);
      throw error;
    }
  });

/**
 * Notify users to confirm matches (runs 5 minutes after match creation)
 * Triggered by onCreate for each match
 */
exports.notifyMatchConfirmation = functions.firestore
  .document('rideMatches/{matchId}')
  .onCreate(async (snap, context) => {
    try {
      const matchData = snap.data();
      const matchId = context.params.matchId;

      // Schedule a notification 5 minutes after creation to remind users
      setTimeout(async () => {
        const currentMatch = await snap.ref.get();
        
        if (currentMatch.exists && currentMatch.data().status === 'pending') {
          const confirmedUserIds = currentMatch.data().confirmations || [];
          const batch = db.batch();

          for (const participant of currentMatch.data().participants) {
            if (!confirmedUserIds.includes(participant.userId)) {
              const notificationRef = db.collection('notifications').doc();
              batch.set(notificationRef, {
                userId: participant.userId,
                type: 'match_confirmation_reminder',
                title: '⏰ Confirm Your Match',
                body: 'Please confirm your match within 30 minutes to secure your ride.',
                priority: 'high',
                data: { matchId },
                isRead: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
          }

          await batch.commit();
          console.log(`🔔 Sent confirmation reminders for match ${matchId}`);
        }
      }, 5 * 60 * 1000); // 5 minutes

      return null;
    } catch (error) {
      console.error('Error sending confirmation reminders:', error);
      return null;
    }
  });

/**
 * Send notification when all participants confirm
 */
exports.onMatchFullyConfirmed = functions.firestore
  .document('rideMatches/{matchId}')
  .onUpdate(async (change, context) => {
    try {
      const beforeData = change.before.data();
      const afterData = change.after.data();
      const matchId = context.params.matchId;

      // Check if status changed from pending to confirmed
      if (beforeData.status === 'pending' && afterData.status === 'confirmed') {
        const batch = db.batch();

        // Notify all participants that the match is confirmed
        for (const participant of afterData.participants) {
          const notificationRef = db.collection('notifications').doc();
          batch.set(notificationRef, {
            userId: participant.userId,
            type: 'match_confirmed',
            title: '🎉 Match Confirmed!',
            body: `All participants confirmed! Cost: ৳${afterData.finalCostPerPerson || afterData.costPerPerson} per person.`,
            priority: 'high',
            data: { matchId },
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Add system message to chat (use first participant as sender)
        const systemSenderId = afterData.participants && afterData.participants.length > 0 
          ? afterData.participants[0].userId 
          : 'system';
        const chatRef = db.collection('chatMessages').doc();
        batch.set(chatRef, {
          matchId,
          senderId: systemSenderId,
          senderName: 'System',
          type: 'system',
          message: `🎉 All participants confirmed! Final cost: ৳${afterData.finalCostPerPerson || afterData.costPerPerson} per person. Ready to ride!`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          readBy: [],
        });

        await batch.commit();
        console.log(`🎉 Match ${matchId} fully confirmed - notifications sent`);
      }

      return null;
    } catch (error) {
      console.error('Error handling match confirmation:', error);
      return null;
    }
  });

module.exports = {
  expireOldMatches: exports.expireOldMatches,
  checkConfirmationTimeouts: exports.checkConfirmationTimeouts,
  cleanupExpiredRequests: exports.cleanupExpiredRequests,
  notifyMatchConfirmation: exports.notifyMatchConfirmation,
  onMatchFullyConfirmed: exports.onMatchFullyConfirmed,
};
