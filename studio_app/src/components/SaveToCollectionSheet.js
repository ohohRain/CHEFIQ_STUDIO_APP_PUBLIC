import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Modal, Portal, Text, Button, RadioButton, Divider, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCollections } from '../contexts/CollectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import CreateCollectionModal from './CreateCollectionModal';

const SaveToCollectionSheet = ({ visible, onDismiss, recipeId, onSaveSuccess, onUnsaveSuccess }) => {
  const {
    getUserCollections,
    getRecipeCollection,
    saveRecipeToCollection,
    removeRecipeFromCollection,
    getCollection
  } = useCollections();
  const { colors } = useTheme();

  // State
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [currentCollectionId, setCurrentCollectionId] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const collections = getUserCollections();

  // Debug logging
  React.useEffect(() => {
    console.log('📋 SaveToCollectionSheet props:', { visible, recipeId });
    console.log('📋 Collections available:', collections.length);
  }, [visible, recipeId, collections.length]);

  // Initialize selected collection when sheet opens
  useEffect(() => {
    const initializeSheet = async () => {
      if (visible && recipeId) {
        setLoading(true);
        try {
          // Check if recipe is already saved (async now!)
          const savedCollectionId = await getRecipeCollection(recipeId);

          if (savedCollectionId) {
            // Recipe is saved, select current collection
            setSelectedCollectionId(savedCollectionId);
            setCurrentCollectionId(savedCollectionId);
            console.log(`📋 Recipe already saved to collection: ${savedCollectionId}`);
          } else {
            // Recipe not saved - DO NOT pre-select
            // User must manually choose which collection to save to
            setSelectedCollectionId(null);
            setCurrentCollectionId(null);
            console.log(`📋 Recipe not saved - user must select collection`);
          }
        } catch (error) {
          console.error('❌ Error initializing sheet:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    initializeSheet();
  }, [visible, recipeId]);

  // Handle save
  const handleSave = async () => {
    if (!selectedCollectionId) {
      return;
    }

    setLoading(true);

    try {
      // If recipe is currently saved and user selected same collection, do nothing
      if (currentCollectionId === selectedCollectionId) {
        console.log('⏭️ Recipe already in this collection');
        setSnackbarMessage('Recipe already in this collection');
        setSnackbarVisible(true);
        setTimeout(() => onDismiss(), 300);
        return;
      }

      // Save to new/different collection
      await saveRecipeToCollection(recipeId, selectedCollectionId);

      const collection = getCollection(selectedCollectionId);
      const collectionName = collection ? collection.name : 'collection';

      const isNewSave = !currentCollectionId;
      setSnackbarMessage(isNewSave ? `Saved to ${collectionName}` : `Moved to ${collectionName}`);
      setSnackbarVisible(true);

      console.log(`✅ Recipe ${isNewSave ? 'saved' : 'moved'}: ${recipeId} → ${selectedCollectionId}`);

      // Call onSaveSuccess callback for optimistic UI update (only for NEW saves, not moves)
      if (isNewSave && onSaveSuccess) {
        onSaveSuccess();
      }

      // Close sheet after short delay
      setTimeout(() => {
        onDismiss();
      }, 300);
    } catch (error) {
      console.error('❌ Error saving recipe:', error);
      setSnackbarMessage('Failed to save recipe');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle unsave
  const handleUnsave = async () => {
    if (!currentCollectionId) {
      console.warn('⚠️ No current collection to unsave from');
      return;
    }

    setLoading(true);

    try {
      // Pass currentCollectionId to avoid extra Firestore query
      await removeRecipeFromCollection(recipeId, currentCollectionId);

      setSnackbarMessage('Removed from collection');
      setSnackbarVisible(true);

      console.log(`✅ Recipe unsaved: ${recipeId}`);

      // Call onUnsaveSuccess callback for optimistic UI update
      if (onUnsaveSuccess) {
        onUnsaveSuccess();
      }

      // Close sheet after short delay
      setTimeout(() => {
        onDismiss();
      }, 300);
    } catch (error) {
      console.error('❌ Error removing recipe:', error);
      setSnackbarMessage(error.message || 'Failed to remove recipe');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle create new collection
  const handleCreateSuccess = (newCollection) => {
    // Automatically select the newly created collection
    setSelectedCollectionId(newCollection.collectionId);
    setCreateModalVisible(false);
  };

  const handleDismiss = () => {
    setSelectedCollectionId(null);
    onDismiss();
  };

  return (
    <>
      <Portal>
        <Modal
          visible={visible}
          onDismiss={handleDismiss}
          dismissable={false}
          contentContainerStyle={[styles.bottomSheetContainer, { backgroundColor: colors.card }]}
        >
          {/* Header */}
          <View style={styles.header}>
              <Text variant="titleLarge" style={[styles.title, { color: colors.text }]}>
                Save to Collection
              </Text>
              <TouchableOpacity onPress={handleDismiss}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Divider />

            {/* Collections List */}
            <ScrollView style={styles.collectionsList}>
              {collections.length === 0 ? (
                /* Empty State - No Collections */
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="folder-star-outline" size={48} color={colors.textLight} />
                  <Text variant="titleMedium" style={[styles.emptyStateTitle, { color: colors.text }]}>
                    No collections yet
                  </Text>
                  <Text variant="bodyMedium" style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                    Create your first collection to save recipes
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => setCreateModalVisible(true)}
                  >
                    <MaterialCommunityIcons name="plus-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.emptyStateButtonText}>Create Collection</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <RadioButton.Group
                    onValueChange={value => setSelectedCollectionId(value)}
                    value={selectedCollectionId}
                  >
                    {collections.map((collection) => (
                      <TouchableOpacity
                        key={collection.collectionId}
                        style={styles.collectionItem}
                        onPress={() => setSelectedCollectionId(collection.collectionId)}
                      >
                        <View style={styles.collectionInfo}>
                          <Text style={styles.emoji}>{collection.emoji}</Text>
                          <View style={styles.collectionText}>
                            <Text variant="bodyLarge" style={[styles.collectionName, { color: colors.text }]}>
                              {collection.name}
                            </Text>
                            <Text variant="bodySmall" style={[styles.recipeCount, { color: colors.textSecondary }]}>
                              {collection.stats.recipesCount} recipes
                            </Text>
                          </View>
                        </View>
                        <RadioButton value={collection.collectionId} />
                      </TouchableOpacity>
                    ))}
                  </RadioButton.Group>

                  {/* Create New Collection Button */}
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => setCreateModalVisible(true)}
                  >
                    <MaterialCommunityIcons name="plus-circle-outline" size={24} color="#FF8C42" />
                    <Text variant="bodyLarge" style={styles.createButtonText}>
                      Create New Collection
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              <Divider />
              <View style={styles.buttonContainer}>
                {currentCollectionId ? (
                  /* If recipe is already saved, show "Remove" button */
                  <React.Fragment key="saved-actions">
                    <Button
                      mode="outlined"
                      onPress={handleUnsave}
                      style={styles.button}
                      disabled={loading}
                      textColor="#FF3B30"
                      buttonColor="transparent"
                    >
                      Remove
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleSave}
                      style={styles.button}
                      disabled={!selectedCollectionId || loading}
                      buttonColor="#00D084"
                      textColor="#FFFFFF"
                    >
                      {selectedCollectionId === currentCollectionId ? 'Saved' : 'Move'}
                    </Button>
                  </React.Fragment>
                ) : (
                  /* If recipe not saved, show "Cancel" and "Save" */
                  <React.Fragment key="new-actions">
                    <Button
                      mode="outlined"
                      onPress={handleDismiss}
                      style={styles.button}
                      disabled={loading}
                      textColor="#FF3B30"
                      buttonColor="transparent"
                    >
                      Cancel
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleSave}
                      style={styles.button}
                      disabled={!selectedCollectionId || loading}
                      buttonColor="#00D084"
                      textColor="#FFFFFF"
                    >
                      Save
                    </Button>
                  </React.Fragment>
                )}
              </View>
            </View>
        </Modal>
      </Portal>

      {/* Create Collection Modal */}
      <CreateCollectionModal
        visible={createModalVisible}
        onDismiss={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Snackbar for feedback */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </>
  );
};

const styles = StyleSheet.create({
  bottomSheetContainer: {
    borderRadius: 20,
    marginHorizontal: 20,
    width: '90%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16
  },
  title: {
    fontWeight: 'bold'
  },
  collectionsList: {
    maxHeight: 300,
    paddingVertical: 8
  },
  collectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20
  },
  collectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  emoji: {
    fontSize: 32,
    marginRight: 12
  },
  collectionText: {
    flex: 1
  },
  collectionName: {
    fontWeight: '500'
  },
  recipeCount: {
    marginTop: 2
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 8
  },
  createButtonText: {
    color: '#FF8C42',
    marginLeft: 12,
    fontWeight: '500'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32
  },
  emptyStateTitle: {
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyStateText: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D084',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  actions: {
    borderTopWidth: 1
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12
  },
  button: {
    flex: 1
  },
  snackbar: {
    backgroundColor: '#333'
  }
});

export default SaveToCollectionSheet;
