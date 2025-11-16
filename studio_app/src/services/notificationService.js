/**
 * Notification Service
 *
 * Handles all notification-related operations including loading, marking as read, and deleting notifications.
 *
 * BACKEND STATUS:
 * ✅ Firestore queries implemented
 * ✅ Real-time listeners implemented
 * ⏳ Cloud Functions needed (onLikeCreate, onSaveRecipe, onFollowCreate, cleanupOldNotifications)
 */

import { collection, query, where, orderBy, limit, getDocs, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Load notifications for current user (paginated)
 *
 * @param {string} userId - Current user ID
 * @param {number} pageSize - Number of notifications to load (default: 30)
 * @returns {Promise<{success: boolean, data?: {notifications: Array, count: number}, error?: object}>}
 *
 * Required Firestore Index:
 * - Collection: notifications
 * - Fields: recipientId (Ascending), createdAt (Descending)
 */
export const loadNotifications = async (userId, pageSize = 30) => {
  try {
    console.log(`📥 Loading notifications for user ${userId}`);

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    const querySnapshot = await getDocs(notificationsQuery);
    const notifications = querySnapshot.docs.map(doc => ({
      notificationId: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(), // Convert Firestore Timestamp to Date
    }));

    console.log(`✅ Loaded ${notifications.length} notifications`);

    return {
      success: true,
      data: {
        notifications,
        count: notifications.length,
      },
    };
  } catch (error) {
    console.error('❌ Error loading notifications:', error);
    return {
      success: false,
      error: {
        code: error.code || 'unknown',
        message: error.message || 'Failed to load notifications',
      },
    };
  }
};

/**
 * Set up real-time listener for notifications (for bell badge)
 *
 * @param {string} userId - Current user ID
 * @param {function} onUpdate - Callback function: ({notifications, unreadCount}) => void
 * @returns {function} Unsubscribe function
 */
export const subscribeToNotifications = (userId, onUpdate) => {
  console.log(`🔔 Setting up notifications listener for user ${userId}`);

  const notificationsQuery = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  const unsubscribe = onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        notificationId: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      const unreadCount = notifications.filter(n => !n.isRead).length;

      console.log(`🔔 Notifications updated: ${notifications.length} total, ${unreadCount} unread`);

      onUpdate({ notifications, unreadCount });
    },
    (error) => {
      console.error('❌ Notifications listener error:', error);
    }
  );

  return () => {
    console.log('🔕 Unsubscribed from notifications listener');
    unsubscribe();
  };
};

/**
 * Mark all visible notifications as read (when page opens)
 *
 * @param {Array<string>} notificationIds - Array of notification IDs to mark as read
 * @returns {Promise<{success: boolean, data?: {markedCount: number}, error?: object}>}
 */
export const markNotificationsAsRead = async (notificationIds) => {
  try {
    if (!notificationIds || notificationIds.length === 0) {
      return {
        success: true,
        data: { markedCount: 0 },
      };
    }

    console.log(`✅ Marking ${notificationIds.length} notifications as read`);

    const batch = writeBatch(db);

    notificationIds.forEach((notifId) => {
      const notifRef = doc(db, 'notifications', notifId);
      batch.update(notifRef, {
        isRead: true,
        readAt: serverTimestamp(),
      });
    });

    await batch.commit();

    console.log(`✅ Successfully marked ${notificationIds.length} notifications as read`);

    return {
      success: true,
      data: {
        markedCount: notificationIds.length,
      },
    };
  } catch (error) {
    console.error('❌ Error marking notifications as read:', error);
    return {
      success: false,
      error: {
        code: error.code || 'unknown',
        message: error.message || 'Failed to mark notifications as read',
      },
    };
  }
};

/**
 * Delete single notification
 *
 * @param {string} notificationId - Notification ID to delete
 * @returns {Promise<{success: boolean, data?: {deleted: boolean}, error?: object}>}
 */
export const deleteNotification = async (notificationId) => {
  try {
    console.log(`🗑️ Deleting notification ${notificationId}`);

    const notifRef = doc(db, 'notifications', notificationId);
    await deleteDoc(notifRef);

    console.log(`✅ Successfully deleted notification ${notificationId}`);

    return {
      success: true,
      data: {
        deleted: true,
      },
    };
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    return {
      success: false,
      error: {
        code: error.code || 'unknown',
        message: error.message || 'Failed to delete notification',
      },
    };
  }
};

