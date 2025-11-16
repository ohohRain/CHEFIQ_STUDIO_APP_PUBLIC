import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
} from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useLikes } from '../contexts/LikeContext';
import { useCollections } from '../contexts/CollectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { getRecipe } from '../services/recipeService';
import CreateCollectionModal from '../components/CreateCollectionModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 24) / 2; // 2 columns with padding

const CollectionDetailScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { likedRecipes, likeCounts, toggleLike } = useLikes();
  const {
    getCollection,
    getCollectionRecipes,
    removeRecipeFromCollection,
    deleteCollection
  } = useCollections();

  const { collectionId, collectionName } = route.params || {};

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);

  // Get collection data
  const collection = getCollection(collectionId);

  // Load recipes from Firestore when screen comes into focus or collection changes
  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [collectionId])
  );

  const loadRecipes = async () => {
    try {
      setLoadingRecipes(true);

      // Get recipe IDs in this collection (now async!)
      const result = await getCollectionRecipes(collectionId);

      if (!result || !result.recipeIds) {
        setRecipes([]);
        return;
      }

      // Fetch full recipe data from Firestore for each recipe ID
      const recipePromises = result.recipeIds.map(recipeId => getRecipe(recipeId));
      const recipesData = await Promise.all(recipePromises);

      // Filter out any null results (recipes that don't exist)
      const validRecipes = recipesData
        .filter(result => result.success && result.data && result.data.recipe)
        .map(result => result.data.recipe);

      setRecipes(validRecipes);
    } catch (err) {
      console.error('❌ Load recipes error:', err);
      setRecipes([]);
    } finally {
      setLoadingRecipes(false);
    }
  };

  // Calculate column heights for masonry layout
  const getColumnHeights = () => {
    const leftColumn = [];
    const rightColumn = [];
    let leftHeight = 0;
    let rightHeight = 0;

    recipes.forEach((recipe) => {
      const cardHeight = COLUMN_WIDTH * (recipe.aspectRatio || 1.2) + 80;
      if (leftHeight <= rightHeight) {
        leftColumn.push(recipe);
        leftHeight += cardHeight;
      } else {
        rightColumn.push(recipe);
        rightHeight += cardHeight;
      }
    });

    return { leftColumn, rightColumn };
  };

  const { leftColumn, rightColumn } = getColumnHeights();

  const handleRecipePress = (recipe) => {
    navigation.navigate('RecipeDetail', { recipeId: recipe.recipeId || recipe.id });
  };

  const handleRecipeLongPress = (recipe) => {
    Alert.alert(
      'Remove Recipe',
      `Remove "${recipe.title}" from ${collection.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => handleRemoveRecipe(recipe.recipeId || recipe.id)
        }
      ]
    );
  };

  const handleRemoveRecipe = async (recipeId) => {
    try {
      await removeRecipeFromCollection(recipeId);
      setSnackbarMessage('Recipe removed from collection');
      setSnackbarVisible(true);
      // Reload recipes to update UI
      await loadRecipes();
    } catch (error) {
      console.error('Error removing recipe:', error);
      Alert.alert('Error', 'Failed to remove recipe from collection');
    }
  };

  const handleManage = () => {
    if (Platform.OS === 'ios') {
      const options = collection.isDefault
        ? ['Cancel', 'Edit Collection']
        : ['Cancel', 'Edit Collection', 'Delete Collection'];

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options,
          destructiveButtonIndex: collection.isDefault ? undefined : 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleEditCollection();
          } else if (buttonIndex === 2 && !collection.isDefault) {
            handleDeleteCollection();
          }
        }
      );
    } else {
      const options = [
        { text: 'Edit Collection', onPress: handleEditCollection },
      ];

      // Only allow deletion if not default collection
      if (!collection.isDefault) {
        options.push({
          text: 'Delete Collection',
          onPress: handleDeleteCollection,
          style: 'destructive'
        });
      }

      options.push({ text: 'Cancel', style: 'cancel' });

      Alert.alert('Manage Collection', null, options);
    }
  };

  const handleEditCollection = () => {
    setEditModalVisible(true);
  };

  const handleDeleteCollection = () => {
    if (collection.isDefault) {
      Alert.alert('Cannot Delete', 'The default collection cannot be deleted');
      return;
    }

    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${collection.name}"? All saved recipes will be removed from this collection.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteCollection(collectionId);
              setSnackbarMessage('Collection deleted');
              setSnackbarVisible(true);
              // Navigate back after short delay
              setTimeout(() => {
                navigation.goBack();
              }, 500);
            } catch (error) {
              console.error('Error deleting collection:', error);
              Alert.alert('Error', error.message || 'Failed to delete collection');
            }
          }
        }
      ]
    );
  };

  // Wrapper for global toggleLike with login check
  const handleToggleLike = (recipeId, currentCount) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to like recipes');
      return;
    }
    toggleLike(recipeId, currentCount);
  };

  const renderRecipeCard = (recipe) => {
    // Handle Firestore recipe data structure
    const imageHeight = COLUMN_WIDTH * 1.2; // Default aspect ratio
    const coverImageUrl = recipe.coverImage || recipe.imageSource;
    const authorUsername = recipe.authorUsername || 'Unknown';
    const recipeId = recipe.recipeId || recipe.id;

    const isLiked = likedRecipes.has(recipeId);
    const displayCount = likeCounts[recipeId] ?? recipe.stats?.likesCount ?? recipe.likeCount ?? 0;

    return (
      <TouchableOpacity
        onPress={() => handleRecipePress(recipe)}
        onLongPress={() => handleRecipeLongPress(recipe)}
        activeOpacity={0.9}
        style={styles.recipeCard}
      >
        <Image
          source={{ uri: coverImageUrl }}
          style={[styles.recipeImage, { height: imageHeight }]}
          resizeMode="cover"
        />
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {recipe.title}
          </Text>
          <View style={styles.recipeFooter}>
            <Text style={styles.recipeUsername}>@{authorUsername}</Text>
            <TouchableOpacity
              style={styles.likesContainer}
              onPress={(e) => {
                e.stopPropagation();
                handleToggleLike(recipeId, displayCount);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={14}
                color={isLiked ? '#FF8C42' : colors.textSecondary}
              />
              <Text style={[styles.likeCount, isLiked && { color: '#FF8C42' }]}>
                {displayCount >= 1000
                  ? `${(displayCount / 1000).toFixed(1)}k`
                  : displayCount}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Show error if collection not found
  if (!collection) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <MaterialCommunityIcons name="folder-alert-outline" size={64} color={colors.border} />
        <Text style={styles.errorText}>Collection not found</Text>
        <TouchableOpacity
          style={styles.backButtonError}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.manageButton} onPress={handleManage}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Collection Info */}
        <View style={styles.collectionInfo}>
          <View style={styles.collectionHeader}>
            <Text style={styles.collectionEmoji}>{collection.emoji}</Text>
            <View style={styles.collectionTextContainer}>
              <Text style={styles.collectionName}>{collection.name}</Text>
              <Text style={styles.collectionCount}>
                {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
              </Text>
            </View>
          </View>

          {collection.description && (
            <Text style={styles.collectionDescription}>{collection.description}</Text>
          )}
        </View>

        {/* Loading State */}
        {loadingRecipes ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading recipes...</Text>
          </View>
        ) : recipes.length === 0 ? (
          /* Empty State */
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chef-hat" size={64} color={colors.border} />
            <Text style={styles.emptyStateTitle}>No recipes yet</Text>
            <Text style={styles.emptyStateText}>
              Save recipes to this collection by tapping the star button
            </Text>
          </View>
        ) : (
          /* Masonry Layout */
          <View style={styles.masonryContainer}>
            {/* Left Column */}
            <View style={styles.column}>
              {leftColumn.map((recipe) => (
                <React.Fragment key={recipe.recipeId || recipe.id}>
                  {renderRecipeCard(recipe)}
                </React.Fragment>
              ))}
            </View>

            {/* Right Column */}
            <View style={styles.column}>
              {rightColumn.map((recipe) => (
                <React.Fragment key={recipe.recipeId || recipe.id}>
                  {renderRecipeCard(recipe)}
                </React.Fragment>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Collection Modal */}
      <CreateCollectionModal
        visible={editModalVisible}
        onDismiss={() => setEditModalVisible(false)}
        initialData={collection}
      />

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 24,
  },
  backButtonError: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButton: {
    padding: 4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  collectionInfo: {
    marginBottom: 24,
  },
  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  collectionEmoji: {
    fontSize: 48,
    marginRight: 12,
  },
  collectionTextContainer: {
    flex: 1,
  },
  collectionName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  collectionCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  collectionDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: 8,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  masonryContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  recipeCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  recipeImage: {
    width: '100%',
  },
  recipeInfo: {
    padding: 12,
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  recipeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipeUsername: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  snackbar: {
    backgroundColor: colors.textSecondary,
  },
});

export default CollectionDetailScreen;
