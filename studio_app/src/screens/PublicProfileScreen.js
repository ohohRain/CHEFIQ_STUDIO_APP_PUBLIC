import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLikes } from '../contexts/LikeContext';
import { formatUserStats } from '../services/user.service';
import { db } from '../config/firebase';
import { applyPendingLikesToRecipes } from '../utils/recipeHelpers';
import { getMockUserProfile, getMockUserRecipes, MOCK_FOLLOW_STATUS } from '../data/mockPublicProfiles';
import { useTheme } from '../contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Profile Header Component
const ProfileHeader = ({ userProfile, isFollowing, onFollowToggle, stats, formatNumber, followLoading, colors, styles }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handleFollowPress = () => {
    // Button scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onFollowToggle();
  };

  return (
    <View style={styles.profileHeader}>
      {/* Avatar + Username Row with Follow Button - ALWAYS in same row */}
      <View style={styles.avatarRow}>
        <View style={styles.avatarContainer}>
          {userProfile.avatar ? (
            <Image source={{ uri: userProfile.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]}>
              <MaterialCommunityIcons name="account" size={32} color={colors.textSecondary} />
            </View>
          )}
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.username} numberOfLines={1}>
            {userProfile.username}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            {userProfile.handle}
          </Text>
        </View>

        {/* Follow Button - ALWAYS in username row */}
        <Animated.View style={[styles.followButtonInline, { transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowing && styles.followButtonActive,
            ]}
            onPress={handleFollowPress}
            activeOpacity={0.8}
            disabled={followLoading}
          >
            {followLoading ? (
              <ActivityIndicator size="small" color={isFollowing ? '#FFFFFF' : colors.primary} />
            ) : (
              <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextActive]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Tags Row */}
      {userProfile.tags && userProfile.tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsContainer}
          contentContainerStyle={styles.tagsContent}
        >
          {userProfile.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Bio Section */}
      {userProfile.bio && userProfile.bio.length > 0 && (
        <View style={styles.bioContainer}>
          <Text style={styles.bioText} numberOfLines={3}>
            {userProfile.bio}
          </Text>
        </View>
      )}

      {/* Stats Row - Read-only */}
      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{stats.recipes}</Text>
          <Text style={styles.statLabel}>Recipes</Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statNumber}>{formatNumber(stats.likes)}</Text>
          <Text style={styles.statLabel}>Likes</Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statNumber}>{stats.followers}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
      </View>
    </View>
  );
};

// Recipe Grid Component
const RecipeGrid = ({ recipes, navigation, likedRecipes, likeCounts, toggleLike, userProfile, colors, styles }) => {
  const CARD_WIDTH = (SCREEN_WIDTH - 36) / 2;
  const tabBarHeight = Platform.OS === 'ios' ? 85 : 65;

  // Split recipes into two columns for masonry layout
  const { leftColumn, rightColumn } = useMemo(() => {
    const left = [];
    const right = [];
    let leftHeight = 0;
    let rightHeight = 0;

    recipes.forEach((recipe) => {
      const imageHeight = CARD_WIDTH * (recipe.aspectRatio || 1.0);
      const cardHeight = imageHeight + 100;

      if (leftHeight <= rightHeight) {
        left.push(recipe);
        leftHeight += cardHeight;
      } else {
        right.push(recipe);
        rightHeight += cardHeight;
      }
    });

    return { leftColumn: left, rightColumn: right };
  }, [recipes, CARD_WIDTH]);

  // Render recipe card
  const renderRecipeCard = (recipe) => {
    const imageHeight = CARD_WIDTH * (recipe.aspectRatio || 1.0);
    const isLiked = likedRecipes.has(recipe.id);
    const displayCount = likeCounts[recipe.id] ?? recipe.likes ?? 0;

    return (
      <View key={recipe.id} style={[styles.recipeCard, { width: CARD_WIDTH }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('Navigate to Recipe Detail:', recipe.recipeId);
            navigation.navigate('RecipeDetail', { recipeId: recipe.recipeId });
          }}
        >
          <Image
            source={typeof recipe.coverImage === 'string' ? { uri: recipe.coverImage } : recipe.coverImage || recipe.imageSource}
            style={[styles.recipeImage, { height: imageHeight }]}
          />
          <View style={styles.recipeInfo}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {recipe.title}
            </Text>

            <View style={styles.recipeFooter}>
              <Text variant="bodySmall" style={styles.recipeUsername}>
                @{recipe.username || userProfile?.username || 'user'}
              </Text>
              <TouchableOpacity
                style={styles.likeButton}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleLike(recipe.id, displayCount);
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={16}
                  color={isLiked ? colors.highlight : colors.textSecondary}
                />
                <Text variant="bodySmall" style={[styles.likeCount, isLiked && { color: colors.highlight }]}>
                  {displayCount}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No recipes yet</Text>
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.feedContainer}
      showsVerticalScrollIndicator={false}
    >
      {recipes.length > 0 ? (
        <View style={styles.masonryContainer}>
          <View style={styles.column}>
            {leftColumn.map((recipe) => renderRecipeCard(recipe))}
          </View>
          <View style={styles.column}>
            {rightColumn.map((recipe) => renderRecipeCard(recipe))}
          </View>
        </View>
      ) : (
        renderEmptyState()
      )}
      <View style={[styles.bottomDivider, { marginBottom: tabBarHeight }]} />
    </ScrollView>
  );
};

