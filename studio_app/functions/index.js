/**
 * Cloud Functions for ChefiQ Studio App
 * Phase 4: Core Triggers
 * Phase 8: Like System
 * Phase 9.2: Collections & Save System
 * Phase 10: Trending Algorithm
 * Follow System
 * Page 12: Notifications System
 *
 * Note: Phase 7 View Tracking uses direct client-side increment (no Cloud Function)
 *
 * Triggers:
 * 1. onUserCreate - DISABLED (requirement change: users must manually create collections)
 * 2a. onRecipeCreate - Increment stats when recipe created as published
 * 2b. onRecipeUpdate - Update stats on recipe publish/unpublish
 * 3. onRecipeDelete - Decrement stats and cleanup Storage images
 * 4. onLikeCreate - Increment recipe likesCount + author likesReceived
 * 5. onLikeDelete - Decrement recipe likesCount + author likesReceived
 * 6. onCollectionRecipeSave - Increment stats when recipe saved to collection
 * 7. onCollectionRecipeRemove - Decrement stats when recipe removed from collection
 * 8. onCollectionDelete - Cascade delete collection_recipes when collection deleted
 * 9. onFollowCreate - Increment follower/following counts
 * 10. onFollowDelete - Decrement follower/following counts
 * 11. onLikeCreateNotification - Create notification when someone likes a recipe
 * 12. onSaveRecipeNotification - Create notification when someone saves a recipe
 * 13. onFollowCreateNotification - Create notification when someone follows a user
 * 14. cleanupOldNotifications - Scheduled cleanup of notifications older than 30 days
 * 15. updateTrendingScores - Scheduled daily trending score calculation (midnight Chicago Time)
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

/**
 * Trigger 1: onUserCreate - DISABLED
 *
 * REQUIREMENT CHANGE (2025-10-28):
 * Users should NOT have a default collection auto-created.
 * Instead, users must manually create their first collection when they try to save a recipe.
 *
 * REASON:
 * - Better UX: Users get to name their own first collection instead of generic "Saved Recipes"
 * - UI handles empty state: SaveToCollectionSheet.js shows "No collections yet" with "Create Collection" button
 * - Existing users unaffected: Keep their existing "Saved Recipes" collection
 *
 * CODE PRESERVED: Keeping this code commented out for reference and potential rollback.
 *
 * Original behavior:
 * - Triggered: onCreate users/{userId}
 * - Actions: Create default collection with name "Saved Recipes", emoji "⭐", isDefault: true
 */

// DISABLED: Do not auto-create default collection for new users
// exports.onUserCreate = functions.firestore
//     .document("users/{userId}")
//     .onCreate(async (snap, context) => {
//       const startTime = Date.now();
//       const userId = context.params.userId;
//
//       try {
//         functions.logger.info(`[onUserCreate] Creating default collection for user: ${userId}`);
//
//         // Check if default collection already exists (idempotency)
//         const existingDefault = await db.collection("collections")
//             .where("userId", "==", userId)
//             .where("isDefault", "==", true)
//             .limit(1)
//             .get();
//
//         if (!existingDefault.empty) {
//           const existingId = existingDefault.docs[0].id;
//           functions.logger.info(`[onUserCreate] ✅ Default collection already exists: ${existingId}`);
//           const executionTime = Date.now() - startTime;
//           return { success: true, collectionId: existingId, alreadyExists: true, executionTime };
//         }
//
//         // Create default "Saved Recipes" collection
//         const collectionRef = await db.collection("collections").add({
//           userId: userId,
//           name: "Saved Recipes",
//           emoji: "⭐",
//           description: "My saved recipes",
//           isDefault: true,
//           stats: {
//             recipesCount: 0,
//           },
//           createdAt: admin.firestore.FieldValue.serverTimestamp(),
//           updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//         });
//
//         const executionTime = Date.now() - startTime;
//         functions.logger.info(
//             `[onUserCreate] ✅ Created collection ${collectionRef.id} for user ${userId} in ${executionTime}ms`,
//         );
//
//         return { success: true, collectionId: collectionRef.id, executionTime };
//       } catch (error) {
//         const executionTime = Date.now() - startTime;
//         functions.logger.error(
//             `[onUserCreate] ❌ Error creating collection for user ${userId}:`,
//             error,
//         );
//         functions.logger.error(`[onUserCreate] Execution time: ${executionTime}ms`);
//
//         // Don't throw - allow user creation to succeed even if collection creation fails
//         // User can manually create collections later
//         return { success: false, error: error.message, executionTime };
//       }
//     });

