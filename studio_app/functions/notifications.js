/**
 * Notification Cloud Functions for ChefiQ Studio App
 * Page 12: Notifications System
 *
 * Triggers:
 * 11. onLikeCreateNotification - Create notification when someone likes a recipe
 * 12. onSaveRecipeNotification - Create notification when someone saves a recipe
 * 13. onFollowCreateNotification - Create notification when someone follows a user
 * 14. cleanupOldNotifications - Scheduled cleanup of notifications older than 30 days
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Use existing admin instance from main index.js
const db = admin.firestore();

// ===========================================================================
// TRIGGER 11: onLikeCreateNotification
// ===========================================================================

/**
 * Trigger 11: onLikeCreateNotification
 * Creates notification when someone likes a recipe
 *
 * Trigger: onCreate likes/{likeId}
 * Actions:
 * - Create notification for recipe author
 * - Skip if user likes their own recipe
 */
exports.onLikeCreateNotification = functions.firestore
    .document("likes/{likeId}")
    .onCreate(async (snap, context) => {
      const startTime = Date.now();
      const likeId = context.params.likeId;

      try {
        const likeData = snap.data();
        const { userId, recipeId } = likeData;

        functions.logger.info(
            `[onLikeCreateNotification] Processing like: ${likeId} (user ${userId} → recipe ${recipeId})`,
        );

        // Get recipe to find author
        const recipeDoc = await db.collection("recipes").doc(recipeId).get();

        if (!recipeDoc.exists) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onLikeCreateNotification] ❌ Recipe ${recipeId} not found`);
          return { success: false, error: "Recipe not found", executionTime };
        }

        const recipeData = recipeDoc.data();
        const authorId = recipeData.authorId;

        // Don't notify if user likes their own recipe
        if (userId === authorId) {
          const executionTime = Date.now() - startTime;
          functions.logger.info(
              `[onLikeCreateNotification] Skipping notification (user liked own recipe)`,
          );
          return { success: true, skipped: true, reason: "self-like", executionTime };
        }

        // Get liker details
        const userDoc = await db.collection("users").doc(userId).get();

        if (!userDoc.exists) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onLikeCreateNotification] ❌ User ${userId} not found`);
          return { success: false, error: "User not found", executionTime };
        }

        const userData = userDoc.data();

        // Create notification
        const notificationData = {
          type: "like",
          recipientId: authorId,
          senderId: userId,
          relatedRecipeId: recipeId,
          message: `${userData.username} liked your recipe`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection("notifications").add(notificationData);

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onLikeCreateNotification] ✅ Created notification for user ${authorId} in ${executionTime}ms`,
        );

        return { success: true, recipientId: authorId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onLikeCreateNotification] ❌ Error creating notification for like ${likeId}:`,
            error,
        );
        functions.logger.error(`[onLikeCreateNotification] Execution time: ${executionTime}ms`);

        // Don't throw - allow like creation to succeed even if notification fails
        return { success: false, error: error.message, executionTime };
      }
    });

// ===========================================================================
// TRIGGER 12: onSaveRecipeNotification
// ===========================================================================

/**
 * Trigger 12: onSaveRecipeNotification
 * Creates notification when someone saves a recipe to their collection
 *
 * Trigger: onCreate collection_recipes/{documentId}
 * Actions:
 * - Create notification for recipe author
 * - Skip if user saves their own recipe
 */
exports.onSaveRecipeNotification = functions.firestore
    .document("collection_recipes/{documentId}")
    .onCreate(async (snap, context) => {
      const startTime = Date.now();
      const documentId = context.params.documentId;

      try {
        const saveData = snap.data();
        const { userId, recipeId } = saveData;

        functions.logger.info(
            `[onSaveRecipeNotification] Processing save: ${documentId} ` +
            `(user ${userId} → recipe ${recipeId})`,
        );

        // Get recipe to find author
        const recipeDoc = await db.collection("recipes").doc(recipeId).get();

        if (!recipeDoc.exists) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onSaveRecipeNotification] ❌ Recipe ${recipeId} not found`);
          return { success: false, error: "Recipe not found", executionTime };
        }

        const recipeData = recipeDoc.data();
        const authorId = recipeData.authorId;

        // Don't notify if user saves their own recipe
        if (userId === authorId) {
          const executionTime = Date.now() - startTime;
          functions.logger.info(
              `[onSaveRecipeNotification] Skipping notification (user saved own recipe)`,
          );
          return { success: true, skipped: true, reason: "self-save", executionTime };
        }

        // Get saver details
        const userDoc = await db.collection("users").doc(userId).get();

        if (!userDoc.exists) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onSaveRecipeNotification] ❌ User ${userId} not found`);
          return { success: false, error: "User not found", executionTime };
        }

        const userData = userDoc.data();

        // Create notification
        const notificationData = {
          type: "save",
          recipientId: authorId,
          senderId: userId,
          relatedRecipeId: recipeId,
          message: `${userData.username} saved your recipe`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection("notifications").add(notificationData);

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onSaveRecipeNotification] ✅ Created notification for user ${authorId} in ${executionTime}ms`,
        );

        return { success: true, recipientId: authorId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onSaveRecipeNotification] ❌ Error creating notification for save ${documentId}:`,
            error,
        );
        functions.logger.error(`[onSaveRecipeNotification] Execution time: ${executionTime}ms`);

        // Don't throw - allow save to succeed even if notification fails
        return { success: false, error: error.message, executionTime };
      }
    });