const PublicProfileScreen = ({ navigation, route }) => {
  const { userId } = route.params;
  const { user } = useAuth();
  const { likedRecipes, likeCounts, toggleLike } = useLikes();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // State management
  const [userProfile, setUserProfile] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasManuallyToggled, setHasManuallyToggled] = useState(false); // Track if user manually toggled
  const [isMockData, setIsMockData] = useState(false); // Track if using mock data
  const [publishedRecipes, setPublishedRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState(null);

  // Format number with K/M notation
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Format user stats for display
  const displayStats = useMemo(() => {
    if (!userProfile || !userProfile.stats) {
      return { recipes: 0, likes: 0, views: 0, followers: 0 };
    }

    return formatUserStats(userProfile.stats);
  }, [userProfile]);

  // Load user profile data (try mock data first for demo)
  const loadUserProfile = async () => {
    try {
      // Try loading mock data first (for demonstration)
      const mockProfile = getMockUserProfile(userId);
      if (mockProfile) {
        console.log('[PublicProfile] Using MOCK user profile:', userId);
        setUserProfile(mockProfile);
        setIsMockData(true); // Mark as using mock data
        return;
      }

      // If not found in mock data, try Firestore
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error('User not found');
      }

      const userData = userSnap.data();
      setUserProfile(userData);
      setIsMockData(false); // Mark as using Firestore data

      console.log('[PublicProfile] User profile loaded from Firestore:', userId);
    } catch (err) {
      console.error('[PublicProfile] Error loading user profile:', err);
      throw err;
    }
  };

  // Check follow status (try mock data first for demo)
  const checkFollowStatus = async () => {
    if (!user || !user.uid) {
      return false;
    }

    // Skip loading if user has manually toggled - keep current state
    if (hasManuallyToggled) {
      console.log('[PublicProfile] Skipping follow status load - user has manually toggled');
      return isFollowing;
    }

    try {
      // Try loading mock follow status first (for demonstration)
      if (MOCK_FOLLOW_STATUS[userId] !== undefined) {
        console.log('[PublicProfile] Using MOCK follow status:', MOCK_FOLLOW_STATUS[userId]);
        setIsFollowing(MOCK_FOLLOW_STATUS[userId]);
        return MOCK_FOLLOW_STATUS[userId];
      }

      // If not found in mock data, try Firestore
      const followId = `${user.uid}_${userId}`;
      const followRef = doc(db, 'follows', followId);
      const followSnap = await getDoc(followRef);

      const status = followSnap.exists();
      setIsFollowing(status);

      console.log('[PublicProfile] Follow status from Firestore:', status);
      return status;
    } catch (err) {
      console.error('[PublicProfile] Error checking follow status:', err);
      return false;
    }
  };

  // Load published recipes (try mock data first for demo)
  const loadPublishedRecipes = async () => {
    try {
      // Try loading mock recipes first (for demonstration)
      const mockRecipes = getMockUserRecipes(userId);
      if (mockRecipes && mockRecipes.length > 0) {
        console.log(`[PublicProfile] Using MOCK recipes (${mockRecipes.length} recipes)`);
        const formattedRecipes = mockRecipes.map(recipe => ({
          ...recipe,
          likes: recipe.likeCount,
          comments: recipe.commentCount,
        }));
        setPublishedRecipes(formattedRecipes);
        return;
      }

      // If not found in mock data, try Firestore
      const recipesQuery = query(
        collection(db, 'recipes'),
        where('authorId', '==', userId),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const querySnapshot = await getDocs(recipesQuery);
      const recipes = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          recipeId: doc.id,
          title: data.title,
          coverImage: data.coverImage,
          aspectRatio: data.aspectRatio || 1.0,
          cookingTime: data.cookingTime,
          likes: data.stats?.likesCount || 0,
          comments: data.stats?.commentsCount || 0,
          status: data.status,
          username: data.authorUsername,
          ...data,
        };
      });

      const recipesWithLikes = applyPendingLikesToRecipes(recipes);
      setPublishedRecipes(recipesWithLikes);

      console.log(`[PublicProfile] Loaded ${recipes.length} published recipes from Firestore`);
    } catch (err) {
      console.error('[PublicProfile] Error loading recipes:', err);
      throw err;
    }
  };

  // Load all data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        loadUserProfile(),
        checkFollowStatus(),
        loadPublishedRecipes(),
      ]);
    } catch (err) {
      console.error('[PublicProfile] Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [userId, user])
  );

  // Toggle follow/unfollow
  const handleFollowToggle = async () => {
    if (!user?.uid) {
      Alert.alert('Login Required', 'Please sign in to follow users');
      return;
    }

    const previousState = isFollowing;
    const delta = previousState ? -1 : 1; // -1 for unfollow, +1 for follow
    setFollowLoading(true);

    // Mark that user has manually toggled (prevents re-loading from mock data)
    setHasManuallyToggled(true);

    // Optimistic UI update
    setIsFollowing(!isFollowing);

    // Update profile stats.followersCount (optimistic update)
    setUserProfile((prev) => {
      if (!prev || !prev.stats) return prev;
      return {
        ...prev,
        stats: {
          ...prev.stats,
          followersCount: Math.max(0, (prev.stats.followersCount || 0) + delta),
        },
      };
    });

    try {
      // If using mock data, skip Firestore operations (demo mode)
      if (isMockData) {
        console.log(`✅ [MOCK] ${previousState ? 'Unfollowed' : 'Followed'} user ${userId}`);
        // Simulate network delay for realistic UX
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      }

      // Real Firestore operations for non-mock data
      const followId = `${user.uid}_${userId}`;
      const followRef = doc(db, 'follows', followId);

      if (previousState) {
        // Unfollow
        await deleteDoc(followRef);
        console.log(`✅ Unfollowed user ${userId}`);
      } else {
        // Follow
        await setDoc(followRef, {
          followerId: user.uid,
          followingId: userId,
          createdAt: serverTimestamp(),
        });
        console.log(`✅ Followed user ${userId}`);
      }
    } catch (error) {
      console.error('❌ Follow operation failed:', error);

      // Revert UI on error
      setIsFollowing(previousState);

      // Rollback profile stats.followersCount
      setUserProfile((prev) => {
        if (!prev || !prev.stats) return prev;
        return {
          ...prev,
          stats: {
            ...prev.stats,
            followersCount: Math.max(0, (prev.stats.followersCount || 0) - delta),
          },
        };
      });

      Alert.alert(
        'Operation Failed',
        error.message || 'Failed to update follow status. Please try again.'
      );
    } finally {
      setFollowLoading(false);
    }
  };

  // Wrapper for global toggleLike with login check
  const handleToggleLike = (recipeId, currentCount) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to like recipes');
      return;
    }
    toggleLike(recipeId, currentCount);
  };

  // Render loading state
  if (loading && !userProfile) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <MaterialCommunityIcons name="account-off" size={64} color={colors.textSecondary} />
        <Text style={styles.errorText}>User not found</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonHeader}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Profile Header */}
      <ProfileHeader
        userProfile={userProfile}
        isFollowing={isFollowing}
        onFollowToggle={handleFollowToggle}
        stats={displayStats}
        formatNumber={formatNumber}
        followLoading={followLoading}
        colors={colors}
        styles={styles}
      />

      {/* Recipe Grid */}
      <RecipeGrid
        recipes={publishedRecipes}
        navigation={navigation}
        likedRecipes={likedRecipes}
        likeCounts={likeCounts}
        toggleLike={handleToggleLike}
        userProfile={userProfile}
        colors={colors}
        styles={styles}
      />
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  },
  errorDetail: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Header
  header: {
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backButtonHeader: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Profile Header
  profileHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  // Avatar Row
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
  },
  defaultAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  handle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  followButtonInline: {
    marginLeft: 8,
    alignSelf: 'center',
  },

  // Tags
  tagsContainer: {
    marginBottom: 12,
    marginHorizontal: -16, // Offset parent padding for edge-to-edge scroll
  },
  tagsContent: {
    paddingHorizontal: 16,
  },
  tag: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  tagText: {
    fontSize: 13,
    color: colors.text,
  },

  // Bio
  bioContainer: {
    marginBottom: 16,
  },
  bioText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 19.6,
  },
  followButton: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 80,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButtonActive: {
    backgroundColor: colors.primary,
    borderWidth: 0,
    minWidth: 100,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  followButtonTextActive: {
    color: '#FFFFFF',
  },

  // Stats Row (matches ProfileScreen compact style)
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stat: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    lineHeight: 16,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 11,
  },

  // Recipe Grid
  feedContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  bottomDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 12,
    marginTop: 12,
  },
  masonryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
    paddingHorizontal: 6,
  },
  recipeCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  recipeImage: {
    width: '100%',
    resizeMode: 'cover',
  },
  recipeInfo: {
    padding: 12,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  recipeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeUsername: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
    textAlign: 'center',
  },
});

export default PublicProfileScreen;