/**
 * Trigger 2a: onRecipeCreate
 * Increments user recipe count when a recipe is created with status='published'
 *
 * Trigger: onCreate recipes/{recipeId}
 * Actions:
 * - Increment stats.recipesCount if recipe created with status='published'
 * - Skip if created as draft (will increment when published later)
 */
exports.onRecipeCreate = functions.firestore
    .document("recipes/{recipeId}")
    .onCreate(async (snap, context) => {
      const startTime = Date.now();
      const recipeId = context.params.recipeId;

      try {
        const recipeData = snap.data();
        const authorId = recipeData.authorId;
        const status = recipeData.status;

        // Validate authorId exists
        if (!authorId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onRecipeCreate] ❌ Missing authorId for recipe ${recipeId}`);
          return { success: false, error: "Missing authorId", executionTime };
        }

        functions.logger.info(`[onRecipeCreate] Recipe ${recipeId} created with status: ${status}`);

        // Only increment if created as published
        if (status === "published") {
          await db
              .collection("users")
              .doc(authorId)
              .update({
                "stats.recipesCount": admin.firestore.FieldValue.increment(1),
              });

          const executionTime = Date.now() - startTime;
          functions.logger.info(
              `[onRecipeCreate] ✅ Incremented stats.recipesCount for user ${authorId} in ${executionTime}ms`,
          );

          return { success: true, incrementValue: 1, executionTime };
        } else {
          functions.logger.info(`[onRecipeCreate] Recipe ${recipeId} created as draft - no stats update`);
          return { success: true, incrementValue: 0, executionTime: Date.now() - startTime };
        }
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onRecipeCreate] ❌ Error updating stats for recipe ${recipeId}:`,
            error,
        );
        functions.logger.error(`[onRecipeCreate] Execution time: ${executionTime}ms`);

        // Don't throw - allow recipe creation to succeed even if stats update fails
        return { success: false, error: error.message, executionTime };
      }
    });

/**
 * Trigger 2b: onRecipeUpdate
 * Updates user recipe count when recipe status changes between draft/published
 *
 * Trigger: onUpdate recipes/{recipeId}
 * Actions:
 * - Increment stats.recipesCount when draft → published
 * - Decrement stats.recipesCount when published → draft
 * - No change for other status transitions or updates
 */
