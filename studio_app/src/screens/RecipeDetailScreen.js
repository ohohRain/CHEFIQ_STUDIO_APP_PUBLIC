import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  Share,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MOCK_RECIPES } from '../data/mockRecipes';
import { useAuth } from '../contexts/AuthContext';
import { useCollections } from '../contexts/CollectionsContext';
import { useLikes } from '../contexts/LikeContext';
import { useTheme } from '../contexts/ThemeContext';
import recipeService from '../services/recipeService';
import likeService from '../services/likeService';
import viewService from '../services/viewService';
import pendingLikesManager from '../services/pendingLikesManager';
import commentService from '../services/commentService';
import { useCommentLikes } from '../contexts/CommentLikeContext';
import SaveToCollectionSheet from '../components/SaveToCollectionSheet';
import CommentInputSheet from '../components/CommentInputSheet';

const SCREEN_WIDTH = Dimensions.get('window').width;

const RecipeDetailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, userProfile } = useAuth();
  const { isRecipeSaved } = useCollections();
  const { likedRecipes, likeCounts, toggleLike } = useLikes();
  const { likedComments, commentLikeCounts, toggleCommentLike } = useCommentLikes();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { recipeId } = route.params || {};

  // Recipe data state
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Social interaction states (Phase 9: Collections & Save System)
  const [isSaved, setIsSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);

  // Comment input state (Phase 12: Comment System)
  const [commentInputVisible, setCommentInputVisible] = useState(false);

  // Fetch recipe on mount
  useEffect(() => {
    const fetchRecipe = async () => {
      if (!recipeId) {
        setError('Recipe ID not provided');
        setLoading(false);
        Alert.alert('Error', 'Recipe not found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      try {
        setLoading(true);
        const result = await recipeService.getRecipe(recipeId, user?.uid);

        if (result.success) {
          setRecipe(result.data.recipe);
          setSaveCount(result.data.recipe.stats?.savesCount || 0);
          setCommentCount(result.data.recipe.stats?.commentsCount || 0);

          // Track view count (fire-and-forget, don't block UI)
          // Phase 7: View tracking - excludes author views, Cloud Function updates stats
          if (user?.uid) {
            console.log('🔍 [DEBUG] Tracking view with:', {
              userId: user.uid,
              recipeId: recipeId,
              authorId: result.data.recipe.authorId,
              isAuthor: user.uid === result.data.recipe.authorId
            });
            viewService
              .trackView(user.uid, recipeId, result.data.recipe.authorId)
              .catch((err) => {
                console.error('❌ View tracking failed:', err);
                console.error('Error code:', err.code);
                console.error('Error message:', err.message);
              });
          } else {
            console.log('⚠️ [DEBUG] Cannot track view - user.uid is:', user?.uid);
          }
        } else {
          setError(result.error.message);
          Alert.alert('Error', result.error.message, [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
      } catch (err) {
        console.error('Fetch recipe error:', err);
        setError('Failed to load recipe');
        Alert.alert('Error', 'Failed to load recipe', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [recipeId, user?.uid]);

  // Check if recipe is saved (Phase 9.2 - Async)
  useEffect(() => {
    const checkSaveStatus = async () => {
      if (!recipeId || !user?.uid) return;

      try {
        const saved = await isRecipeSaved(recipeId);
        setIsSaved(saved);
      } catch (error) {
        console.warn('Failed to check save status:', error);
      }
    };

    checkSaveStatus();
  }, [recipeId, user?.uid]);

  // Real-time listener for recipe stats updates (multi-user view)
  useEffect(() => {
    if (!recipeId) return;

    console.log('[RecipeDetailScreen] Setting up real-time stats listener for recipe:', recipeId);

    const recipeRef = doc(db, 'recipes', recipeId);
    const unsubscribe = onSnapshot(
      recipeRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const recipeData = docSnap.data();
          if (recipeData.stats) {
            console.log('[RecipeDetailScreen] Real-time stats update:', recipeData.stats);

            // Update stats from Firestore (authoritative source)
            // Note: Like count now managed by global LikeContext, only update saveCount and commentCount here
            setSaveCount(recipeData.stats.savesCount || 0);
            setCommentCount(recipeData.stats.commentsCount || 0);

            // ✅ Don't clear pending operation here!
            // The 5-second timeout in pendingLikesManager will handle cleanup
            // This allows HomeScreen to apply the pending operation when navigating back
          }
        }
      },
      (error) => {
        // Silently ignore errors from deleted documents (normal during recipe deletion)
        if (error.code !== 'permission-denied' && error.code !== 'not-found') {
          console.error('[RecipeDetailScreen] Stats listener error:', error);
        }
      }
    );

    return () => {
      console.log('[RecipeDetailScreen] Cleaning up stats listener');
      unsubscribe();
    };
  }, [recipeId]);

  // Comments data - Phase 12
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Comment count state (Phase 12: Real-time updates)
  const [commentCount, setCommentCount] = useState(0);

  // Fetch comments from Firebase
  useEffect(() => {
    const loadComments = async () => {
      if (!recipeId) return;

      try {
        setCommentsLoading(true);
        const result = await commentService.getComments(recipeId, 20);

        if (result.success) {
          setComments(result.data.comments);
          console.log(`✅ Loaded ${result.data.comments.length} comments for recipe ${recipeId}`);
        } else {
          console.error('❌ Failed to load comments:', result.error);
        }
      } catch (error) {
        console.error('❌ Error loading comments:', error);
      } finally {
        setCommentsLoading(false);
      }
    };

    loadComments();
  }, [recipeId]);

  // Show loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading recipe...</Text>
      </View>
    );
  }

  // Show error state
  if (error || !recipe) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="alert-circle" size={64} color={colors.highlight} />
        <Text style={styles.errorText}>Recipe not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Prepare recipe data for display
  const recipeData = {
    id: recipe.recipeId,
    title: recipe.title,
    coverImage: recipe.coverImage ? { uri: recipe.coverImage } : null,
    author: {
      username: recipe.authorUsername,
      avatar: recipe.authorAvatar,
    },
    difficulty: recipe.difficulty,
    cookingTime: recipe.cookingTime,
    cuisine: recipe.cuisine,
    equipment: recipe.equipment || [],
    description: recipe.description || '',
    ingredients: recipe.ingredients,
    steps: recipe.steps,
  };

  const handleLike = async () => {
    if (!user?.uid) {
      Alert.alert('Login Required', 'Please sign in to like recipes');
      return;
    }

    // Get current count from recipe stats (fallback if not in global state yet)
    const currentCount = recipe?.stats?.likesCount || 0;

    // Call global toggleLike (handles optimistic updates and rollback automatically)
    const result = await toggleLike(recipeId, currentCount);

    if (!result.success) {
      Alert.alert(
        'Operation Failed',
        result.error || 'Failed to update like status. Please try again.'
      );
    }
  };

  const handleSave = () => {
    console.log('⭐ Save button pressed');
    console.log('User:', user?.uid);
    console.log('RecipeId:', recipeId);

    if (!user?.uid) {
      Alert.alert('Login Required', 'Please sign in to save recipes');
      return;
    }

    console.log('✅ Opening save sheet...');
    // Open bottom sheet to select collection (Phase 9.1)
    setSaveSheetVisible(true);
    console.log('SaveSheetVisible set to:', true);
  };

  const handleSaveSheetDismiss = async () => {
    setSaveSheetVisible(false);
    // Refresh saved status after sheet closes
    try {
      const saved = await isRecipeSaved(recipeId);
      setIsSaved(saved);

      // Note: We don't refetch saveCount here to preserve optimistic UI update
      // The callbacks (onSaveSuccess/onUnsaveSuccess) handle count updates
      // Cloud Function will eventually update Firestore, and count will be accurate on next page load
    } catch (error) {
      console.warn('Failed to refresh save status:', error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this recipe: ${recipeData.title}`,
        url: `https://chefiq-studio.app/recipes/${recipeData.id}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleComment = () => {
    console.log('💬 Comment button pressed');

    if (!user?.uid) {
      Alert.alert('Login Required', 'Please sign in to comment');
      return;
    }

    setCommentInputVisible(true);
  };

  const handleCommentSubmit = async (commentText) => {
    if (!user?.uid || !recipeId) {
      setCommentInputVisible(false);
      return;
    }

    try {
      console.log('📝 Submitting comment:', commentText);

      // Optimistic UI: Create temporary comment object
      const tempComment = {
        commentId: `temp_${Date.now()}`,
        recipeId,
        authorId: user.uid,
        authorUsername: userProfile?.username || user.displayName || 'You',
        authorAvatar: userProfile?.avatar || user.photoURL || null,
        content: commentText,
        createdAt: new Date(),
        stats: {
          likesCount: 0,
        },
      };

      // Add to UI immediately
      setComments((prev) => [tempComment, ...prev]);

      // Close sheet
      setCommentInputVisible(false);

      // Submit to Firestore
      const result = await commentService.createComment(
        recipeId,
        commentText,
        {
          userId: user.uid,
          username: userProfile?.username || user.displayName || 'Anonymous',
          avatar: userProfile?.avatar || user.photoURL || null,
        }
      );

      if (result.success) {
        console.log('✅ Comment created:', result.data.commentId);

        // Replace temp comment with real comment
        setComments((prev) =>
          prev.map((c) =>
            c.commentId === tempComment.commentId
              ? { ...tempComment, commentId: result.data.commentId }
              : c
          )
        );

        // Cloud Function will auto-update commentCount via real-time listener
      } else {
        // Rollback on failure
        setComments((prev) => prev.filter((c) => c.commentId !== tempComment.commentId));
        Alert.alert('Failed to Post', result.error || 'Please try again');
      }
    } catch (error) {
      console.error('❌ Error creating comment:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!user?.uid) return;

    // Confirmation dialog
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic update - remove from UI immediately
            const originalComments = [...comments];
            setComments(prev => prev.filter(c => c.commentId !== commentId));

            try {
              const result = await commentService.deleteComment(commentId, user.uid);

              if (!result.success) {
                // Rollback on failure
                setComments(originalComments);
                Alert.alert('Delete Failed', result.error || 'Failed to delete comment');
              } else {
                console.log('✅ Comment deleted successfully');
                // Cloud Function will auto-update commentCount via real-time listener
              }
            } catch (error) {
              // Rollback on error
              setComments(originalComments);
              console.error('❌ Delete comment error:', error);
              Alert.alert('Error', 'Failed to delete comment. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleAuthorPress = () => {
    if (!recipe?.authorId) {
      console.warn('Cannot navigate to profile: authorId is missing');
      return;
    }

    // Don't navigate if user is viewing their own recipe
    if (user?.uid === recipe.authorId) {
      console.log('User is viewing their own recipe, no navigation needed');
      return;
    }

    console.log('Navigate to public profile:', recipe.authorId);
    navigation.navigate('PublicProfile', { userId: recipe.authorId });
  };

  const handleCommentAuthorPress = (commentAuthorId) => {
    if (!commentAuthorId) {
      console.warn('Cannot navigate: commentAuthorId missing');
      return;
    }

    // Don't navigate to own profile
    if (user?.uid === commentAuthorId) {
      console.log('User viewing own comment, no navigation');
      return;
    }

    console.log('Navigate to commenter profile:', commentAuthorId);
    navigation.navigate('PublicProfile', { userId: commentAuthorId });
  };

  const handleCommentLike = async (commentId, currentLikeCount) => {
    if (!user?.uid) {
      Alert.alert('Login Required', 'Please sign in to like comments');
      return;
    }

    // Call global toggleCommentLike (optimistic UI)
    const result = await toggleCommentLike(commentId, currentLikeCount);

    if (!result.success) {
      Alert.alert('Operation Failed', result.error || 'Failed to like comment. Please try again.');
    }
  };

  const handleMenuPress = () => {
    const isOwner = user?.uid === recipe.authorId;

    if (Platform.OS === 'ios') {
      const options = isOwner
        ? ['Cancel', 'Share Recipe', 'Delete Recipe']
        : ['Cancel', 'Share Recipe'];

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options,
          destructiveButtonIndex: isOwner ? 2 : undefined,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleShare();
          } else if (buttonIndex === 2 && isOwner) {
            handleDeleteRecipe();
          }
        }
      );
    } else {
      const menuOptions = isOwner
        ? [
          { text: 'Share Recipe', onPress: handleShare },
          { text: 'Delete Recipe', onPress: handleDeleteRecipe, style: 'destructive' },
          { text: 'Cancel', style: 'cancel' },
        ]
        : [
          { text: 'Share Recipe', onPress: handleShare },
          { text: 'Cancel', style: 'cancel' },
        ];

      Alert.alert('Recipe Options', null, menuOptions, { cancelable: true });
    }
  };

  const handleCookThis = () => {
    console.log('🍳 Cook This! button pressed');
    console.log('Recipe:', recipeData.title);
    console.log('Steps:', recipeData.steps.length);
    console.log('Ingredients:', recipeData.ingredients.length);

    // Navigate to Guided Cooking Mode with recipe data
    // Convert steps to instructions format expected by GuidedCookingScreen
    const instructionsForCooking = recipeData.steps.map((step) => ({
      number: step.number,
      description: step.description,
      image: step.image, // May be undefined/null - screen handles this
    }));

    navigation.navigate('GuidedCooking', {
      recipe: {
        title: recipeData.title,
        instructions: instructionsForCooking,
        ingredients: recipeData.ingredients, // Pass ingredients for preparation step
      },
    });
  };

  const handleDeleteRecipe = () => {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipeData.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[RecipeDetailScreen] Deleting recipe:', recipeData.id);

              const result = await recipeService.deleteRecipe(recipeData.id, user.uid);

              if (!result.success) {
                throw new Error(result.error.message);
              }

              console.log('[RecipeDetailScreen] Recipe deleted successfully');

              // Navigate back and show success
              navigation.goBack();
              // Note: Alert after navigation might not show, ProfileScreen will refresh automatically
            } catch (error) {
              console.error('[RecipeDetailScreen] Error deleting recipe:', error);
              Alert.alert('Delete Failed', error.message || 'Failed to delete recipe. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const formatCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';

    const now = new Date();
    const commentDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = now - commentDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return commentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Compute like state from global LikeContext
  const isLiked = likedRecipes.has(recipeId);
  const displayCount = likeCounts[recipeId] ?? (recipe?.stats?.likesCount || 0);

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton} onPress={handleMenuPress}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          paddingTop: insets.top + 57, // 57 = headerButton (44) + paddingBottom (12) + border (1)
          paddingBottom: insets.bottom + 80
        }}
        showsVerticalScrollIndicator={true}
      >
        {/* Cover Photo - positioned at top */}
        <View style={styles.coverImageContainer}>
          {recipeData.coverImage ? (
            <Image
              source={recipeData.coverImage}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.coverImage, styles.placeholderImage]}>
              <MaterialCommunityIcons name="image-off" size={48} color="#CCCCCC" />
            </View>
          )}
        </View>

        {/* Section Divider */}
        <View style={styles.sectionDivider} />

        {/* Recipe Info Section */}
        <View style={styles.infoSection}>
          {/* Title */}
          <Text style={styles.title}>{recipeData.title}</Text>

          {/* Author */}
          <TouchableOpacity
            style={styles.authorRow}
            onPress={handleAuthorPress}
            activeOpacity={0.7}
          >
            {recipeData.author.avatar ? (
              <Image
                source={{ uri: recipeData.author.avatar }}
                style={[styles.avatar, { overflow: 'hidden' }]}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="account" size={20} color={colors.textSecondary} />
              </View>
            )}
            <Text style={styles.username}>{recipeData.author.username}</Text>
          </TouchableOpacity>

          {/* Metadata */}
          <View style={styles.metadataSection}>
            <Text style={styles.metadataText}>
              🍳 {recipeData.difficulty} • ⏱️ {recipeData.cookingTime} mins • 🌍 {recipeData.cuisine}
            </Text>
            {recipeData.equipment && recipeData.equipment.length > 0 && (
              <Text style={styles.metadataText}>
                🔪 {recipeData.equipment.join(', ')}
              </Text>
            )}
          </View>

          {/* Description */}
          {recipeData.description && (
            <Text style={styles.description}>{recipeData.description}</Text>
          )}
        </View>

        {/* Section Divider */}
        <View style={styles.sectionDivider} />

        {/* Ingredients Section */}
        <View style={styles.ingredientsSection}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <View style={styles.ingredientsList}>
            {recipeData.ingredients.map((ingredient, index) => (
              <View key={index} style={styles.ingredientRow}>
                <Text style={styles.ingredientName}>{ingredient.name}</Text>
                <View style={styles.dottedLine} />
                <Text style={styles.ingredientAmount}>{ingredient.amount}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Section Divider */}
        <View style={styles.sectionDivider} />

        {/* Cooking Steps Section */}
        <View style={styles.stepsSection}>
          <View style={styles.stepsSectionHeader}>
            <Text style={styles.sectionTitle}>Cooking Steps</Text>
            <TouchableOpacity style={styles.cookButton} onPress={handleCookThis}>
              <Text style={styles.cookButtonText}>Cook This!</Text>
            </TouchableOpacity>
          </View>

          {recipeData.steps.map((step, index) => (
            <View key={index} style={styles.stepCard}>
              <Text style={styles.stepNumber}>Step {step.number}</Text>
              {step.image && (
                <Image
                  source={{ uri: step.image }}
                  style={styles.stepImage}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          ))}
        </View>

        {/* Section Divider */}
        <View style={styles.sectionDivider} />

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <View style={styles.commentsSectionHeader}>
            <Text style={styles.sectionTitle}>Comments</Text>
            <Text style={styles.commentsCount}>{commentCount} comments</Text>
          </View>

          {comments.length === 0 && !commentsLoading && (
            <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
          )}

          {comments.map((comment) => (
            <View key={comment.commentId} style={styles.commentCard}>
              <TouchableOpacity
                style={styles.commentHeader}
                onPress={() => handleCommentAuthorPress(comment.authorId)}
                activeOpacity={0.7}
              >
                {comment.authorAvatar ? (
                  <Image
                    source={{ uri: comment.authorAvatar }}
                    style={styles.commentAvatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.commentAvatar}>
                    <MaterialCommunityIcons name="account-circle" size={40} color={colors.border} />
                  </View>
                )}
                <View style={styles.commentHeaderInfo}>
                  <Text style={styles.commentAuthor}>{comment.authorUsername}</Text>
                  <Text style={styles.commentTimestamp}>{formatTimeAgo(comment.createdAt)}</Text>
                </View>
                {/* Delete button - only show for comment author */}
                {user?.uid === comment.authorId && (
                  <TouchableOpacity
                    style={styles.commentDeleteButton}
                    onPress={() => handleDeleteComment(comment.commentId)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              <Text style={styles.commentContent}>{comment.content}</Text>
              <View style={styles.commentActions}>
                <TouchableOpacity
                  style={styles.commentActionButton}
                  onPress={() => handleCommentLike(comment.commentId, comment.stats?.likesCount || 0)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={likedComments.has(comment.commentId) ? 'heart' : 'heart-outline'}
                    size={18}
                    color={likedComments.has(comment.commentId) ? colors.highlight : colors.textSecondary}
                  />
                  <Text style={[
                    styles.commentActionText,
                    likedComments.has(comment.commentId) && { color: colors.highlight }
                  ]}>
                    {commentLikeCounts[comment.commentId] ?? (comment.stats?.likesCount || 0)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Fixed Bottom Social Interaction Bar */}
      <View
        style={[
          styles.socialBar,
          { paddingBottom: insets.bottom + 8 },
        ]}
      >
        {/* Like Button (Heart Icon - Phase 8) */}
        <TouchableOpacity
          style={styles.socialButton}
          onPress={handleLike}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={26}
            color={isLiked ? colors.highlight : colors.textSecondary}
          />
          <Text style={[styles.socialButtonText, isLiked && styles.socialButtonTextActive]}>
            {formatCount(displayCount)}
          </Text>
        </TouchableOpacity>

        {/* Comment Button */}
        <TouchableOpacity
          style={styles.socialButton}
          onPress={handleComment}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="comment-outline" size={24} color={colors.textSecondary} />
          <Text style={styles.socialButtonText}>{commentCount}</Text>
        </TouchableOpacity>

        {/* Save Button (Star Icon - Phase 14) */}
        <TouchableOpacity
          style={styles.socialButton}
          onPress={handleSave}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={isSaved ? 'star' : 'star-outline'}
            size={24}
            color={isSaved ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.socialButtonText, isSaved && styles.socialButtonTextActiveSaved]}>
            {formatCount(saveCount)}
          </Text>
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity
          style={styles.socialButton}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="share-outline" size={24} color={colors.textSecondary} />
          <Text style={styles.socialButtonText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Save to Collection Sheet (Phase 9.1) */}
      <SaveToCollectionSheet
        visible={saveSheetVisible}
        onDismiss={handleSaveSheetDismiss}
        recipeId={recipeId}
        onSaveSuccess={() => setSaveCount(prev => prev + 1)}
        onUnsaveSuccess={() => setSaveCount(prev => prev - 1)}
      />

      {/* Comment Input Sheet (Phase 12: Comment System) */}
      <CommentInputSheet
        visible={commentInputVisible}
        onDismiss={() => setCommentInputVisible(false)}
        onSubmit={handleCommentSubmit}
        recipeTitle={recipeData?.title || 'this recipe'}
      />
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
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
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 100,
  },
  headerButton: {
    padding: 4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  coverImageContainer: {
    width: '100%',
    // Header height = insets.top + headerButton (44) + paddingBottom (12) + border (1)
    // But we can't access insets in styles, so we use paddingTop in ScrollView instead
  },
  coverImage: {
    width: '100%',
    height: SCREEN_WIDTH, // Square aspect ratio - scales with device screen size
  },
  sectionDivider: {
    height: 8,
    backgroundColor: colors.accent,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.card,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    lineHeight: 36,
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginLeft: 10,
  },
  metadataSection: {
    paddingVertical: 8,
  },
  metadataText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  description: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
    marginTop: 8,
  },
  ingredientsSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.card,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  ingredientsList: {
    gap: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  ingredientName: {
    fontSize: 16,
    color: colors.text,
  },
  dottedLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    // Note: dotted/dashed borders not supported on iOS
  },
  ingredientAmount: {
    fontSize: 16,
    color: colors.text,
  },
  stepsSection: {
    backgroundColor: colors.card,
  },
  stepsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  cookButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  cookButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepCard: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  stepImage: {
    width: '100%',
    aspectRatio: 1, // Maintain original aspect ratio
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: colors.accent,
  },
  stepDescription: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 27,
  },
  commentsSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.card,
  },
  commentsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  commentsCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  noCommentsText: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
    paddingVertical: 24,
    fontStyle: 'italic',
  },
  commentCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentDeleteButton: {
    padding: 8,
    marginLeft: 'auto',
  },
  commentHeaderInfo: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  commentTimestamp: {
    fontSize: 13,
    color: colors.textLight,
  },
  commentContent: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 10,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentActionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  viewAllCommentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  viewAllCommentsText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 4,
  },
  socialBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  socialButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  socialButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  socialButtonTextActive: {
    color: colors.highlight,
  },
  socialButtonTextActiveSaved: {
    color: colors.primary,
  },
});

export default RecipeDetailScreen;
