import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  Dimensions,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Keyboard,
  TextInput,
} from 'react-native';
import { Text, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import PagerView from 'react-native-pager-view';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { useLikes } from '../contexts/LikeContext';
import { useTheme } from '../contexts/ThemeContext';
import likeService from '../services/likeService';
import feedService from '../services/feedService';
import { applyPendingLikesToRecipes } from '../utils/recipeHelpers';
import { searchRecipes, searchUsers } from '../services/searchService';
import { FILTER_OPTIONS } from '../data/mockSearchData';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tab Content Component - Renders masonry layout for each tab
const TabContent = ({
  recipes,
  likedRecipes,
  likeCounts,
  toggleLike,
  navigation,
  loading,
  loadingMore,
  refreshing,
  onRefresh,
  onEndReached,
  emptyMessage,
  user, // Add user prop for author check
  colors, // Add colors prop
}) => {
  const CARD_WIDTH = (SCREEN_WIDTH - 36) / 2;
  const tabBarHeight = Platform.OS === 'ios' ? 85 : 65;
  const scrollViewRef = useRef(null);

  // Create styles for this component
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Split recipes into two columns for masonry layout
  const { leftColumn, rightColumn } = useMemo(() => {
    const left = [];
    const right = [];
    let leftHeight = 0;
    let rightHeight = 0;

    recipes.forEach((recipe) => {
      const imageHeight = CARD_WIDTH * recipe.aspectRatio;
      const cardHeight = imageHeight + 80;

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
    const isLiked = likedRecipes.has(recipe.id);
    const displayCount = likeCounts[recipe.id] ?? recipe.likeCount;
    const imageHeight = CARD_WIDTH * recipe.aspectRatio;

    return (
      <TouchableOpacity
        key={recipe.id}
        style={[styles.recipeCard, { width: CARD_WIDTH }]}
        onPress={() => {
          navigation.navigate('RecipeDetail', {
            recipeId: recipe.id,
          });
        }}
        activeOpacity={0.9}
      >
        <Image
          source={recipe.imageSource}
          style={[styles.recipeImage, { height: imageHeight }]}
          resizeMode="cover"
        />
        <View style={styles.recipeInfo}>
          <Text variant="titleMedium" style={styles.recipeTitle} numberOfLines={2}>
            {recipe.title}
          </Text>
          <View style={styles.recipeFooter}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                // Navigate to public profile if not own recipe
                if (recipe.authorId && recipe.authorId !== user?.uid) {
                  navigation.navigate('PublicProfile', { userId: recipe.authorId });
                }
              }}
              activeOpacity={0.7}
            >
              <Text variant="bodySmall" style={styles.username}>
                @{recipe.username}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.likeButton}
              onPress={(e) => {
                e.stopPropagation();
                toggleLike(recipe.id);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={16}
                color={isLiked ? colors.highlight : colors.textSecondary}
              />
              <Text
                variant="bodySmall"
                style={[styles.likeCount, isLiked && { color: colors.highlight }]}
              >
                {displayCount}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Show loading indicator on initial load
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading recipes...
        </Text>
      </View>
    );
  }

  // Show empty state if no recipes
  if (!loading && recipes.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text variant="titleMedium" style={styles.emptyText}>
          {emptyMessage || 'Uh-oh, nothing was found yet'}
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={styles.feedContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      onScroll={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        const paddingToBottom = 100;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
          onEndReached?.();
        }
      }}
      scrollEventThrottle={400}
    >
      <View style={styles.masonryContainer}>
        <View style={styles.column}>{leftColumn.map((recipe) => renderRecipeCard(recipe))}</View>
        <View style={styles.column}>{rightColumn.map((recipe) => renderRecipeCard(recipe))}</View>
      </View>

      {loadingMore && (
        <View style={styles.loadingMoreContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text variant="bodySmall" style={styles.loadingMoreText}>
            Loading more...
          </Text>
        </View>
      )}

      <View style={[styles.bottomDivider, { marginBottom: tabBarHeight }]} />
    </ScrollView>
  );
};

// User List Item Component for Users Tab
const UserListItem = ({ user, navigation, colors }) => {
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatFollowers = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => {
        if (user.userId) {
          navigation.navigate('PublicProfile', { userId: user.userId });
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.userAvatar}>
        {user.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.userAvatarImage} />
        ) : (
          <MaterialCommunityIcons name="account" size={32} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userUsername}>{user.username}</Text>
        <Text style={styles.userHandle}>{user.handle}</Text>
        <Text style={styles.userFollowers}>{formatFollowers(user.followersCount)} followers</Text>
      </View>
    </TouchableOpacity>
  );
};

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { likedRecipes, likeCounts, toggleLike } = useLikes();
  const { colors } = useTheme();

  // Generate dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Search mode state: 'inactive', 'input', 'results'
  const [searchMode, setSearchMode] = useState('inactive');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInputFocused, setSearchInputFocused] = useState(false);

  // Home feed state
  const [activeTab, setActiveTab] = useState(1); // 0: Following, 1: All (trending algorithm, default), 2: Latest (chronological)
  const pagerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Recipe data state per tab
  const [followingRecipes, setFollowingRecipes] = useState([]);
  const [allRecipes, setAllRecipes] = useState([]);
  const [trendingRecipes, setTrendingRecipes] = useState([]);

  // Loading states per tab
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [loadingAll, setLoadingAll] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(false);

  // Loading more states per tab
  const [loadingMoreFollowing, setLoadingMoreFollowing] = useState(false);
  const [loadingMoreAll, setLoadingMoreAll] = useState(false);
  const [loadingMoreTrending, setLoadingMoreTrending] = useState(false);

  // Refreshing states per tab
  const [refreshingFollowing, setRefreshingFollowing] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingTrending, setRefreshingTrending] = useState(false);

  // Pagination cursors per tab
  const [lastVisibleAll, setLastVisibleAll] = useState(null);
  const [lastVisibleTrending, setLastVisibleTrending] = useState(null);
  const [followingOffset, setFollowingOffset] = useState(0);

  // Has more flags per tab
  const [hasMoreFollowing, setHasMoreFollowing] = useState(true);
  const [hasMoreAll, setHasMoreAll] = useState(true);
  const [hasMoreTrending, setHasMoreTrending] = useState(true);

  // Empty state messages per tab
  const [emptyMessageFollowing, setEmptyMessageFollowing] = useState('');
  const [emptyMessageAll, setEmptyMessageAll] = useState('');
  const [emptyMessageTrending, setEmptyMessageTrending] = useState('');

  // Search results state
  const [searchActiveTab, setSearchActiveTab] = useState('recipes'); // 'recipes' or 'users'
  const [searchRecipeResults, setSearchRecipeResults] = useState([]);
  const [searchUserResults, setSearchUserResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Filter state
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    difficulty: [],
    equipment: [],
    cuisineType: [],
  });

  // Shared values for animations
  const scrollOffset = useSharedValue(1); // Start at tab 1 (All)
  const searchScrollOffset = useSharedValue(0); // For search tabs

  const homeTabs = ['Following', 'All', 'Latest'];
  const searchTabs = ['Recipes', 'Users'];
  const CONTAINER_PADDING = 20;
  const homeTabWidth = (SCREEN_WIDTH - CONTAINER_PADDING * 2) / homeTabs.length;
  const searchTabWidth = (SCREEN_WIDTH - CONTAINER_PADDING * 2) / searchTabs.length;
  const INDICATOR_WIDTH = 80;

  // Fetch feeds (same as before)
  const fetchFollowingFeed = async (isRefresh = false) => {
    if (!user?.uid) return;

    try {
      if (isRefresh) {
        setRefreshingFollowing(true);
      } else if (followingRecipes.length === 0) {
        setLoadingFollowing(true);
      } else {
        setLoadingMoreFollowing(true);
      }

      const offset = isRefresh ? 0 : followingOffset;
      const result = await feedService.getFollowingFeed(user.uid, 20, offset);

      if (result.success) {
        if (result.data.isEmpty) {
          setFollowingRecipes([]);
          setEmptyMessageFollowing('Follow users to see their recipes');
          setHasMoreFollowing(false);
        } else {
          const recipesWithOptimistic = applyPendingLikesToRecipes(result.data.recipes);

          if (isRefresh) {
            setFollowingRecipes(recipesWithOptimistic);
            setFollowingOffset(result.data.offset);
          } else {
            setFollowingRecipes((prev) => [...prev, ...recipesWithOptimistic]);
            setFollowingOffset(result.data.offset);
          }
          setHasMoreFollowing(result.data.hasMore);
        }
      } else {
        Alert.alert('Error', result.error.message);
      }
    } catch (error) {
      console.error('Failed to fetch following feed:', error);
      Alert.alert('Error', 'Failed to load following feed');
    } finally {
      setLoadingFollowing(false);
      setLoadingMoreFollowing(false);
      setRefreshingFollowing(false);
    }
  };

  const fetchAllFeed = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshingAll(true);
      } else if (allRecipes.length === 0) {
        setLoadingAll(true);
      } else {
        setLoadingMoreAll(true);
      }

      const lastVisible = isRefresh ? null : lastVisibleAll;
      // All tab now uses TRENDING algorithm (sorted by trendingScore)
      const result = await feedService.getTrendingFeed(20, lastVisible);

      if (result.success) {
        if (result.data.recipes.length === 0) {
          setEmptyMessageAll('No recipes yet');
          setHasMoreAll(false);
        } else {
          const recipesWithOptimistic = applyPendingLikesToRecipes(result.data.recipes);

          if (isRefresh) {
            setAllRecipes(recipesWithOptimistic);
          } else {
            setAllRecipes((prev) => [...prev, ...recipesWithOptimistic]);
          }
          setLastVisibleAll(result.data.lastVisible);
          setHasMoreAll(result.data.hasMore);
        }
      } else {
        Alert.alert('Error', result.error.message);
      }
    } catch (error) {
      console.error('Failed to fetch all feed:', error);
      Alert.alert('Error', 'Failed to load recipes');
    } finally {
      setLoadingAll(false);
      setLoadingMoreAll(false);
      setRefreshingAll(false);
    }
  };

  const fetchTrendingFeed = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshingTrending(true);
      } else if (trendingRecipes.length === 0) {
        setLoadingTrending(true);
      } else {
        setLoadingMoreTrending(true);
      }

      const lastVisible = isRefresh ? null : lastVisibleTrending;
      // Latest tab now uses CHRONOLOGICAL order (sorted by publishedAt)
      const result = await feedService.getAllRecipesFeed(20, lastVisible);

      if (result.success) {
        if (result.data.recipes.length === 0) {
          setEmptyMessageTrending('No recipes yet');
          setHasMoreTrending(false);
        } else {
          const recipesWithOptimistic = applyPendingLikesToRecipes(result.data.recipes);

          if (isRefresh) {
            setTrendingRecipes(recipesWithOptimistic);
          } else {
            setTrendingRecipes((prev) => [...prev, ...recipesWithOptimistic]);
          }
          setLastVisibleTrending(result.data.lastVisible);
          setHasMoreTrending(result.data.hasMore);
        }
      } else {
        Alert.alert('Error', result.error.message);
      }
    } catch (error) {
      console.error('Failed to fetch latest feed:', error);
      Alert.alert('Error', 'Failed to load latest recipes');
    } finally {
      setLoadingTrending(false);
      setLoadingMoreTrending(false);
      setRefreshingTrending(false);
    }
  };

  useEffect(() => {
    fetchAllFeed();
  }, []);

  useEffect(() => {
    if (activeTab === 0 && followingRecipes.length === 0 && !loadingFollowing) {
      fetchFollowingFeed();
    } else if (activeTab === 1 && allRecipes.length === 0 && !loadingAll) {
      fetchAllFeed();
    } else if (activeTab === 2 && trendingRecipes.length === 0 && !loadingTrending) {
      fetchTrendingFeed();
    }
  }, [activeTab]);


  // Reset search mode when screen loses focus
  useFocusEffect(
    useCallback(() => {
      // Cleanup function runs when screen loses focus
      return () => {
        setSearchMode('inactive');
        setSearchQuery('');
        setSearchRecipeResults([]);
        setSearchUserResults([]);
        setSelectedFilters({ difficulty: [], equipment: [], cuisineType: [] });
        setFilterExpanded(false);
        setSearchActiveTab('recipes');
        setSearchInputFocused(false);
        Keyboard.dismiss();
      };
    }, [])
  );

  const handleRefresh = () => {
    if (activeTab === 0) {
      fetchFollowingFeed(true);
    } else if (activeTab === 1) {
      fetchAllFeed(true);
    } else if (activeTab === 2) {
      fetchTrendingFeed(true);
    }
  };

  const handleLoadMore = () => {
    if (activeTab === 0 && hasMoreFollowing && !loadingMoreFollowing) {
      fetchFollowingFeed(false);
    } else if (activeTab === 1 && hasMoreAll && !loadingMoreAll) {
      fetchAllFeed(false);
    } else if (activeTab === 2 && hasMoreTrending && !loadingMoreTrending) {
      fetchTrendingFeed(false);
    }
  };

  const getCurrentTabData = () => {
    if (activeTab === 0) {
      return {
        recipes: followingRecipes,
        loading: loadingFollowing,
        loadingMore: loadingMoreFollowing,
        refreshing: refreshingFollowing,
        emptyMessage: emptyMessageFollowing,
      };
    } else if (activeTab === 1) {
      return {
        recipes: allRecipes,
        loading: loadingAll,
        loadingMore: loadingMoreAll,
        refreshing: refreshingAll,
        emptyMessage: emptyMessageAll,
      };
    } else {
      return {
        recipes: trendingRecipes,
        loading: loadingTrending,
        loadingMore: loadingMoreTrending,
        refreshing: refreshingTrending,
        emptyMessage: emptyMessageTrending,
      };
    }
  };

  // Wrapper to call global toggleLike with current recipe count
  const handleToggleLike = async (recipeId) => {
    if (!user?.uid) {
      Alert.alert('Login Required', 'Please sign in to like recipes');
      return;
    }

    // Find the recipe to get its current count
    const allRecipeLists = [...followingRecipes, ...allRecipes, ...trendingRecipes, ...searchRecipeResults];
    const recipe = allRecipeLists.find(r => r.id === recipeId);
    const currentCount = recipe?.likeCount || 0;

    // Call global toggleLike from LikeContext
    const result = await toggleLike(recipeId, currentCount);

    if (!result.success) {
      Alert.alert('Operation Failed', result.error || 'Failed to update like status');
    }
  };

  const handleTabPress = (index) => {
    setActiveTab(index);
    pagerRef.current?.setPage(index);
  };

  const handlePageSelected = (e) => {
    setActiveTab(e.nativeEvent.position);
  };

  const handlePageScroll = (e) => {
    'worklet';
    const { position, offset } = e.nativeEvent;
    scrollOffset.value = position + offset;
  };

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const centerOffset = (homeTabWidth - INDICATOR_WIDTH) / 2;
    return {
      transform: [
        {
          translateX: CONTAINER_PADDING + scrollOffset.value * homeTabWidth + centerOffset,
        },
      ],
    };
  });

  // Search functions
  const handleSearchBarPress = () => {
    setSearchMode('input');
    setSearchInputFocused(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const executeSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      Alert.alert('Invalid Search', 'Please enter at least 2 characters to search');
      return;
    }

    Keyboard.dismiss();
    setSearchLoading(true);
    setSearchMode('results');

    try {
      // Search both recipes and users in parallel
      const [recipesResult, usersResult] = await Promise.all([
        searchRecipes(searchQuery, selectedFilters),
        searchUsers(searchQuery),
      ]);

      if (recipesResult.success) {
        setSearchRecipeResults(recipesResult.data.recipes);
      }

      if (usersResult.success) {
        setSearchUserResults(usersResult.data.users);
      }
    } catch (error) {
      console.error('Search failed:', error);
      Alert.alert('Error', 'Failed to search. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const exitSearchMode = () => {
    setSearchMode('inactive');
    setSearchQuery('');
    setSearchRecipeResults([]);
    setSearchUserResults([]);
    setSelectedFilters({ difficulty: [], equipment: [], cuisineType: [] });
    setFilterExpanded(false);
    setSearchActiveTab('recipes');
    setSearchInputFocused(false);
    Keyboard.dismiss();
  };

  const toggleFilter = (category, value) => {
    setSelectedFilters((prev) => {
      const currentValues = prev[category];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];

      return {
        ...prev,
        [category]: newValues,
      };
    });
  };

  const applyFilters = async () => {
    setFilterExpanded(false);
    setSearchLoading(true);

    try {
      const result = await searchRecipes(searchQuery, selectedFilters);
      if (result.success) {
        setSearchRecipeResults(result.data.recipes);
      }
    } catch (error) {
      console.error('Filter failed:', error);
      Alert.alert('Error', 'Failed to apply filters. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const resetFilters = async () => {
    setSelectedFilters({ difficulty: [], equipment: [], cuisineType: [] });
    setFilterExpanded(false);
    setSearchLoading(true);

    try {
      const result = await searchRecipes(searchQuery, {});
      if (result.success) {
        setSearchRecipeResults(result.data.recipes);
      }
    } catch (error) {
      console.error('Reset failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const animatedSearchIndicatorStyle = useAnimatedStyle(() => {
    const tabIndex = searchActiveTab === 'recipes' ? 0 : 1;
    const centerOffset = (searchTabWidth - INDICATOR_WIDTH) / 2;
    return {
      transform: [
        {
          translateX: CONTAINER_PADDING + tabIndex * searchTabWidth + centerOffset,
        },
      ],
    };
  });

  // Render search tabs
  const renderSearchTabs = () => (
    <View style={styles.categoryTabs}>
      {searchTabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={styles.tabButton}
          onPress={() => setSearchActiveTab(tab.toLowerCase())}
          activeOpacity={0.7}
        >
          <Text
            variant="bodyLarge"
            style={[
              styles.tabText,
              searchActiveTab === tab.toLowerCase() && styles.tabTextActive,
            ]}
          >
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
      <Animated.View
        style={[styles.tabIndicator, { width: INDICATOR_WIDTH }, animatedSearchIndicatorStyle]}
      />
    </View>
  );

  // Render filter panel
  const renderFilterPanel = () => {
    if (!filterExpanded) return null;

    const tabBarHeight = Platform.OS === 'ios' ? 85 : 65;
    const filterPanelTop = 200; // Top position from styles
    const filterPanelContentHeight = 500; // Estimated content height

    return (
      <>
        {/* Dark overlay below filter panel */}
        <TouchableOpacity
          style={[
            styles.overlayMask,
            {
              top: filterPanelTop + filterPanelContentHeight,
              bottom: tabBarHeight,
            }
          ]}
          activeOpacity={1}
          onPress={() => setFilterExpanded(false)}
        />

        {/* Filter panel */}
        <View style={styles.filterPanel}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Difficulty */}
            <Text style={styles.filterSectionTitle}>🎯 Difficulty</Text>
            <View style={styles.filterOptions}>
              {FILTER_OPTIONS.difficulty.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.filterOption}
                  onPress={() => toggleFilter('difficulty', option.value)}
                  activeOpacity={0.7}
                >
                  <Checkbox.Android
                    status={
                      selectedFilters.difficulty.includes(option.value) ? 'checked' : 'unchecked'
                    }
                    onPress={() => toggleFilter('difficulty', option.value)}
                    color={colors.primary}
                  />
                  <Text style={styles.filterOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Equipment */}
            <Text style={styles.filterSectionTitle}>🍳 Equipment</Text>
            <View style={styles.filterOptions}>
              {FILTER_OPTIONS.equipment.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.filterOptionFullWidth}
                  onPress={() => toggleFilter('equipment', option.value)}
                  activeOpacity={0.7}
                >
                  <Checkbox.Android
                    status={
                      selectedFilters.equipment.includes(option.value) ? 'checked' : 'unchecked'
                    }
                    onPress={() => toggleFilter('equipment', option.value)}
                    color={colors.primary}
                  />
                  <Text style={styles.filterOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cuisine Type */}
            <Text style={styles.filterSectionTitle}>🌏 Cuisine Type</Text>
            <View style={styles.filterOptions}>
              {FILTER_OPTIONS.cuisineType.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.filterOption}
                  onPress={() => toggleFilter('cuisineType', option.value)}
                  activeOpacity={0.7}
                >
                  <Checkbox.Android
                    status={
                      selectedFilters.cuisineType.includes(option.value) ? 'checked' : 'unchecked'
                    }
                    onPress={() => toggleFilter('cuisineType', option.value)}
                    color={colors.primary}
                  />
                  <Text style={styles.filterOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action buttons */}
            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </>
    );
  };

  // Render search results
  const renderSearchResults = () => {
    if (searchLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Searching...
          </Text>
        </View>
      );
    }

    if (searchActiveTab === 'recipes') {
      return (
        <TabContent
          recipes={searchRecipeResults}
          likedRecipes={likedRecipes}
          likeCounts={likeCounts}
          toggleLike={handleToggleLike}
          navigation={navigation}
          loading={false}
          loadingMore={false}
          refreshing={false}
          onRefresh={() => {}}
          onEndReached={() => {}}
          emptyMessage="Uh-oh, nothing was found yet"
          user={user}
          colors={colors}
        />
      );
    } else {
      // Users tab
      if (searchUserResults.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Text variant="titleMedium" style={styles.emptyText}>
              Uh-oh, nothing was found yet
            </Text>
          </View>
        );
      }

      return (
        <ScrollView contentContainerStyle={styles.userListContainer} showsVerticalScrollIndicator={false}>
          {searchUserResults.map((user) => (
            <UserListItem key={user.userId} user={user} navigation={navigation} colors={colors} />
          ))}
        </ScrollView>
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header Section */}
      <View style={[styles.headerSection, { paddingTop: insets.top + 10 }]}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          {searchMode !== 'inactive' ? (
            <TouchableOpacity onPress={exitSearchMode} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <Text
            variant="headlineSmall"
            style={[styles.logo, searchMode !== 'inactive' && { marginLeft: 8 }]}
          >
            CHEF iQ
          </Text>
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('Notifications');
            }}
            style={styles.bellIconContainer}
          >
            <MaterialCommunityIcons name="bell-outline" size={24} color={colors.text} />
            {unreadCount > 0 && <View style={styles.bellBadge} />}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          {searchMode === 'inactive' ? (
            <TouchableOpacity
              style={styles.searchBar}
              onPress={handleSearchBarPress}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
              <Text style={styles.searchPlaceholder}>Search recipes or creators</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.searchBar, styles.searchBarActive]}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search recipes or creators"
                placeholderTextColor={colors.textSecondary}
                onSubmitEditing={executeSearch}
                returnKeyType="search"
                autoFocus={searchMode === 'input'}
                clearButtonMode="while-editing"
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={executeSearch} style={styles.searchIconButton}>
                {searchLoading ? (
                  <ActivityIndicator size={20} color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="magnify" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Category Tabs or Search Tabs */}
        {searchMode === 'inactive' ? (
          <View style={styles.categoryTabs}>
            {homeTabs.map((tab, index) => (
              <TouchableOpacity
                key={tab}
                style={styles.tabButton}
                onPress={() => handleTabPress(index)}
                activeOpacity={0.7}
              >
                <Text
                  variant="bodyLarge"
                  style={[styles.tabText, activeTab === index && styles.tabTextActive]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
            <Animated.View
              style={[styles.tabIndicator, { width: INDICATOR_WIDTH }, animatedIndicatorStyle]}
            />
          </View>
        ) : searchMode === 'results' ? (
          renderSearchTabs()
        ) : null}
      </View>

      {/* Filter Button (only in search results, recipes tab) */}
      {searchMode === 'results' && searchActiveTab === 'recipes' && (
        <TouchableOpacity
          style={[
            styles.filterButton,
            filterExpanded && styles.filterButtonActive,
          ]}
          onPress={() => setFilterExpanded(!filterExpanded)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="tune" size={20} color={colors.text} />
          <Text style={styles.filterButtonText}>Filter</Text>
          <MaterialCommunityIcons
            name={filterExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.text}
          />
        </TouchableOpacity>
      )}

      {/* Main Content */}
      {searchMode === 'input' && (
        <TouchableOpacity
          style={[styles.overlayMask, { top: insets.top + 110 }]}
          activeOpacity={1}
          onPress={exitSearchMode}
        />
      )}

      {searchMode === 'inactive' ? (
        <AnimatedPagerView
          ref={pagerRef}
          style={styles.pagerView}
          initialPage={1}
          onPageSelected={handlePageSelected}
          onPageScroll={handlePageScroll}
          offscreenPageLimit={2}
        >
          <View key="0" style={styles.page}>
            <TabContent
              recipes={followingRecipes}
              likedRecipes={likedRecipes}
              likeCounts={likeCounts}
              toggleLike={handleToggleLike}
              navigation={navigation}
              loading={loadingFollowing}
              loadingMore={loadingMoreFollowing}
              refreshing={refreshingFollowing}
              onRefresh={handleRefresh}
              onEndReached={handleLoadMore}
              emptyMessage={emptyMessageFollowing}
              user={user}
              colors={colors}
            />
          </View>

          <View key="1" style={styles.page}>
            <TabContent
              recipes={allRecipes}
              likedRecipes={likedRecipes}
              likeCounts={likeCounts}
              toggleLike={handleToggleLike}
              navigation={navigation}
              loading={loadingAll}
              loadingMore={loadingMoreAll}
              refreshing={refreshingAll}
              onRefresh={handleRefresh}
              onEndReached={handleLoadMore}
              emptyMessage={emptyMessageAll}
              user={user}
              colors={colors}
            />
          </View>

          <View key="2" style={styles.page}>
            <TabContent
              recipes={trendingRecipes}
              likedRecipes={likedRecipes}
              likeCounts={likeCounts}
              toggleLike={handleToggleLike}
              navigation={navigation}
              loading={loadingTrending}
              loadingMore={loadingMoreTrending}
              refreshing={refreshingTrending}
              onRefresh={handleRefresh}
              onEndReached={handleLoadMore}
              emptyMessage={emptyMessageTrending}
              user={user}
              colors={colors}
            />
          </View>
        </AnimatedPagerView>
      ) : searchMode === 'results' ? (
        <View style={styles.page}>{renderSearchResults()}</View>
      ) : null}

      {/* Filter Panel */}
      {renderFilterPanel()}
    </View>
  );
};

// Dynamic styles that update with theme
const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerSection: {
    backgroundColor: colors.card,
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
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  logo: {
    color: colors.primary,
    fontWeight: 'bold',
    flex: 1,
  },
  bellIconContainer: {
    position: 'relative',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.card,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchBarActive: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  searchPlaceholder: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    padding: 0,
    height: 32,
  },
  searchIconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
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
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  filterButtonActive: {
    backgroundColor: colors.accent,
  },
  filterButtonText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  overlayMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 10,
  },
  filterPanel: {
    position: 'absolute',
    top: 200,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.6,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    zIndex: 20,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    paddingVertical: 4,
  },
  filterOptionFullWidth: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 4,
  },
  filterOptionText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingBottom: 8,
  },
  resetButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  applyButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  userListContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
  },
  userUsername: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  userHandle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userFollowers: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 4,
  },
  feedContainer: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  masonryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 12,
    marginTop: 12,
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
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  recipeImage: {
    width: '100%',
    backgroundColor: colors.accent,
  },
  recipeInfo: {
    padding: 12,
  },
  recipeTitle: {
    color: colors.text,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  recipeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  username: {
    color: colors.textSecondary,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    color: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
    textAlign: 'center',
  },
});

export default HomeScreen;