exports.onRecipeUpdate = functions.firestore
    .document("recipes/{recipeId}")
    .onUpdate(async (change, context) => {
      const startTime = Date.now();
      const recipeId = context.params.recipeId;

      try {
        const beforeData = change.before.data();
        const afterData = change.after.data();

        const authorId = afterData.authorId;
        const beforeStatus = beforeData.status;
        const afterStatus = afterData.status;

        // Validate authorId exists
        if (!authorId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onRecipeUpdate] ❌ Missing authorId for recipe ${recipeId}`);
          return { success: false, error: "Missing authorId", executionTime };
        }

        functions.logger.info(
            `[onRecipeUpdate] Recipe ${recipeId} status change: ${beforeStatus} → ${afterStatus}`,
        );

        // Determine if we need to update stats
        let incrementValue = 0;

        if (beforeStatus === "draft" && afterStatus === "published") {
          // Draft → Published: increment
          incrementValue = 1;
          functions.logger.info(`[onRecipeUpdate] Recipe ${recipeId} published (draft → published)`);
        } else if (beforeStatus === "published" && afterStatus === "draft") {
          // Published → Draft: decrement
          incrementValue = -1;
          functions.logger.info(`[onRecipeUpdate] Recipe ${recipeId} unpublished (published → draft)`);
        } else {
          // No status change affecting public count
          functions.logger.info(`[onRecipeUpdate] Recipe ${recipeId} status unchanged - no stats update`);
          return null;
        }

        // Update user stats.recipesCount
        await db
            .collection("users")
            .doc(authorId)
            .update({
              "stats.recipesCount": admin.firestore.FieldValue.increment(incrementValue),
            });

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onRecipeUpdate] ✅ Updated stats.recipesCount for user ${authorId} ` +
                  `(${incrementValue > 0 ? "+" : ""}${incrementValue}) in ${executionTime}ms`,
        );

        return { success: true, incrementValue, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onRecipeUpdate] ❌ Error updating stats for recipe ${recipeId}:`,
            error,
        );
        functions.logger.error(`[onRecipeUpdate] Execution time: ${executionTime}ms`);

        // Don't throw - allow recipe update to succeed even if stats update fails
        return { success: false, error: error.message, executionTime };
      }
    });

/**
 * Trigger 3: onRecipeDelete
 * Decrements user stats and performs cascade cleanup when recipe deleted
 *
 * Trigger: onDelete recipes/{recipeId}
 * Actions:
 * - Decrement stats.recipesCount if recipe was published
 * - Decrement stats.likesReceived by recipe's likesCount
 * - Delete all images from Storage (coverImage + stepImages)
 * - Delete all orphaned likes documents
 * - Delete all orphaned collection_recipes documents
 * - Decrement stats.recipesCount for affected collections
 */
exports.onRecipeDelete = functions.firestore
    .document("recipes/{recipeId}")
    .onDelete(async (snap, context) => {
      const startTime = Date.now();
      const recipeId = context.params.recipeId;

      try {
        const recipeData = snap.data();
        const authorId = recipeData.authorId;
        const status = recipeData.status;
        const stats = recipeData.stats || {};
        const likesCount = stats.likesCount || 0;

        functions.logger.info(
            `[onRecipeDelete] Deleting recipe ${recipeId} (status: ${status}, likes: ${likesCount})`,
        );

        // Task 1: Decrement recipesCount and likesReceived if recipe was published
        if (status === "published") {
          await db
              .collection("users")
              .doc(authorId)
              .update({
                "stats.recipesCount": admin.firestore.FieldValue.increment(-1),
                "stats.likesReceived": admin.firestore.FieldValue.increment(-likesCount),
              });

          functions.logger.info(
              `[onRecipeDelete] ✅ Decremented stats.recipesCount (-1) and ` +
              `stats.likesReceived (-${likesCount}) for user ${authorId}`,
          );
        }

        // Task 2: Delete all images from Storage
        const bucket = storage.bucket();
        const prefix = `recipes/${recipeId}/`;

        functions.logger.info(`[onRecipeDelete] Deleting images with prefix: ${prefix}`);

        const [files] = await bucket.getFiles({ prefix });

        if (files.length === 0) {
          functions.logger.info(`[onRecipeDelete] No images found for recipe ${recipeId}`);
        } else {
          functions.logger.info(`[onRecipeDelete] Found ${files.length} images to delete`);

          // Use Promise.allSettled for resilience (continue even if some deletions fail)
          const deleteResults = await Promise.allSettled(
              files.map((file) => file.delete()),
          );

          // Log results
          const successCount = deleteResults.filter((r) => r.status === "fulfilled").length;
          const failureCount = deleteResults.filter((r) => r.status === "rejected").length;

          functions.logger.info(
              `[onRecipeDelete] Image deletion results: ${successCount} succeeded, ${failureCount} failed`,
          );

          if (failureCount > 0) {
            const failures = deleteResults
                .filter((r) => r.status === "rejected")
                .map((r) => r.reason.message);
            functions.logger.warn(`[onRecipeDelete] Failed deletions: ${failures.join(", ")}`);
          }
        }

        // Task 3: Delete orphaned likes for this recipe
        const likesQuery = await db
            .collection("likes")
            .where("recipeId", "==", recipeId)
            .get();

        let likesDeleted = 0;

        if (!likesQuery.empty) {
          functions.logger.info(`[onRecipeDelete] Found ${likesQuery.size} likes to delete`);

          const deleteBatch = db.batch();
          likesQuery.docs.forEach((doc) => deleteBatch.delete(doc.ref));
          await deleteBatch.commit();

          likesDeleted = likesQuery.size;
          functions.logger.info(`[onRecipeDelete] ✅ Deleted ${likesDeleted} orphaned likes`);
        } else {
          functions.logger.info(`[onRecipeDelete] No likes found for recipe ${recipeId}`);
        }

        // Task 4: Delete orphaned collection_recipes (saved recipe references)
        const collectionRecipesQuery = await db
            .collection("collection_recipes")
            .where("recipeId", "==", recipeId)
            .get();

        let savesDeleted = 0;

        if (!collectionRecipesQuery.empty) {
          functions.logger.info(
              `[onRecipeDelete] Found ${collectionRecipesQuery.size} collection saves to delete`,
          );

          // Batch delete collection_recipes and decrement collection stats
          const savesBatch = db.batch();

          collectionRecipesQuery.docs.forEach((doc) => {
            const { collectionId } = doc.data();

            // Delete collection_recipes document
            savesBatch.delete(doc.ref);

            // Decrement collection.stats.recipesCount
            const collectionRef = db.collection("collections").doc(collectionId);
            savesBatch.update(collectionRef, {
              "stats.recipesCount": admin.firestore.FieldValue.increment(-1),
              "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
            });
          });

          await savesBatch.commit();

          savesDeleted = collectionRecipesQuery.size;
          functions.logger.info(
              `[onRecipeDelete] ✅ Deleted ${savesDeleted} orphaned saves and updated collection stats`,
          );
        } else {
          functions.logger.info(`[onRecipeDelete] No saved collections found for recipe ${recipeId}`);
        }

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onRecipeDelete] ✅ Completed cleanup for recipe ${recipeId} in ${executionTime}ms`,
        );

        return {
          success: true,
          imagesDeleted: files.length,
          likesDeleted,
          savesDeleted,
          executionTime,
        };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onRecipeDelete] ❌ Error during cleanup for recipe ${recipeId}:`,
            error,
        );
        functions.logger.error(`[onRecipeDelete] Execution time: ${executionTime}ms`);

        // Don't throw - allow deletion to complete even if cleanup fails
        // Manual cleanup can be performed later if needed
        return { success: false, error: error.message, executionTime };
      }
    });

// ============================================================================
// PHASE 8: LIKE SYSTEM CLOUD FUNCTIONS
// ============================================================================

/**
 * Trigger 4: onLikeCreate
 * Increments recipe likesCount and author likesReceived when a like document is created
 *
 * Trigger: onCreate likes/{likeId}
 * Actions:
 * - Increment recipe.stats.likesCount
 * - Increment author user.stats.likesReceived
 * - Update recipe.lastInteractionAt for trending algorithm
 */
exports.onLikeCreate = functions.firestore
    .document("likes/{likeId}")
    .onCreate(async (snap, context) => {
      const startTime = Date.now();
      const likeId = context.params.likeId;

      try {
        const likeData = snap.data();
        const { recipeId, userId } = likeData;

        if (!recipeId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onLikeCreate] ❌ Missing recipeId in like document ${likeId}`);
          return { success: false, error: "Missing recipeId", executionTime };
        }

        functions.logger.info(`[onLikeCreate] Like created: ${likeId} (user ${userId} → recipe ${recipeId})`);

        // Get recipe to find authorId
        const recipeRef = db.collection("recipes").doc(recipeId);
        const recipeDoc = await recipeRef.get();

        if (!recipeDoc.exists) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onLikeCreate] ❌ Recipe ${recipeId} not found`);
          return { success: false, error: "Recipe not found", executionTime };
        }

        const recipeData = recipeDoc.data();
        const authorId = recipeData.authorId;

        if (!authorId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onLikeCreate] ❌ Recipe ${recipeId} missing authorId`);
          return { success: false, error: "Missing authorId", executionTime };
        }

        // Update both recipe stats and author stats in parallel
        const authorRef = db.collection("users").doc(authorId);

        await Promise.all([
          // Increment recipe likes count
          recipeRef.update({
            "stats.likesCount": admin.firestore.FieldValue.increment(1),
            "lastInteractionAt": admin.firestore.FieldValue.serverTimestamp(),
          }),
          // Increment author likes received count
          authorRef.update({
            "stats.likesReceived": admin.firestore.FieldValue.increment(1),
          }),
        ]);

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onLikeCreate] ✅ Incremented likes count for recipe ${recipeId} ` +
            `and likesReceived for author ${authorId} in ${executionTime}ms`,
        );

        return { success: true, recipeId, authorId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onLikeCreate] ❌ Error incrementing likes for ${likeId}:`,
            error,
        );
        functions.logger.error(`[onLikeCreate] Execution time: ${executionTime}ms`);

        // Don't throw - allow like creation to succeed even if stats update fails
        return { success: false, error: error.message, executionTime };
      }
    });