// ===========================================================================
// TRIGGER 13: onFollowCreateNotification
// ===========================================================================

/**
 * Trigger 13: onFollowCreateNotification
 * Creates notification when someone follows a user
 *
 * Trigger: onCreate follows/{followId}
 * Actions:
 * - Create notification for the user being followed
 */
exports.onFollowCreateNotification = functions.firestore
    .document("follows/{followId}")
    .onCreate(async (snap, context) => {
      const startTime = Date.now();
      const followId = context.params.followId;

      try {
        const followData = snap.data();
        const { followerId, followingId } = followData;

        functions.logger.info(
            `[onFollowCreateNotification] Processing follow: ${followId} ` +
            `(user ${followerId} → user ${followingId})`,
        );

        // Get follower details
        const followerDoc = await db.collection("users").doc(followerId).get();

        if (!followerDoc.exists) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onFollowCreateNotification] ❌ Follower ${followerId} not found`);
          return { success: false, error: "Follower not found", executionTime };
        }

        const followerData = followerDoc.data();

        // Create notification
        const notificationData = {
          type: "follow",
          recipientId: followingId,
          senderId: followerId,
          message: `${followerData.username} started following you`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection("notifications").add(notificationData);

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onFollowCreateNotification] ✅ Created notification for user ${followingId} in ${executionTime}ms`,
        );

        return { success: true, recipientId: followingId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onFollowCreateNotification] ❌ Error creating notification for follow ${followId}:`,
            error,
        );
        functions.logger.error(`[onFollowCreateNotification] Execution time: ${executionTime}ms`);

        // Don't throw - allow follow to succeed even if notification fails
        return { success: false, error: error.message, executionTime };
      }
    });

// ===========================================================================
// TRIGGER 14: cleanupOldNotifications
// ===========================================================================

/**
 * Trigger 14: cleanupOldNotifications
 * Scheduled function to clean up notifications older than 30 days
 *
 * Trigger: Scheduled (daily at 2am UTC)
 * Actions:
 * - Query notifications older than 30 days
 * - Batch delete old notifications
 * - Log cleanup results
 */
exports.cleanupOldNotifications = functions.pubsub
    .schedule("0 2 * * *") // Every day at 2am UTC
    .timeZone("UTC")
    .onRun(async (context) => {
      const startTime = Date.now();

      try {
        functions.logger.info("[cleanupOldNotifications] Starting scheduled cleanup");

        // Calculate 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        functions.logger.info(
            `[cleanupOldNotifications] Deleting notifications older than ${thirtyDaysAgo.toISOString()}`,
        );

        // Query old notifications
        const oldNotificationsQuery = await db
            .collection("notifications")
            .where("createdAt", "<", thirtyDaysAgo)
            .get();

        if (oldNotificationsQuery.empty) {
          const executionTime = Date.now() - startTime;
          functions.logger.info(
              `[cleanupOldNotifications] ✅ No notifications to delete in ${executionTime}ms`,
          );
          return { success: true, deletedCount: 0, executionTime };
        }

        const notificationsCount = oldNotificationsQuery.size;
        functions.logger.info(
            `[cleanupOldNotifications] Found ${notificationsCount} notifications to delete`,
        );

        // Batch delete (max 500 per batch)
        const batchSize = 500;
        let deletedCount = 0;

        // Process in chunks of 500
        const chunks = [];
        for (let i = 0; i < oldNotificationsQuery.docs.length; i += batchSize) {
          chunks.push(oldNotificationsQuery.docs.slice(i, i + batchSize));
        }

        for (const chunk of chunks) {
          const batch = db.batch();

          chunk.forEach((doc) => {
            batch.delete(doc.ref);
          });

          await batch.commit();
          deletedCount += chunk.length;

          functions.logger.info(
              `[cleanupOldNotifications] Deleted batch of ${chunk.length} notifications ` +
              `(${deletedCount}/${notificationsCount})`,
          );
        }

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[cleanupOldNotifications] ✅ Deleted ${deletedCount} old notifications in ${executionTime}ms`,
        );

        return { success: true, deletedCount, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            "[cleanupOldNotifications] ❌ Error during cleanup:",
            error,
        );
        functions.logger.error(`[cleanupOldNotifications] Execution time: ${executionTime}ms`);

        // Log error but don't throw - cleanup will retry tomorrow
        return { success: false, error: error.message, executionTime };
      }
    });
