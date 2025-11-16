/**
 * Comment System Cloud Functions
 * Phase 12: Comment System
 *
 * Triggers:
 * 1. onCommentCreate - Increment stats when comment created
 * 2. onCommentDelete - Decrement stats and cleanup when comment deleted
 * 3. onCommentLikeCreate - Increment stats when comment liked
 * 4. onCommentLikeDelete - Decrement stats when comment unliked
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * Trigger 1: onCommentCreate
 * Increments stats and creates notification when a comment is created
 *
 * Trigger: onCreate comments/{commentId}
 * Actions:
 * - Increment recipe.stats.commentsCount
 * - Update recipe.lastInteractionAt (for trending algorithm)
 * - If reply: Increment parent comment stats.repliesCount
 * - Create notification for recipe author (skip if self-comment)
 */
exports.onCommentCreate = functions.firestore
    .document("comments/{commentId}")
    .onCreate(async (snap, context) => {
      const startTime = Date.now();
      const commentId = context.params.commentId;

      try {
        const comment = snap.data();
        const { recipeId, authorId } = comment;

        if (!recipeId || !authorId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(
              `[onCommentCreate] ❌ Missing recipeId or authorId in comment ${commentId}`,
          );
          return { success: false, error: "Missing required fields", executionTime };
        }

        functions.logger.info(
            `[onCommentCreate] Comment created: ${commentId} on recipe ${recipeId}`,
        );

        // Get recipe to find recipe author
        const recipeRef = db.collection("recipes").doc(recipeId);
        const recipeDoc = await recipeRef.get();

        if (!recipeDoc.exists) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onCommentCreate] ❌ Recipe ${recipeId} not found`);
          return { success: false, error: "Recipe not found", executionTime };
        }

        const recipeData = recipeDoc.data();
        const recipeAuthorId = recipeData.authorId;

        // Prepare batch operations
        const updates = [];

        // 1. Increment recipe commentsCount
        updates.push(
            recipeRef.update({
              "stats.commentsCount": admin.firestore.FieldValue.increment(1),
              "lastInteractionAt": admin.firestore.FieldValue.serverTimestamp(),
            }),
        );

        // 2. Create notification for recipe author (skip if self-comment)
        if (recipeAuthorId !== authorId) {
          const notificationData = {
            recipientId: recipeAuthorId,
            senderId: authorId,
            type: "comment",
            relatedRecipeId: recipeId,
            relatedCommentId: commentId,
            message: `${comment.authorUsername} commented on your recipe`,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          updates.push(db.collection("notifications").add(notificationData));
          functions.logger.info(
              `[onCommentCreate] Creating notification for recipe author ${recipeAuthorId}`,
          );
        }

        // Execute all updates in parallel
        await Promise.all(updates);

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onCommentCreate] ✅ Updated stats for recipe ${recipeId} and created notification in ${executionTime}ms`,
        );

        return { success: true, recipeId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onCommentCreate] ❌ Error processing comment ${commentId}:`,
            error,
        );
        functions.logger.error(`[onCommentCreate] Execution time: ${executionTime}ms`);

        return { success: false, error: error.message, executionTime };
      }
    });

/**
 * Trigger 2: onCommentDelete
 * Decrements stats and cleans up related data when a comment is deleted
 *
 * Trigger: onDelete comments/{commentId}
 * Actions:
 * - Decrement recipe.stats.commentsCount
 * - Delete all comment_likes for this comment
 */
exports.onCommentDelete = functions.firestore
    .document("comments/{commentId}")
    .onDelete(async (snap, context) => {
      const startTime = Date.now();
      const commentId = context.params.commentId;

      try {
        const comment = snap.data();
        const { recipeId } = comment;

        if (!recipeId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(
              `[onCommentDelete] ❌ Missing recipeId in comment ${commentId}`,
          );
          return { success: false, error: "Missing recipeId", executionTime };
        }

        functions.logger.info(
            `[onCommentDelete] Comment deleted: ${commentId} from recipe ${recipeId}`,
        );

        // Prepare batch operations
        const updates = [];

        // 1. Decrement recipe commentsCount
        const recipeRef = db.collection("recipes").doc(recipeId);
        updates.push(
            recipeRef.update({
              "stats.commentsCount": admin.firestore.FieldValue.increment(-1),
            }),
        );

        // Execute stats updates first
        await Promise.all(updates);

        // 2. Delete all comment_likes for this comment
        const likesSnapshot = await db
            .collection("comment_likes")
            .where("commentId", "==", commentId)
            .get();

        if (!likesSnapshot.empty) {
          const likeBatch = db.batch();
          likesSnapshot.docs.forEach((doc) => likeBatch.delete(doc.ref));
          await likeBatch.commit();
          functions.logger.info(
              `[onCommentDelete] Deleted ${likesSnapshot.size} comment_likes for comment ${commentId}`,
          );
        }

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onCommentDelete] ✅ Completed cleanup for comment ${commentId} in ${executionTime}ms`,
        );

        return { success: true, commentId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onCommentDelete] ❌ Error cleaning up comment ${commentId}:`,
            error,
        );
        functions.logger.error(`[onCommentDelete] Execution time: ${executionTime}ms`);

        return { success: false, error: error.message, executionTime };
      }
    });

/**
 * Trigger 3: onCommentLikeCreate
 * Increments stats and creates notification when a comment is liked
 *
 * Trigger: onCreate comment_likes/{likeId}
 * Document ID format: {userId}_{commentId}
 * Actions:
 * - Increment comment.stats.likesCount
 * - Create notification for comment author (skip if self-like)
 */
exports.onCommentLikeCreate = functions.firestore
    .document("comment_likes/{likeId}")
    .onCreate(async (snap, context) => {
      const startTime = Date.now();
      const likeId = context.params.likeId;

      try {
        const likeData = snap.data();
        const { userId, commentId } = likeData;

        if (!userId || !commentId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(
              `[onCommentLikeCreate] ❌ Missing userId or commentId in like ${likeId}`,
          );
          return { success: false, error: "Missing required fields", executionTime };
        }

        functions.logger.info(
            `[onCommentLikeCreate] Comment like created: ${likeId} (user ${userId} → comment ${commentId})`,
        );

        // Get comment to find comment author and recipe
        const commentRef = db.collection("comments").doc(commentId);
        const commentDoc = await commentRef.get();

        if (!commentDoc.exists) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onCommentLikeCreate] ❌ Comment ${commentId} not found`);
          return { success: false, error: "Comment not found", executionTime };
        }

        const commentData = commentDoc.data();
        const commentAuthorId = commentData.authorId;
        const recipeId = commentData.recipeId;

        // Increment comment likesCount
        await commentRef.update({
          "stats.likesCount": admin.firestore.FieldValue.increment(1),
        });

        // Create notification for comment author (skip if self-like)
        if (commentAuthorId !== userId) {
          const liker = await db.collection("users").doc(userId).get();
          const likerUsername = liker.exists ? liker.data().username : "Someone";

          await db.collection("notifications").add({
            recipientId: commentAuthorId,
            senderId: userId,
            type: "comment_like",
            relatedRecipeId: recipeId,
            relatedCommentId: commentId,
            message: `${likerUsername} liked your comment`,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          functions.logger.info(
              `[onCommentLikeCreate] Created notification for comment author ${commentAuthorId}`,
          );
        }

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onCommentLikeCreate] ✅ Incremented likesCount for comment ${commentId} in ${executionTime}ms`,
        );

        return { success: true, commentId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onCommentLikeCreate] ❌ Error processing like ${likeId}:`,
            error,
        );
        functions.logger.error(`[onCommentLikeCreate] Execution time: ${executionTime}ms`);

        return { success: false, error: error.message, executionTime };
      }
    });