/**
 * Trigger 5: onLikeDelete
 * Decrements recipe likesCount and author likesReceived when a like document is deleted
 *
 * Trigger: onDelete likes/{likeId}
 * Actions:
 * - Decrement recipe.stats.likesCount
 * - Decrement author user.stats.likesReceived
 * - Update recipe.lastInteractionAt for trending algorithm
 */
exports.onLikeDelete = functions.firestore
    .document("likes/{likeId}")
    .onDelete(async (snap, context) => {
      const startTime = Date.now();
      const likeId = context.params.likeId;

      try {
        const likeData = snap.data();
        const { recipeId, userId } = likeData;

        if (!recipeId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onLikeDelete] ❌ Missing recipeId in like document ${likeId}`);
          return { success: false, error: "Missing recipeId", executionTime };
        }

        functions.logger.info(`[onLikeDelete] Like deleted: ${likeId} (user ${userId} → recipe ${recipeId})`);

        // Get recipe to find authorId
        const recipeRef = db.collection("recipes").doc(recipeId);
        const recipeDoc = await recipeRef.get();

        if (!recipeDoc.exists) {
          const executionTime = Date.now() - startTime;
          functions.logger.warn(
              `[onLikeDelete] ⚠️ Recipe ${recipeId} not found (may have been deleted)`,
          );
          // Continue to allow unlike even if recipe is gone
          return { success: true, recipeId, recipeDeleted: true, executionTime };
        }

        const recipeData = recipeDoc.data();
        const authorId = recipeData.authorId;

        if (!authorId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(`[onLikeDelete] ❌ Recipe ${recipeId} missing authorId`);
          return { success: false, error: "Missing authorId", executionTime };
        }

        // Update both recipe stats and author stats in parallel
        const authorRef = db.collection("users").doc(authorId);

        await Promise.all([
          // Decrement recipe likes count
          recipeRef.update({
            "stats.likesCount": admin.firestore.FieldValue.increment(-1),
            "lastInteractionAt": admin.firestore.FieldValue.serverTimestamp(),
          }),
          // Decrement author likes received count
          authorRef.update({
            "stats.likesReceived": admin.firestore.FieldValue.increment(-1),
          }),
        ]);

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onLikeDelete] ✅ Decremented likes count for recipe ${recipeId} ` +
            `and likesReceived for author ${authorId} in ${executionTime}ms`,
        );

        return { success: true, recipeId, authorId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onLikeDelete] ❌ Error decrementing likes for ${likeId}:`,
            error,
        );
        functions.logger.error(`[onLikeDelete] Execution time: ${executionTime}ms`);

        // Don't throw - allow like deletion to succeed even if stats update fails
        return { success: false, error: error.message, executionTime };
      }
    });

// ============================================================================
// PHASE 9.2: COLLECTIONS & SAVE SYSTEM CLOUD FUNCTIONS
// ============================================================================

/**
 * Trigger 6: onCollectionRecipeSave
 * Increments stats when a recipe is saved to a collection
 *
 * Trigger: onCreate collection_recipes/{documentId}
 * Document ID format: {collectionId}_{recipeId}
 * Actions:
 * - Increment collection.stats.recipesCount
 * - Increment recipe.stats.savesCount
 */
exports.onCollectionRecipeSave = functions.firestore
    .document("collection_recipes/{documentId}")
    .onCreate(async (snap, context) => {
      const startTime = Date.now();
      const documentId = context.params.documentId;

      try {
        const saveData = snap.data();
        const { collectionId, recipeId, userId } = saveData;

        if (!collectionId || !recipeId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(
              `[onCollectionRecipeSave] ❌ Missing collectionId or recipeId in document ${documentId}`,
          );
          return { success: false, error: "Missing required fields", executionTime };
        }

        functions.logger.info(
            `[onCollectionRecipeSave] Recipe saved: ${documentId} (user ${userId} → collection ${collectionId})`,
        );

        // Update both collection and recipe stats in parallel
        const collectionRef = db.collection("collections").doc(collectionId);
        const recipeRef = db.collection("recipes").doc(recipeId);

        await Promise.all([
          // Increment collection recipes count
          collectionRef.update({
            "stats.recipesCount": admin.firestore.FieldValue.increment(1),
            "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
          }),
          // Increment recipe saves count
          recipeRef.update({
            "stats.savesCount": admin.firestore.FieldValue.increment(1),
          }),
        ]);

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onCollectionRecipeSave] ✅ Updated stats for collection ${collectionId} ` +
            `and recipe ${recipeId} in ${executionTime}ms`,
        );

        return { success: true, collectionId, recipeId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onCollectionRecipeSave] ❌ Error updating stats for ${documentId}:`,
            error,
        );
        functions.logger.error(`[onCollectionRecipeSave] Execution time: ${executionTime}ms`);

        // Don't throw - allow save to succeed even if stats update fails
        return { success: false, error: error.message, executionTime };
      }
    });

/**
 * Trigger 7: onCollectionRecipeRemove
 * Decrements stats when a recipe is removed from a collection
 *
 * Trigger: onDelete collection_recipes/{documentId}
 * Document ID format: {collectionId}_{recipeId}
 * Actions:
 * - Decrement collection.stats.recipesCount
 * - Decrement recipe.stats.savesCount
 */
exports.onCollectionRecipeRemove = functions.firestore
    .document("collection_recipes/{documentId}")
    .onDelete(async (snap, context) => {
      const startTime = Date.now();
      const documentId = context.params.documentId;

      try {
        const saveData = snap.data();
        const { collectionId, recipeId, userId } = saveData;

        if (!collectionId || !recipeId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(
              `[onCollectionRecipeRemove] ❌ Missing collectionId or recipeId in document ${documentId}`,
          );
          return { success: false, error: "Missing required fields", executionTime };
        }

        functions.logger.info(
            `[onCollectionRecipeRemove] Recipe removed: ${documentId} (user ${userId} → collection ${collectionId})`,
        );

        // Update both collection and recipe stats in parallel
        const collectionRef = db.collection("collections").doc(collectionId);
        const recipeRef = db.collection("recipes").doc(recipeId);

        await Promise.all([
          // Decrement collection recipes count
          collectionRef.update({
            "stats.recipesCount": admin.firestore.FieldValue.increment(-1),
            "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
          }),
          // Decrement recipe saves count
          recipeRef.update({
            "stats.savesCount": admin.firestore.FieldValue.increment(-1),
          }),
        ]);

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onCollectionRecipeRemove] ✅ Decremented stats for collection ${collectionId} ` +
            `and recipe ${recipeId} in ${executionTime}ms`,
        );

        return { success: true, collectionId, recipeId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onCollectionRecipeRemove] ❌ Error decrementing stats for ${documentId}:`,
            error,
        );
        functions.logger.error(`[onCollectionRecipeRemove] Execution time: ${executionTime}ms`);

        // Don't throw - allow removal to succeed even if stats update fails
        return { success: false, error: error.message, executionTime };
      }
    });

/**
 * Trigger 8: onCollectionDelete
 * Cascade deletes collection_recipes when a collection is deleted
 *
 * Trigger: onDelete collections/{collectionId}
 * Actions:
 * - Delete all collection_recipes documents for this collection
 * - Update recipe.stats.savesCount for each removed recipe
 * Note: Client already handles cascade delete via batch, this is defensive
 */
exports.onCollectionDelete = functions.firestore
    .document("collections/{collectionId}")
    .onDelete(async (snap, context) => {
      const startTime = Date.now();
      const collectionId = context.params.collectionId;

      try {
        const collectionData = snap.data();
        const { userId, name, isDefault } = collectionData;

        if (isDefault) {
          functions.logger.warn(
              `[onCollectionDelete] ⚠️ Default collection deleted: ${collectionId} (should not happen)`,
          );
        }

        functions.logger.info(
            `[onCollectionDelete] Collection deleted: ${collectionId} (${name}) by user ${userId}`,
        );

        // Query all collection_recipes for this collection
        const collectionRecipesQuery = await db
            .collection("collection_recipes")
            .where("collectionId", "==", collectionId)
            .get();

        if (collectionRecipesQuery.empty) {
          const executionTime = Date.now() - startTime;
          functions.logger.info(
              `[onCollectionDelete] ✅ No recipes to remove for collection ${collectionId} in ${executionTime}ms`,
          );
          return { success: true, recipesRemoved: 0, executionTime };
        }

        const recipesCount = collectionRecipesQuery.size;
        functions.logger.info(
            `[onCollectionDelete] Found ${recipesCount} recipes to remove from collection ${collectionId}`,
        );

        // Batch delete collection_recipes documents and decrement recipe.stats.savesCount
        const batch = db.batch();

        collectionRecipesQuery.docs.forEach((doc) => {
          const { recipeId } = doc.data();

          // Delete collection_recipes document
          batch.delete(doc.ref);

          // Decrement recipe.stats.savesCount
          const recipeRef = db.collection("recipes").doc(recipeId);
          batch.update(recipeRef, {
            "stats.savesCount": admin.firestore.FieldValue.increment(-1),
          });
        });

        await batch.commit();

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onCollectionDelete] ✅ Cascade deleted ${recipesCount} recipes ` +
            `from collection ${collectionId} in ${executionTime}ms`,
        );

        return { success: true, recipesRemoved: recipesCount, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onCollectionDelete] ❌ Error during cascade delete for collection ${collectionId}:`,
            error,
        );
        functions.logger.error(`[onCollectionDelete] Execution time: ${executionTime}ms`);

        // Don't throw - allow collection deletion to complete
        // Stats can be recalculated if needed
        return { success: false, error: error.message, executionTime };
      }
    });

// ============================================================================
// PHASE 7: VIEW TRACKING - REMOVED (Using direct pageview increment instead)
// ============================================================================
// Note: View tracking now uses direct increment in client code (viewService.js)
// No Cloud Function needed for simple pageview counting
// Views collection and onViewCreate function removed in favor of simpler approach

// ============================================================================
// FOLLOW SYSTEM CLOUD FUNCTIONS
// ============================================================================

/**
 * Trigger 9: onFollowCreate
 * Increments follower/following counts when a follow relationship is created
 *
 * Trigger: onCreate follows/{followId}
 * Document ID format: {followerId}_{followingId}
 * Actions:
 * - Increment follower user.stats.followingCount
 * - Increment following user.stats.followersCount
 */
exports.onFollowCreate = functions.firestore
    .document("follows/{followId}")
    .onCreate(async (snap, context) => {
      const startTime = Date.now();
      const followId = context.params.followId;

      try {
        const followData = snap.data();
        const { followerId, followingId } = followData;

        if (!followerId || !followingId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(
              `[onFollowCreate] ❌ Missing followerId or followingId in document ${followId}`,
          );
          return { success: false, error: "Missing required fields", executionTime };
        }

        functions.logger.info(
            `[onFollowCreate] Follow created: ${followId} (user ${followerId} → user ${followingId})`,
        );

        // Update both users' stats in parallel
        const followerRef = db.collection("users").doc(followerId);
        const followingRef = db.collection("users").doc(followingId);

        await Promise.all([
          // Increment follower's following count
          followerRef.update({
            "stats.followingCount": admin.firestore.FieldValue.increment(1),
          }),
          // Increment following's followers count
          followingRef.update({
            "stats.followersCount": admin.firestore.FieldValue.increment(1),
          }),
        ]);

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onFollowCreate] ✅ Incremented followingCount for user ${followerId} ` +
            `and followersCount for user ${followingId} in ${executionTime}ms`,
        );

        return { success: true, followerId, followingId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onFollowCreate] ❌ Error updating stats for ${followId}:`,
            error,
        );
        functions.logger.error(`[onFollowCreate] Execution time: ${executionTime}ms`);

        // Don't throw - allow follow creation to succeed even if stats update fails
        return { success: false, error: error.message, executionTime };
      }
    });

/**
 * Trigger 10: onFollowDelete
 * Decrements follower/following counts when a follow relationship is deleted
 *
 * Trigger: onDelete follows/{followId}
 * Document ID format: {followerId}_{followingId}
 * Actions:
 * - Decrement follower user.stats.followingCount
 * - Decrement following user.stats.followersCount
 */
exports.onFollowDelete = functions.firestore
    .document("follows/{followId}")
    .onDelete(async (snap, context) => {
      const startTime = Date.now();
      const followId = context.params.followId;

      try {
        const followData = snap.data();
        const { followerId, followingId } = followData;

        if (!followerId || !followingId) {
          const executionTime = Date.now() - startTime;
          functions.logger.error(
              `[onFollowDelete] ❌ Missing followerId or followingId in document ${followId}`,
          );
          return { success: false, error: "Missing required fields", executionTime };
        }

        functions.logger.info(
            `[onFollowDelete] Follow deleted: ${followId} (user ${followerId} → user ${followingId})`,
        );

        // Update both users' stats in parallel
        const followerRef = db.collection("users").doc(followerId);
        const followingRef = db.collection("users").doc(followingId);

        await Promise.all([
          // Decrement follower's following count
          followerRef.update({
            "stats.followingCount": admin.firestore.FieldValue.increment(-1),
          }),
          // Decrement following's followers count
          followingRef.update({
            "stats.followersCount": admin.firestore.FieldValue.increment(-1),
          }),
        ]);

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[onFollowDelete] ✅ Decremented followingCount for user ${followerId} ` +
            `and followersCount for user ${followingId} in ${executionTime}ms`,
        );

        return { success: true, followerId, followingId, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            `[onFollowDelete] ❌ Error decrementing stats for ${followId}:`,
            error,
        );
        functions.logger.error(`[onFollowDelete] Execution time: ${executionTime}ms`);

        // Don't throw - allow follow deletion to succeed even if stats update fails
        return { success: false, error: error.message, executionTime };
      }
    });

