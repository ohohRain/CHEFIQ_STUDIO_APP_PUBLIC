import { ref, uploadBytesResumable, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Storage Service
 * Handles all Firebase Storage operations for images
 * Aligned with storage.rules and Phase 5 requirements
 *
 * Features:
 * - Upload to Firebase Storage with progress tracking
 * - Download URL retrieval for Firestore
 * - Image deletion with cleanup
 * - Comprehensive error handling
 */

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Generate unique filename with timestamp and random string
 * @param {string} prefix - Filename prefix (e.g., 'cover', 'step_0', 'avatar')
 * @param {string} extension - File extension (default: 'jpg')
 * @returns {string} Unique filename
 * @private
 */
const _generateFileName = (prefix, extension = 'jpg') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}.${extension}`;
};

/**
 * Validate image file
 * @param {string} imageUri - Image URI to validate
 * @returns {Promise<void>}
 * @private
 */
const _validateImage = async (imageUri) => {
  if (!imageUri) {
    throw {
      code: 'storage/invalid-uri',
      message: 'Image URI is required',
    };
  }

  // Check if it's a valid URI format
  if (!imageUri.startsWith('file://') && !imageUri.startsWith('content://') && !imageUri.startsWith('data:')) {
    throw {
      code: 'storage/invalid-format',
      message: 'Invalid image URI format',
    };
  }
};

/**
 * Upload image blob to Firebase Storage
 * @param {string} storagePath - Storage path (e.g., 'recipes/123/cover.jpg')
 * @param {Blob} blob - Image blob to upload
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<object>} Upload result with downloadURL and storagePath
 * @private
 */
const _uploadBlob = async (storagePath, blob, onProgress = null) => {
  try {
    console.log('[Storage] Uploading to path:', storagePath);

    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress tracking (0-1 range for callback)
          const progress = snapshot.bytesTransferred / snapshot.totalBytes;
          console.log(`[Storage] Upload progress: ${(progress * 100).toFixed(1)}%`);

          // Call progress callback if provided
          if (onProgress) {
            onProgress(progress);
          }
        },
        (error) => {
          // Upload error
          console.error('[Storage] Upload failed:', error);

          let errorCode = 'storage/upload-failed';
          let errorMessage = 'Failed to upload image. Please try again.';

          if (error.code === 'storage/unauthorized') {
            errorCode = 'storage/permission-denied';
            errorMessage = 'You do not have permission to upload this image.';
          } else if (error.code === 'storage/canceled') {
            errorCode = 'storage/upload-cancelled';
            errorMessage = 'Upload was cancelled.';
          } else if (error.code === 'storage/quota-exceeded') {
            errorCode = 'storage/quota-exceeded';
            errorMessage = 'Storage quota exceeded. Please contact support.';
          }

          reject({ code: errorCode, message: errorMessage });
        },
        async () => {
          // Upload complete - get download URL
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('[Storage] Upload complete. Download URL:', downloadURL);

            resolve({
              downloadURL,
              storagePath,
            });
          } catch (error) {
            console.error('[Storage] Failed to get download URL:', error);
            reject({
              code: 'storage/url-failed',
              message: 'Upload succeeded but failed to get download URL.',
            });
          }
        }
      );
    });
  } catch (error) {
    console.error('[Storage] Upload blob error:', error);
    throw {
      code: 'storage/upload-error',
      message: error.message || 'Failed to upload image.',
    };
  }
};

/**
 * Convert image URI to Blob for upload
 * @param {string} imageUri - Local image URI
 * @returns {Promise<Blob>} Image blob
 * @private
 */
const _uriToBlob = async (imageUri) => {
  try {
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Validate blob size
    if (blob.size > MAX_FILE_SIZE) {
      throw {
        code: 'storage/file-too-large',
        message: `Image size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`,
      };
    }

    return blob;
  } catch (error) {
    if (error.code) throw error; // Re-throw our custom errors

    console.error('[Storage] Failed to convert URI to blob:', error);
    throw {
      code: 'storage/conversion-failed',
      message: 'Failed to process image file.',
    };
  }
};

/**
 * Upload recipe cover image
 * @param {string} recipeId - Recipe ID
 * @param {string} imageUri - Local image URI from camera/gallery
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<object>} { success, data: { downloadURL, storagePath }, error }
 */
export const uploadRecipeCoverImage = async (recipeId, imageUri, onProgress = null) => {
  try {
    console.log('[Storage] uploadRecipeCoverImage - recipeId:', recipeId);

    // Validate inputs
    if (!recipeId) {
      throw {
        code: 'storage/invalid-recipe-id',
        message: 'Recipe ID is required',
      };
    }

    await _validateImage(imageUri);

    // Convert to blob
    const blob = await _uriToBlob(imageUri);

    // Generate storage path
    const fileName = _generateFileName('cover');
    const storagePath = `recipes/${recipeId}/${fileName}`;

    // Upload to Firebase Storage
    const result = await _uploadBlob(storagePath, blob, onProgress);

    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    console.error('[Storage] uploadRecipeCoverImage error:', error);
    return {
      success: false,
      data: null,
      error: {
        code: error.code || 'storage/unknown-error',
        message: error.message || 'Failed to upload cover image',
      },
    };
  }
};

/**
 * Upload recipe step image
 * @param {string} recipeId - Recipe ID
 * @param {number} stepIndex - Step index (0-based)
 * @param {string} imageUri - Local image URI from camera/gallery
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<object>} { success, data: { downloadURL, storagePath }, error }
 */
export const uploadRecipeStepImage = async (recipeId, stepIndex, imageUri, onProgress = null) => {
  try {
    console.log('[Storage] uploadRecipeStepImage - recipeId:', recipeId, 'stepIndex:', stepIndex);

    // Validate inputs
    if (!recipeId) {
      throw {
        code: 'storage/invalid-recipe-id',
        message: 'Recipe ID is required',
      };
    }

    if (typeof stepIndex !== 'number' || stepIndex < 0) {
      throw {
        code: 'storage/invalid-step-index',
        message: 'Valid step index is required',
      };
    }

    await _validateImage(imageUri);

    // Convert to blob
    const blob = await _uriToBlob(imageUri);

    // Generate storage path
    const fileName = _generateFileName(`step_${stepIndex}`);
    const storagePath = `recipes/${recipeId}/${fileName}`;

    // Upload to Firebase Storage
    const result = await _uploadBlob(storagePath, blob, onProgress);

    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    console.error('[Storage] uploadRecipeStepImage error:', error);
    return {
      success: false,
      data: null,
      error: {
        code: error.code || 'storage/unknown-error',
        message: error.message || 'Failed to upload step image',
      },
    };
  }
};

/**
 * Upload user avatar image
 * Note: Storage path is /avatars/{userId}/ per storage.rules
 * @param {string} userId - User ID
 * @param {string} imageUri - Local image URI from camera/gallery
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<object>} { success, data: { downloadURL, storagePath }, error }
 */
export const uploadUserAvatar = async (userId, imageUri, onProgress = null) => {
  try {
    console.log('[Storage] uploadUserAvatar - userId:', userId);

    // Validate inputs
    if (!userId) {
      throw {
        code: 'storage/invalid-user-id',
        message: 'User ID is required',
      };
    }

    await _validateImage(imageUri);

    // Convert to blob
    const blob = await _uriToBlob(imageUri);

    // Generate storage path (per storage.rules: /avatars/{userId}/)
    const fileName = _generateFileName('avatar');
    const storagePath = `avatars/${userId}/${fileName}`;

    // Upload to Firebase Storage
    const result = await _uploadBlob(storagePath, blob, onProgress);

    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    console.error('[Storage] uploadUserAvatar error:', error);
    return {
      success: false,
      data: null,
      error: {
        code: error.code || 'storage/unknown-error',
        message: error.message || 'Failed to upload avatar',
      },
    };
  }
};

/**
 * Delete all images in a recipe folder
 * Useful when deleting a recipe
 * @param {string} recipeId - Recipe ID
 * @returns {Promise<object>} { success, data: { deletedCount }, error }
 */
export const deleteRecipeImages = async (recipeId) => {
  try {
    console.log('[Storage] deleteRecipeImages - recipeId:', recipeId);

    if (!recipeId) {
      throw {
        code: 'storage/invalid-recipe-id',
        message: 'Recipe ID is required',
      };
    }

    // List all files in recipe folder
    const folderRef = ref(storage, `recipes/${recipeId}`);
    const listResult = await listAll(folderRef);

    console.log(`[Storage] Found ${listResult.items.length} images to delete`);

    // Delete all files
    const deletePromises = listResult.items.map((itemRef) => {
      console.log('[Storage] Deleting:', itemRef.fullPath);
      return deleteObject(itemRef);
    });

    await Promise.all(deletePromises);

    console.log('[Storage] All recipe images deleted successfully');

    return {
      success: true,
      data: {
        deletedCount: listResult.items.length,
      },
      error: null,
    };
  } catch (error) {
    console.error('[Storage] deleteRecipeImages error:', error);

    // If folder doesn't exist, consider it success (already deleted)
    if (error.code === 'storage/object-not-found') {
      return {
        success: true,
        data: { deletedCount: 0 },
        error: null,
      };
    }

    return {
      success: false,
      data: null,
      error: {
        code: error.code || 'storage/delete-failed',
        message: error.message || 'Failed to delete recipe images',
      },
    };
  }
};

/**
 * Delete user avatar
 * Note: Deletes entire /avatars/{userId}/ folder per storage.rules
 * @param {string} userId - User ID
 * @returns {Promise<object>} { success, data: null, error }
 */
export const deleteUserAvatar = async (userId) => {
  try {
    console.log('[Storage] deleteUserAvatar - userId:', userId);

    if (!userId) {
      throw {
        code: 'storage/invalid-user-id',
        message: 'User ID is required',
      };
    }

    // List all files in user avatar folder
    const folderRef = ref(storage, `avatars/${userId}`);
    const listResult = await listAll(folderRef);

    console.log(`[Storage] Found ${listResult.items.length} avatar(s) to delete`);

    // Delete all files
    const deletePromises = listResult.items.map((itemRef) => {
      console.log('[Storage] Deleting:', itemRef.fullPath);
      return deleteObject(itemRef);
    });

    await Promise.all(deletePromises);

    console.log('[Storage] User avatar deleted successfully');

    return {
      success: true,
      data: null,
      error: null,
    };
  } catch (error) {
    console.error('[Storage] deleteUserAvatar error:', error);

    // If folder doesn't exist, consider it success (already deleted)
    if (error.code === 'storage/object-not-found') {
      return {
        success: true,
        data: null,
        error: null,
      };
    }

    return {
      success: false,
      data: null,
      error: {
        code: error.code || 'storage/delete-failed',
        message: error.message || 'Failed to delete avatar',
      },
    };
  }
};

/**
 * Delete specific image by storage path
 * @param {string} storagePath - Full storage path (e.g., 'recipes/123/cover_123.jpg')
 * @returns {Promise<object>} { success, data: null, error }
 */
export const deleteImage = async (storagePath) => {
  try {
    console.log('[Storage] deleteImage - path:', storagePath);

    if (!storagePath) {
      throw {
        code: 'storage/invalid-path',
        message: 'Storage path is required',
      };
    }

    const imageRef = ref(storage, storagePath);
    await deleteObject(imageRef);

    console.log('[Storage] Image deleted successfully');

    return {
      success: true,
      data: null,
      error: null,
    };
  } catch (error) {
    console.error('[Storage] deleteImage error:', error);

    // If file doesn't exist, consider it success (already deleted)
    if (error.code === 'storage/object-not-found') {
      return {
        success: true,
        data: null,
        error: null,
      };
    }

    return {
      success: false,
      data: null,
      error: {
        code: error.code || 'storage/delete-failed',
        message: error.message || 'Failed to delete image',
      },
    };
  }
};

// Export all methods as storageService object
const storageService = {
  uploadRecipeCoverImage,
  uploadRecipeStepImage,
  uploadUserAvatar,
  deleteRecipeImages,
  deleteUserAvatar,
  deleteImage,
};

export default storageService;