/**
 * Trigger 4: onCommentLikeDelete
 * Decrements stats when a comment like is removed
 *
 * Trigger: onDelete comment_likes/{likeId}
 * Document ID format: {userId}_{commentId}
 * Actions:
 * - Decrement comment.stats.likesCount
 */
exports.onCommentLikeDelete = functions.firestore
    .document("comment_likes/{likeId}")
    .onDelete(async (snap, context) => {
      const startTime = Date.now();
      const likeId = context.params.likeId;

      try {
        const likeData = snap.data();
        const { commentId } = likeData;

        if (!commentId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(
              `[onCommentLikeDelete] ❌ Missing commentId in like ${likeId}`,
          );
          return { success: false, error: "Missing commentId", executionTime };
        }

        functions.logger.info(
            `[onCommentLikeDelete] Comment like deleted: ${likeId}`,
        );

        // Decrement comment likesCount
        const commentRef = db.collection("comments").doc(commentId);
        await commentRef.update({
          "stats.likesCount": admin.firestore.FieldValue.increment(-1),
        });

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onCommentLikeDelete] ✅ Decremented likesCount for comment ${commentId} in ${executionTime}ms`,
        );

        return { success: true, commentId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onCommentLikeDelete] ❌ Error processing unlike ${likeId}:`,
            error,
        );
        functions.logger.error(`[onCommentLikeDelete] Execution time: ${executionTime}ms`);

        return { success: false, error: error.message, executionTime };
      }
    });