// ============================================================================
// PAGE 12: NOTIFICATIONS SYSTEM CLOUD FUNCTIONS
// ============================================================================

// Import notification functions from separate module
const notificationFunctions = require("./notifications");

// Export notification triggers
exports.onLikeCreateNotification = notificationFunctions.onLikeCreateNotification;
exports.onSaveRecipeNotification = notificationFunctions.onSaveRecipeNotification;
exports.onFollowCreateNotification = notificationFunctions.onFollowCreateNotification;
exports.cleanupOldNotifications = notificationFunctions.cleanupOldNotifications;

// ============================================================================
// PHASE 12: COMMENT SYSTEM CLOUD FUNCTIONS
// ============================================================================

// Import comment functions from separate module
const commentFunctions = require("./commentFunctions");

// Export comment triggers
exports.onCommentCreate = commentFunctions.onCommentCreate;
exports.onCommentDelete = commentFunctions.onCommentDelete;
exports.onCommentLikeCreate = commentFunctions.onCommentLikeCreate;
exports.onCommentLikeDelete = commentFunctions.onCommentLikeDelete;

// ============================================================================
// PHASE 10: TRENDING ALGORITHM - SCHEDULED FUNCTION
// ============================================================================

/**
 * Scheduled Function: updateTrendingScores
 * Updates trending scores for all published recipes every 5 minutes
 *
 * Schedule: Every 5 minutes (for testing/development)
 * Trigger: Cloud Scheduler (Pub/Sub)
 * Formula: trendingScore = (likesCount * 2 + commentsCount * 3 + viewsCount * 0.1) / daysSincePublished
 *
 * Optimization (v3.0):
 * - Only processes recipes with lastInteractionAt within last 30 days
 * - Reduces execution time by ~80% (500 recipes → 100 recipes for 50 users)
 * - Older recipes naturally decay to low scores and aren't worth recalculating
 *
 * Actions:
 * - Query published recipes active in last 30 days
 * - Calculate trending score based on engagement metrics and age
 * - Batch update trendingScore field for efficient writes
 * - Log execution summary for monitoring
 */
