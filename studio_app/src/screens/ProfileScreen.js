import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  Text,
  ActionSheetIOS,
} from 'react-native';
import { Text as PaperText } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLikes } from '../contexts/LikeContext';
import { useTheme } from '../contexts/ThemeContext';
import { Switch } from 'react-native';
import { MOCK_RECIPES } from '../data/mockRecipes';
import { getUserRecipes, formatUserStats } from '../services/user.service';
import storageService from '../services/storageService';
import recipeService from '../services/recipeService';
import { db } from '../config/firebase';
import { applyPendingLikesToRecipes } from '../utils/recipeHelpers';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

const SCREEN_WIDTH = Dimensions.get('window').width;

// Removed mock data - now using real Firestore data

// Profile Header Component (same layout as PublicProfileScreen)
const ProfileHeader = ({ userProfile, onEditProfile, stats, onStatTap, formatNumber, uploading, uploadProgress, colors }) => {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.profileHeader}>
      {/* Avatar + Username Row */}
      <View style={styles.avatarRow}>
        <View style={styles.avatarContainer}>
          {userProfile.avatar ? (
            <Image source={{ uri: userProfile.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]}>
              <MaterialCommunityIcons name="account" size={32} color={colors.textSecondary} />
            </View>
          )}
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          )}
          <TouchableOpacity
            style={styles.editAvatarButton}
            onPress={onEditProfile}
            disabled={uploading}
          >
            <MaterialCommunityIcons name="pencil" size={12} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.username} numberOfLines={1}>
            {userProfile.username}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            {userProfile.handle}
          </Text>
        </View>
      </View>

      {/* Tags Row - Wrapping layout (2-3 rows) */}
      {userProfile.tags && userProfile.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {userProfile.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Bio Section with Edit Button */}
      <View style={styles.bioContainer}>
        {userProfile.bio && (
          <Text style={styles.bioText} numberOfLines={3}>
            {userProfile.bio}
          </Text>
        )}
      </View>

      {/* Stats Row - Read-only */}
      <View style={styles.statsContainer}>
        <TouchableOpacity style={styles.stat} onPress={() => onStatTap('Recipes')}>
          <Text style={styles.statNumber}>{stats.recipes}</Text>
          <Text style={styles.statLabel}>Recipes</Text>
        </TouchableOpacity>

        <View style={styles.stat}>
          <Text style={styles.statNumber}>{formatNumber(stats.likes)}</Text>
          <Text style={styles.statLabel}>Likes</Text>
        </View>

        <TouchableOpacity style={styles.stat} onPress={() => onStatTap('Followers')}>
          <Text style={styles.statNumber}>{stats.followers}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Tab Content Component - Matches HomeScreen pattern
const TabContent = ({ recipes, activeTab, navigation, onDeleteRecipe, likedRecipes, likeCounts, userProfile, toggleLike, colors }) => {
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  // Render recipe card (published or draft)
  const renderRecipeCard = (recipe) => {
    const imageHeight = CARD_WIDTH * (recipe.aspectRatio || 1.0);
    const isDraft = recipe.status === 'draft';
    const isLiked = likedRecipes.has(recipe.id);
    const displayCount = likeCounts[recipe.id] ?? recipe.likes ?? 0;

    return (
      <View key={recipe.id} style={[styles.recipeCard, { width: CARD_WIDTH }, isDraft && styles.draftCard]}>
        <TouchableOpacity
          onPress={() => {
            if (isDraft) {
              console.log('Navigate to Recipe Form (Edit Draft):', recipe.recipeId);
              navigation.navigate('RecipeForm', { recipeId: recipe.recipeId, mode: 'edit' });
            } else {
              // Navigate with recipeId instead of full recipe object
              console.log('Navigate to Recipe Detail:', recipe.recipeId);
              navigation.navigate('RecipeDetail', { recipeId: recipe.recipeId });
            }
          }}
        >
          <Image source={recipe.image} style={[styles.recipeImage, { height: imageHeight }]} />
          <View style={styles.recipeInfo}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {isDraft && '📝 '}
              {recipe.title}
            </Text>

            {isDraft ? (
              <Text style={styles.draftStatus}>Draft</Text>
            ) : (
              <View style={styles.recipeFooter}>
                <PaperText variant="bodySmall" style={styles.recipeUsername}>
                  @{recipe.username || userProfile?.username || 'user'}
                </PaperText>
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
                  <PaperText variant="bodySmall" style={[styles.likeCount, isLiked && { color: colors.highlight }]}>
                    {displayCount}
                  </PaperText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    let icon, primaryText, secondaryText, showButton;

    switch (activeTab) {
      case 'Published':
      case 'All':
        icon = '📝';
        primaryText = 'No recipes published yet';
        secondaryText = 'Create your first recipe!';
        showButton = true;
        break;
      case 'Drafts':
        icon = '✏️';
        primaryText = 'No drafts saved yet';
        secondaryText = 'Start creating to save drafts';
        showButton = false;
        break;
      default:
        return null;
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>{icon}</Text>
        <Text style={styles.emptyPrimary}>{primaryText}</Text>
        <Text style={styles.emptySecondary}>{secondaryText}</Text>
        {showButton && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CreateModal')}
          >
            <Text style={styles.createButtonText}>Create Recipe</Text>
          </TouchableOpacity>
        )}
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

const ProfileScreen = ({ navigation }) => {
  const { signOut, userProfile, user, refreshProfile } = useAuth();
  const { likedRecipes, likeCounts, toggleLike } = useLikes();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState(1); // 0: All, 1: Published (default), 2: Drafts
  const pagerRef = useRef(null);

  // Recipe state management
  const [allRecipes, setAllRecipes] = useState([]);
  const [publishedRecipes, setPublishedRecipes] = useState([]);
  const [draftRecipes, setDraftRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Avatar upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Real-time stats state (updated via Firestore listener)
  const [localStats, setLocalStats] = useState(null);

  // Shared value for animated tab indicator
  const scrollOffset = useSharedValue(1); // Start at tab 1 (Published)

  const tabs = ['All', 'Published', 'Drafts'];
  const CONTAINER_PADDING = 20; // Match categoryTabs paddingHorizontal
  const tabWidth = (SCREEN_WIDTH - CONTAINER_PADDING * 2) / tabs.length;
  const INDICATOR_WIDTH = 80; // Fixed width for the indicator

  // Load recipes from Firestore
  const loadRecipes = async () => {
    if (!user || !user.uid) {
      console.log('[ProfileScreen] No user logged in');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[ProfileScreen] Loading recipes for user:', user.uid);

      // Load all three recipe sets in parallel
      const [all, published, drafts] = await Promise.all([
        getUserRecipes(user.uid, { status: null }),
        getUserRecipes(user.uid, { status: 'published' }),
        getUserRecipes(user.uid, { status: 'draft' }),
      ]);

      // Format recipes for UI consumption
      const formatRecipe = (recipe) => ({
        id: recipe.id,
        title: recipe.title,
        image: recipe.imageSource,
        aspectRatio: recipe.aspectRatio || 1.0,
        cookingTime: recipe.cookingTime,
        likes: recipe.likeCount,
        comments: recipe.commentCount,
        status: recipe.status,
        username: recipe.authorUsername, // Map authorUsername to username for display
        // Include full recipe data for navigation
        ...recipe,
      });

      // 🎯 Apply pending optimistic likes to fresh data
      const allFormatted = all.map(formatRecipe);
      const publishedFormatted = published.map(formatRecipe);
      const draftsFormatted = drafts.map(formatRecipe);

      setAllRecipes(applyPendingLikesToRecipes(allFormatted));
      setPublishedRecipes(applyPendingLikesToRecipes(publishedFormatted));
      setDraftRecipes(applyPendingLikesToRecipes(draftsFormatted));

      console.log('[ProfileScreen] Recipes loaded:', {
        all: all.length,
        published: published.length,
        drafts: drafts.length,
      });
    } catch (err) {
      console.error('[ProfileScreen] Error loading recipes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Refresh user profile when screen comes into focus (e.g., after editing profile)
  useFocusEffect(
    useCallback(() => {
      const refreshUserProfile = async () => {
        if (user?.uid) {
          console.log('[ProfileScreen] Refreshing user profile on focus');
          await refreshProfile();
        }
      };
      refreshUserProfile();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid]) // Only depend on user ID, not refreshProfile function
  );

  // Reload recipes when screen comes into focus (e.g., after deleting from RecipeDetailScreen)
  useFocusEffect(
    useCallback(() => {
      loadRecipes();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid]) // Only depend on user ID, loadRecipes is not memoized
  );

  // Real-time listener for user stats updates
  useEffect(() => {
    if (!user || !user.uid) {
      console.log('[ProfileScreen] No user for stats listener');
      return;
    }

    console.log('[ProfileScreen] Setting up real-time stats listener for user:', user.uid);

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          if (userData.stats) {
            console.log('[ProfileScreen] ✅ Real-time stats update received:', {
              recipesCount: userData.stats.recipesCount,
              likesReceived: userData.stats.likesReceived,
              followersCount: userData.stats.followersCount,
              timestamp: new Date().toISOString()
            });
            setLocalStats(userData.stats);
          }
        } else {
          console.warn('[ProfileScreen] User document does not exist');
        }
      },
      (error) => {
        console.error('[ProfileScreen] Stats listener error:', error);
      }
    );

    return () => {
      console.log('[ProfileScreen] Cleaning up stats listener');
      unsubscribe();
    };
  }, [user]);

  // Get filtered recipes based on tab
  const getFilteredRecipes = (tabName) => {
    switch (tabName) {
      case 'All':
        return allRecipes;
      case 'Published':
        return publishedRecipes;
      case 'Drafts':
        return draftRecipes;
      default:
        return allRecipes;
    }
  };

  // Handle tab button press - sync with PagerView
  const handleTabPress = (index) => {
    setActiveTab(index);
    pagerRef.current?.setPage(index);
  };

  // Handle PagerView page change - sync with tab buttons
  const handlePageSelected = (e) => {
    setActiveTab(e.nativeEvent.position);
  };

  // Handle scroll event for animated indicator
  const handlePageScroll = (e) => {
    'worklet';
    const { position, offset } = e.nativeEvent;
    scrollOffset.value = position + offset;
  };

  // Animated style for tab indicator
  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const centerOffset = (tabWidth - INDICATOR_WIDTH) / 2;
    return {
      transform: [{
        translateX: CONTAINER_PADDING + scrollOffset.value * tabWidth + centerOffset
      }],
    };
  });

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

  // Format user stats for display (prioritize real-time localStats over userProfile.stats)
  const displayStats = useMemo(() => {
    // Use localStats if available (real-time updates), otherwise fallback to userProfile.stats
    const statsSource = localStats || (userProfile ? userProfile.stats : null);

    if (!statsSource) {
      return { recipes: 0, likes: 0, views: 0, followers: 0, following: 0 };
    }

    const formatted = formatUserStats(statsSource);
    console.log('[ProfileScreen] 📊 displayStats recalculated:', {
      source: localStats ? 'localStats (real-time)' : 'userProfile.stats',
      recipes: formatted.recipes,
      likes: formatted.likes,
      followers: formatted.followers
    });
    return formatted;
  }, [localStats, userProfile]);

  // Handle statistic tap
  const handleStatTap = (statName) => {
    if (statName === 'Recipes') {
      handleTabPress(1); // Switch to Published tab
    } else if (statName === 'Followers') {
      console.log('Show Followers List (Phase 2)');
      Alert.alert('Coming Soon', 'Followers list will be available in a future update.');
    }
  };

  // Handle edit profile (Avatar Upload)
  const handleEditProfile = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to upload an avatar.'
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1], // Square avatar
        quality: 1,
      });

      if (result.canceled) {
        console.log('[ProfileScreen] Image selection cancelled');
        return;
      }

      const imageUri = result.assets[0].uri;
      console.log('[ProfileScreen] Selected image:', imageUri);

      // Show uploading state
      setUploading(true);
      setUploadProgress(0);

      // Upload to Firebase Storage
      const uploadResult = await storageService.uploadUserAvatar(
        user.uid,
        imageUri,
        (progress) => {
          console.log(`[ProfileScreen] Upload progress: ${progress.toFixed(1)}%`);
          setUploadProgress(progress);
        }
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error.message);
      }

      console.log('[ProfileScreen] Upload successful:', uploadResult.data.downloadURL);

      // Update Firestore user profile
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        avatar: uploadResult.data.downloadURL,
        updatedAt: serverTimestamp(),
      });

      console.log('[ProfileScreen] Firestore updated with new avatar');

      // Refresh user profile in AuthContext
      await refreshProfile();

      // Success feedback
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error) {
      console.error('[ProfileScreen] Error uploading avatar:', error);

      let errorMessage = 'Failed to upload avatar. Please try again.';

      if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle settings - Navigate to EditProfile
  const handleSettings = () => {
    console.log('[ProfileScreen] Navigate to Edit Profile');
    navigation.navigate('EditProfile');
  };

  // Handle sign out
  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // Navigation to Login will be handled automatically by AppNavigator
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Handle check for updates
  const handleCheckForUpdates = async () => {
    try {
      console.log('[ProfileScreen] Checking for updates...');

      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        Alert.alert(
          'Update Available',
          'A new update is available. Would you like to download and install it now?',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Update Now',
              onPress: async () => {
                try {
                  await Updates.fetchUpdateAsync();
                  Alert.alert(
                    'Update Downloaded',
                    'The update has been downloaded. The app will reload now.',
                    [
                      {
                        text: 'Reload',
                        onPress: () => Updates.reloadAsync(),
                      },
                    ]
                  );
                } catch (error) {
                  console.error('[ProfileScreen] Error downloading update:', error);
                  Alert.alert('Error', 'Failed to download update. Please try again later.');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('No Updates', 'You are already running the latest version!');
      }
    } catch (error) {
      console.error('[ProfileScreen] Error checking for updates:', error);
      Alert.alert('Error', 'Failed to check for updates. Please try again later.');
    }
  };

  // Handle about app - Show version info
  const handleAboutApp = () => {
    const appVersion = Constants.expoConfig?.version || '1.0.0';
    const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || 'N/A';
    const updateId = Updates.updateId || 'No OTA update';
    const channel = Updates.channel || 'N/A';

    Alert.alert(
      'About iQ Studio',
      `Version: ${appVersion} (Build ${buildNumber})\n\nUpdate Channel: ${channel}\nUpdate ID: ${updateId}\n\nA Chef iQ recipe creation and sharing platform.`,
      [
        { text: 'Check for Updates', onPress: handleCheckForUpdates },
        { text: 'OK', style: 'cancel' }
      ]
    );
  };

  // Handle more menu
  const handleMoreMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'About App', 'Sign Out'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleAboutApp();
          } else if (buttonIndex === 2) {
            handleSignOut();
          }
        }
      );
    } else {
      Alert.alert(
        'Profile Menu',
        'Choose an option',
        [
          { text: 'About App', onPress: handleAboutApp },
          { text: 'Sign Out', style: 'destructive', onPress: handleSignOut },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );
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

  // Handle delete recipe
  const handleDeleteRecipe = async (recipeId, recipeTitle) => {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipeTitle}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[ProfileScreen] Deleting recipe:', recipeId);

              const result = await recipeService.deleteRecipe(recipeId, user.uid);

              if (!result.success) {
                throw new Error(result.error.message);
              }

              console.log('[ProfileScreen] Recipe deleted successfully');

              // Reload recipes to update the UI
              await loadRecipes();

              // Show success feedback
              Alert.alert('Success', 'Recipe deleted successfully');
            } catch (error) {
              console.error('[ProfileScreen] Error deleting recipe:', error);
              Alert.alert('Delete Failed', error.message || 'Failed to delete recipe. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
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
        <MaterialCommunityIcons name="alert-circle" size={64} color={colors.textSecondary} />
        <Text style={styles.errorText}>Failed to load profile</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadRecipes}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Header Section - Matches HomeScreen style */}
      <View style={styles.headerSection}>
        {/* Top Bar with Settings and Dark Mode Toggle */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Profile</Text>
          <View style={styles.topBarActions}>
            {/* Dark Mode Toggle */}
            <View style={styles.darkModeToggle}>
              <MaterialCommunityIcons
                name={isDarkMode ? "weather-night" : "white-balance-sunny"}
                size={20}
                color={colors.text}
                style={{ marginRight: 6 }}
              />
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#E5E5E5', true: colors.primary }}
                thumbColor={isDarkMode ? '#FFFFFF' : '#F4F3F4'}
                ios_backgroundColor="#E5E5E5"
              />
            </View>
            <TouchableOpacity onPress={handleSettings} style={styles.iconButton}>
              <MaterialCommunityIcons name="cog-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleMoreMenu} style={styles.iconButton}>
              <MaterialCommunityIcons name="dots-vertical" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <ProfileHeader
          userProfile={userProfile || { username: 'User', handle: '@user', avatar: null }}
          onEditProfile={handleEditProfile}
          stats={displayStats}
          onStatTap={handleStatTap}
          formatNumber={formatNumber}
          uploading={uploading}
          uploadProgress={uploadProgress}
          colors={colors}
        />

        {/* Tab Navigation - Same style as HomeScreen */}
        <View style={styles.categoryTabs}>
          {tabs.map((tab, index) => (
            <TouchableOpacity
              key={tab}
              style={styles.tabButton}
              onPress={() => handleTabPress(index)}
              activeOpacity={0.7}
            >
              <PaperText
                variant="bodyLarge"
                style={[
                  styles.tabText,
                  activeTab === index && styles.tabTextActive,
                ]}
              >
                {tab}
              </PaperText>
            </TouchableOpacity>
          ))}
          {/* Animated Tab Indicator */}
          <Animated.View style={[styles.tabIndicator, { width: INDICATOR_WIDTH }, animatedIndicatorStyle]} />
        </View>
      </View>

      {/* PagerView with Recipe Grids - Same as HomeScreen */}
      <AnimatedPagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={1} // Start with "Published" tab
        onPageSelected={handlePageSelected}
        onPageScroll={handlePageScroll}
        offscreenPageLimit={2} // Keep all 3 tabs in memory
      >
        {/* Page 0: All Tab */}
        <View key="0" style={styles.page}>
          <TabContent
            recipes={getFilteredRecipes('All')}
            activeTab="All"
            navigation={navigation}
            onDeleteRecipe={handleDeleteRecipe}
            likedRecipes={likedRecipes}
            likeCounts={likeCounts}
            userProfile={userProfile}
            toggleLike={handleToggleLike}
            colors={colors}
          />
        </View>

        {/* Page 1: Published Tab (Default) */}
        <View key="1" style={styles.page}>
          <TabContent
            recipes={getFilteredRecipes('Published')}
            activeTab="Published"
            navigation={navigation}
            onDeleteRecipe={handleDeleteRecipe}
            likedRecipes={likedRecipes}
            likeCounts={likeCounts}
            userProfile={userProfile}
            toggleLike={handleToggleLike}
            colors={colors}
          />
        </View>

        {/* Page 2: Drafts Tab */}
        <View key="2" style={styles.page}>
          <TabContent
            recipes={getFilteredRecipes('Drafts')}
            activeTab="Drafts"
            navigation={navigation}
            onDeleteRecipe={handleDeleteRecipe}
            likedRecipes={likedRecipes}
            likeCounts={likeCounts}
            userProfile={userProfile}
            toggleLike={handleToggleLike}
            colors={colors}
          />
        </View>
      </AnimatedPagerView>
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
  retryButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSection: {
    backgroundColor: colors.card,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
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

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  darkModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  iconButton: {
    padding: 4,
  },

  // Profile Header (same layout as PublicProfileScreen)
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
    position: 'relative',
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
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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

  // Tags - Wrapping layout (no scrolling)
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  tag: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tagText: {
    fontSize: 13,
    color: colors.text,
  },

  // Bio Section
  bioContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  bioText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 19.6,
  },

  // Stats Row (matches PublicProfileScreen style)
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

  // Tab Navigation (HomeScreen style)
  categoryTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  tabButton: {
    flex: 1, // Each tab takes equal width
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  tabText: {
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 18,
    includeFontPadding: false,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },

  // Recipe Grid (Masonry Layout)
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
  draftCard: {
    borderWidth: 2,
    borderColor: colors.draftBorder,
    // Note: dashed borders not supported on iOS, using solid border
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
  draftStatus: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyPrimary: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySecondary: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ProfileScreen;