/**
 * Delete all notifications for user
 *
 * @param {string} userId - Current user ID
 * @returns {Promise<{success: boolean, data?: {deletedCount: number}, error?: object}>}
 */
export const deleteAllNotifications = async (userId) => {
  try {
    console.log(`🗑️ Deleting all notifications for user ${userId}`);

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId)
    );

    const querySnapshot = await getDocs(notificationsQuery);

    if (querySnapshot.empty) {
      return {
        success: true,
        data: {
          deletedCount: 0,
        },
      };
    }

    const batch = writeBatch(db);

    querySnapshot.docs.forEach((docSnapshot) => {
      batch.delete(docSnapshot.ref);
    });

    await batch.commit();

    console.log(`✅ Successfully deleted ${querySnapshot.size} notifications`);

    return {
      success: true,
      data: {
        deletedCount: querySnapshot.size,
      },
    };
  } catch (error) {
    console.error('❌ Error deleting all notifications:', error);
    return {
      success: false,
      error: {
        code: error.code || 'unknown',
        message: error.message || 'Failed to delete all notifications',
      },
    };
  }
};

// ============================================================
// CLOUD FUNCTIONS (TODO: Backend - Implement in Firebase Functions)
// ============================================================

/**
 * Cloud Function: Create notification when someone likes a recipe
 *
 * Trigger: Firestore onCreate on 'likes/{likeId}'
 *
 * TODO: Backend - Implement in functions/index.js:
 * ```javascript
 * exports.onLikeCreate = functions.firestore
 *   .document('likes/{likeId}')
 *   .onCreate(async (snap, context) => {
 *     const likeData = snap.data();
 *     const { userId, recipeId } = likeData;
 *
 *     // Get recipe to find author
 *     const recipeDoc = await admin.firestore().collection('recipes').doc(recipeId).get();
 *     const recipeAuthorId = recipeDoc.data().authorId;
 *
 *     // Don't notify if user likes their own recipe
 *     if (userId === recipeAuthorId) return null;
 *
 *     // Get liker details
 *     const userDoc = await admin.firestore().collection('users').doc(userId).get();
 *     const userData = userDoc.data();
 *
 *     // Create notification
 *     await admin.firestore().collection('notifications').add({
 *       type: 'like',
 *       recipientId: recipeAuthorId,
 *       actorId: userId,
 *       actorUsername: userData.username,
 *       actorHandle: userData.handle,
 *       actorAvatar: userData.avatar,
 *       targetRecipeId: recipeId,
 *       targetRecipeTitle: recipeDoc.data().title,
 *       isRead: false,
 *       createdAt: admin.firestore.FieldValue.serverTimestamp()
 *     });
 *   });
 * ```
 */

/**
 * Cloud Function: Create notification when someone saves a recipe
 *
 * Trigger: Firestore onCreate on 'collection_recipes/{id}'
 *
 * TODO: Backend - Similar to onLikeCreate, but type: 'save'
 */

/**
 * Cloud Function: Create notification when someone follows a user
 *
 * Trigger: Firestore onCreate on 'follows/{followId}'
 *
 * TODO: Backend - Similar to onLikeCreate, but type: 'follow', no recipe info
 */

/**
 * Cloud Function: Clean up old notifications (30-day retention)
 *
 * Trigger: Scheduled Cloud Function (daily at 2am)
 *
 * TODO: Backend - Implement scheduled cleanup:
 * ```javascript
 * exports.cleanupOldNotifications = functions.pubsub
 *   .schedule('0 2 * * *') // Every day at 2am
 *   .onRun(async (context) => {
 *     const thirtyDaysAgo = new Date();
 *     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
 *
 *     const oldNotificationsQuery = admin.firestore()
 *       .collection('notifications')
 *       .where('createdAt', '<', thirtyDaysAgo);
 *
 *     const snapshot = await oldNotificationsQuery.get();
 *     const batch = admin.firestore().batch();
 *
 *     snapshot.docs.forEach(doc => {
 *       batch.delete(doc.ref);
 *     });
 *
 *     await batch.commit();
 *     console.log(`Deleted ${snapshot.size} old notifications`);
 *   });
 * ```
 */

export default {
  loadNotifications,
  subscribeToNotifications,
  markNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
};
