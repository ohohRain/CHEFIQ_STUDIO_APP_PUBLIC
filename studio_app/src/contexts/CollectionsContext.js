import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { db } from '../config/firebase';
import collectionService from '../services/collectionService';

const CollectionsContext = createContext();

export const useCollections = () => {
  const context = useContext(CollectionsContext);
  if (!context) {
    throw new Error('useCollections must be used within CollectionsProvider');
  }
  return context;
};

export const CollectionsProvider = ({ children }) => {
  const { user } = useAuth();

  // State
  const [collections, setCollections] = useState([]);
  const [collectionRecipes, setCollectionRecipes] = useState([]); // For local cache
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Real-time listener for collections (auto-updates stats)
  useEffect(() => {
    if (!user || !user.uid) {
      // Clear state when user logs out
      setCollections([]);
      setCollectionRecipes([]);
      return;
    }

    console.log('[CollectionsContext] Setting up real-time collections listener for user:', user.uid);

    // Set up real-time listener
    const collectionsQuery = query(
      collection(db, 'collections'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      collectionsQuery,
      (snapshot) => {
        const updatedCollections = snapshot.docs.map(doc => ({
          collectionId: doc.id,
          ...doc.data()
        }));

        setCollections(updatedCollections);
        console.log(`✅ [CollectionsContext] Real-time update: ${updatedCollections.length} collections`, {
          timestamp: new Date().toISOString(),
          collections: updatedCollections.map(c => ({
            id: c.collectionId,
            name: c.name,
            recipesCount: c.stats?.recipesCount || 0
          }))
        });
      },
      (error) => {
        console.error('[CollectionsContext] Real-time listener error:', error);
        setError(error.message);
      }
    );

    return () => {
      console.log('[CollectionsContext] Cleaning up real-time listener');
      unsubscribe();
    };
  }, [user]);

  // Load user's collections from Firestore
  const loadUserCollections = async () => {
    if (!user || !user.uid) return;

    try {
      setLoading(true);
      setError(null);

      const result = await collectionService.getUserCollections(user.uid);

      if (result.success) {
        setCollections(result.data.collections);
        console.log(`✅ Loaded ${result.data.count} collections from Firestore`);
      } else {
        throw new Error(result.error.message);
      }
    } catch (err) {
      console.error('❌ Load collections error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get default collection
  const getDefaultCollection = () => {
    return collections.find(c => c.isDefault);
  };

  // Get user's collections (sorted by createdAt, default first)
  const getUserCollections = () => {
    return [...collections].sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      // Convert Timestamp to date for comparison
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateA - dateB;
    });
  };

  // Create new collection
  const createCollection = async (name, emoji, description = '') => {
    if (!user || !user.uid) {
      throw new Error('User must be logged in to create a collection');
    }

    try {
      setLoading(true);
      setError(null);

      const result = await collectionService.createCollection(
        user.uid,
        name,
        emoji,
        description,
        false // isDefault
      );

      if (result.success) {
        // ✅ FIX: Removed manual state update - let onSnapshot real-time listener handle it
        // The real-time listener (lines 22-52) will automatically update state when Firestore changes
        // This prevents race condition that caused duplicate collections in UI
        console.log(`✅ Collection created: ${name} ${emoji}`);
        return result.data.collection;
      } else {
        throw new Error(result.error.message);
      }
    } catch (err) {
      console.error('❌ Create collection error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update collection
  const updateCollection = async (collectionId, updates) => {
    try {
      setLoading(true);
      setError(null);

      // Optimistic update
      const previousCollections = [...collections];
      setCollections(prev => prev.map(c => {
        if (c.collectionId === collectionId) {
          return { ...c, ...updates };
        }
        return c;
      }));

      const result = await collectionService.updateCollection(collectionId, updates);

      if (!result.success) {
        // Rollback on error
        setCollections(previousCollections);
        throw new Error(result.error.message);
      }

      console.log(`✅ Collection updated: ${collectionId}`);
    } catch (err) {
      console.error('❌ Update collection error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete collection (blocks default collection)
  const deleteCollection = async (collectionId) => {
    if (!user || !user.uid) {
      throw new Error('User must be logged in to delete a collection');
    }

    try {
      setLoading(true);
      setError(null);

      const collection = collections.find(c => c.collectionId === collectionId);

      if (!collection) {
        throw new Error('Collection not found');
      }

      if (collection.isDefault) {
        throw new Error('Cannot delete default collection');
      }

      // Optimistic delete
      const previousCollections = [...collections];
      const previousCollectionRecipes = [...collectionRecipes];

      setCollections(prev => prev.filter(c => c.collectionId !== collectionId));
      setCollectionRecipes(prev => prev.filter(cr => cr.collectionId !== collectionId));

      const result = await collectionService.deleteCollection(collectionId, user.uid);

      if (!result.success) {
        // Rollback on error
        setCollections(previousCollections);
        setCollectionRecipes(previousCollectionRecipes);
        throw new Error(result.error.message);
      }

      console.log(`✅ Collection deleted: ${collectionId} (${result.data.recipesRemoved} recipes removed)`);
      return true;
    } catch (err) {
      console.error('❌ Delete collection error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Save recipe to collection
  const saveRecipeToCollection = async (recipeId, collectionId) => {
    if (!user || !user.uid) {
      throw new Error('User must be logged in to save recipes');
    }

    try {
      setLoading(true);
      setError(null);

      // Optimistic update: Add to local cache
      const newSave = {
        documentId: `${collectionId}_${recipeId}`,
        collectionId,
        recipeId,
        userId: user.uid,
        savedAt: new Date()
      };

      const previousCollectionRecipes = [...collectionRecipes];
      const previousCollections = [...collections];

      // Find if recipe was in another collection (for move scenario)
      const oldCollectionRecipe = collectionRecipes.find(cr => cr.recipeId === recipeId);
      const oldCollectionId = oldCollectionRecipe?.collectionId;

      // Remove from old collection if exists
      setCollectionRecipes(prev => prev.filter(cr => cr.recipeId !== recipeId));
      // Add to new collection
      setCollectionRecipes(prev => [...prev, newSave]);

      // Optimistically update collection stats
      setCollections(prev => prev.map(c => {
        if (c.collectionId === collectionId) {
          // Increment target collection count (if not a move to same collection)
          return {
            ...c,
            stats: {
              ...c.stats,
              recipesCount: oldCollectionId !== collectionId ? c.stats.recipesCount + 1 : c.stats.recipesCount
            }
          };
        }
        if (oldCollectionId && c.collectionId === oldCollectionId) {
          // Decrement old collection count
          return {
            ...c,
            stats: {
              ...c.stats,
              recipesCount: Math.max(0, c.stats.recipesCount - 1)
            }
          };
        }
        return c;
      }));

      const result = await collectionService.saveRecipeToCollection(
        collectionId,
        recipeId,
        user.uid
      );

      if (!result.success) {
        // Rollback on error
        setCollectionRecipes(previousCollectionRecipes);
        setCollections(previousCollections);
        throw new Error(result.error.message);
      }

      // Note: Cloud Function will also update stats.recipesCount
      // Our optimistic update provides instant feedback, Cloud Function ensures consistency
      console.log(`✅ Recipe saved: ${recipeId} → ${collectionId}`);

      if (result.data.movedFrom) {
        console.log(`🔄 Recipe moved from ${result.data.movedFrom}`);
      }

      return newSave;
    } catch (err) {
      console.error('❌ Save recipe error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Remove recipe from collection
  const removeRecipeFromCollection = async (recipeId, collectionId = null) => {
    if (!user || !user.uid) {
      throw new Error('User must be logged in to remove recipes');
    }

    try {
      setLoading(true);
      setError(null);

      let targetCollectionId = collectionId;

      // If collectionId not provided, query Firestore to find it
      if (!targetCollectionId) {
        console.log('🔍 CollectionId not provided, querying Firestore...');
        const result = await collectionService.getRecipeCollection(recipeId, user.uid);

        if (result.success && result.data.collectionId) {
          targetCollectionId = result.data.collectionId;
          console.log(`✅ Found recipe in collection: ${targetCollectionId}`);
        } else {
          throw new Error('Recipe not saved to any collection');
        }
      }

      // Optimistic update
      const previousCollectionRecipes = [...collectionRecipes];
      const previousCollections = [...collections];

      setCollectionRecipes(prev => prev.filter(cr => cr.recipeId !== recipeId));

      // Optimistically decrement collection stats
      setCollections(prev => prev.map(c => {
        if (c.collectionId === targetCollectionId) {
          return {
            ...c,
            stats: {
              ...c.stats,
              recipesCount: Math.max(0, c.stats.recipesCount - 1)
            }
          };
        }
        return c;
      }));

      const result = await collectionService.removeRecipeFromCollection(
        targetCollectionId,
        recipeId
      );

      if (!result.success) {
        // Rollback on error
        setCollectionRecipes(previousCollectionRecipes);
        setCollections(previousCollections);
        throw new Error(result.error.message);
      }

      // Note: Cloud Function will also update stats.recipesCount
      // Our optimistic update provides instant feedback, Cloud Function ensures consistency
      console.log(`✅ Recipe removed: ${recipeId} from ${targetCollectionId}`);
      return true;
    } catch (err) {
      console.error('❌ Remove recipe error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get which collection a recipe is saved to (null if not saved)
  const getRecipeCollection = async (recipeId) => {
    if (!user || !user.uid) {
      return null;
    }

    try {
      // Fetch from Firestore (always fresh data)
      const result = await collectionService.getRecipeCollection(recipeId, user.uid);

      if (result.success) {
        return result.data.collectionId;
      }

      return null;
    } catch (err) {
      console.error('❌ Get recipe collection error:', err);
      return null;
    }
  };

  // Get all recipe IDs in a collection (paginated)
  const getCollectionRecipes = async (collectionId, limit = 20, lastVisible = null) => {
    if (!user || !user.uid) {
      console.error('❌ User not authenticated for getCollectionRecipes');
      return { recipeIds: [], lastVisible: null, hasMore: false };
    }

    try {
      setLoading(true);
      setError(null);

      const result = await collectionService.getCollectionRecipes(
        collectionId,
        user.uid, // Add userId parameter
        limit,
        lastVisible
      );

      if (result.success) {
        console.log(`✅ Fetched ${result.data.count} recipes from collection ${collectionId}`);
        return result.data; // { recipeIds, lastVisible, hasMore }
      } else {
        throw new Error(result.error.message);
      }
    } catch (err) {
      console.error('❌ Get collection recipes error:', err);
      setError(err.message);
      return { recipeIds: [], lastVisible: null, hasMore: false };
    } finally {
      setLoading(false);
    }
  };

  // Check if recipe is saved (returns boolean) - uses cache or queries Firestore
  const isRecipeSaved = async (recipeId) => {
    if (!user || !user.uid) {
      return false;
    }

    try {
      // Query Firestore (always fresh data)
      const result = await collectionService.checkIfSaved(recipeId, user.uid);

      if (result.success) {
        return result.data.isSaved;
      }

      return false;
    } catch (err) {
      console.error('❌ Check if saved error:', err);
      return false;
    }
  };

  // Get collection by ID
  const getCollection = (collectionId) => {
    return collections.find(c => c.collectionId === collectionId);
  };

  // Refresh collections from Firestore
  const refreshCollections = async () => {
    await loadUserCollections();
  };

  const value = {
    // State
    collections,
    collectionRecipes,
    loading,
    error,

    // Collections CRUD
    getUserCollections,
    getDefaultCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    getCollection,
    refreshCollections,

    // Recipe-Collection relationship
    saveRecipeToCollection,
    removeRecipeFromCollection,
    getRecipeCollection,
    getCollectionRecipes,
    isRecipeSaved
  };

  return (
    <CollectionsContext.Provider value={value}>
      {children}
    </CollectionsContext.Provider>
  );
};