exports.updateTrendingScores = functions.pubsub
    .schedule("*/5 * * * *") // Cron: Every 5 minutes
    .timeZone("America/Chicago") // Chicago Time Zone (Central Time)
    .onRun(async (context) => {
      const startTime = Date.now();

      try {
        functions.logger.info("[updateTrendingScores] Starting scheduled trending score calculation");

        const now = admin.firestore.Timestamp.now();

        // Query ALL published recipes (removed 30-day filter to ensure all recipes get scored)
        // Note: The 30-day optimization can be re-enabled once lastInteractionAt is populated
        const recipesSnapshot = await db
            .collection("recipes")
            .where("status", "==", "published")
            .get();

        functions.logger.info(`[updateTrendingScores] Querying all published recipes (no time filter)`);

        if (recipesSnapshot.empty) {
          const executionTime = Date.now() - startTime;
          functions.logger.info(
              `[updateTrendingScores] ✅ No published recipes found. Execution time: ${executionTime}ms`,
          );
          return null;
        }

        functions.logger.info(`[updateTrendingScores] Found ${recipesSnapshot.size} published recipes to process`);

        // Process recipes in batches (Firestore batch limit: 500 operations)
        const batchSize = 500;
        let totalUpdated = 0;
        let currentBatch = db.batch();
        let operationsInBatch = 0;
        let debugCount = 0; // Log first 3 recipes for debugging

        recipesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const stats = data.stats || {};

          // Calculate days since published
          const publishedAt = data.publishedAt || data.createdAt;
          if (!publishedAt) {
            functions.logger.warn(
                `[updateTrendingScores] ⚠️ Recipe ${doc.id} has no publishedAt or createdAt, skipping`,
            );
            return;
          }

          const publishedMillis = publishedAt.toMillis();
          const daysSincePublished = Math.max(1, (now.toMillis() - publishedMillis) / (1000 * 60 * 60 * 24));

          // Calculate trending score
          // Formula: (likes * 2 + comments * 3 + views * 0.1) / days_old
          const likesCount = stats.likesCount || 0;
          const commentsCount = stats.commentsCount || 0;
          const viewsCount = stats.viewsCount || 0;

          const trendingScore =
              (likesCount * 2 + commentsCount * 3 + viewsCount * 0.1) / daysSincePublished;

          // Debug log first 3 recipes
          if (debugCount < 3) {
            functions.logger.info(
                `[updateTrendingScores] DEBUG Recipe ${debugCount + 1}: "${data.title}" | ` +
                `Likes: ${likesCount}, Comments: ${commentsCount}, Views: ${viewsCount} | ` +
                `Days old: ${daysSincePublished.toFixed(1)} | Score: ${trendingScore.toFixed(2)}`,
            );
            debugCount++;
          }

          // Add to batch
          currentBatch.update(doc.ref, { trendingScore });
          operationsInBatch++;
          totalUpdated++;

          // Commit batch if limit reached
          if (operationsInBatch >= batchSize) {
            currentBatch.commit();
            currentBatch = db.batch();
            operationsInBatch = 0;
          }
        });

        // Commit final batch if it has operations
        if (operationsInBatch > 0) {
          await currentBatch.commit();
        }

        const executionTime = Date.now() - startTime;
        functions.logger.info(
            `[updateTrendingScores] ✅ Updated trending scores for ${totalUpdated} recipes in ${executionTime}ms`,
        );

        return { success: true, recipesUpdated: totalUpdated, executionTime };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        functions.logger.error(
            "[updateTrendingScores] ❌ Error updating trending scores:",
            error,
        );
        functions.logger.error(`[updateTrendingScores] Execution time: ${executionTime}ms`);

        // Don't throw - allow scheduled function to complete
        // Will retry on next scheduled run
        return { success: false, error: error.message, executionTime };
      }
    });
