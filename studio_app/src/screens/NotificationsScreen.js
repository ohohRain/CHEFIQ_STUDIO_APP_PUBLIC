import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Text, Portal, Dialog, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNow, differenceInMinutes, differenceInHours, isToday, isThisWeek, format } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationsContext';
import notificationService from '../services/notificationService';
import { useTheme } from '../contexts/ThemeContext';

const NotificationsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { markAllAsRead } = useNotifications();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  // Load notifications on mount and enrich with sender data
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.uid) return;

      try {
        setLoading(true);
        const result = await notificationService.loadNotifications(user.uid);

        if (result.success) {
          // Enrich notifications with sender profile data
          const enrichedNotifications = await Promise.all(
            result.data.notifications.map(async (notification) => {
              // Skip system notifications (no sender)
              if (notification.type === 'system' || !notification.senderId) {
                return notification;
              }

              try {
                // Fetch sender profile
                const senderRef = doc(db, 'users', notification.senderId);
                const senderSnap = await getDoc(senderRef);

                if (senderSnap.exists()) {
                  const senderData = senderSnap.data();
                  return {
                    ...notification,
                    senderUsername: senderData.username,
                    senderHandle: senderData.handle,
                    senderAvatar: senderData.avatar,
                  };
                }
              } catch (error) {
                console.warn(`Failed to fetch sender data for notification ${notification.notificationId}:`, error);
              }

              return notification;
            })
          );

          setNotifications(enrichedNotifications);
        } else {
          Alert.alert('Error', result.error.message);
        }
      } catch (error) {
        console.error('Failed to load notifications:', error);
        Alert.alert('Error', 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [user?.uid]);

  // Auto-mark all as read on mount (simulates opening the page)
  useEffect(() => {
    if (notifications.length === 0 || loading) return;

    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length > 0) {
      // Optimistic UI update after small delay for visual effect
      setTimeout(async () => {
        const unreadIds = unreadNotifications.map(n => n.notificationId);

        // Update UI immediately (optimistic)
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

        // Clear badge in global state
        markAllAsRead();

        // Call backend service (in background)
        const result = await notificationService.markNotificationsAsRead(unreadIds);
        if (result.success) {
          console.log(`✅ Auto-marked ${unreadIds.length} notifications as read`);
        } else {
          console.warn('Failed to mark notifications as read:', result.error);
        }
      }, 300);
    }
  }, [notifications.length, loading, markAllAsRead]);

  // Format notification time
  const formatNotificationTime = (createdAt) => {
    const now = new Date();
    const notificationDate = new Date(createdAt);

    const minutesAgo = differenceInMinutes(now, notificationDate);
    const hoursAgo = differenceInHours(now, notificationDate);

    // Within 1 hour: "X minutes ago"
    if (minutesAgo < 60) {
      return `${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;
    }

    // Within today: "X hours ago"
    if (isToday(notificationDate)) {
      return `${hoursAgo} hour${hoursAgo === 1 ? '' : 's'} ago`;
    }

    // Within 7 days: "X days ago"
    if (isThisWeek(notificationDate)) {
      const daysAgo = Math.floor(hoursAgo / 24);
      return `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
    }

    // Older than 7 days: "Oct 23"
    return format(notificationDate, 'MMM dd');
  };

  // Handle notification tap
  const handleNotificationTap = (notification) => {
    console.log('Notification tapped:', notification);

    switch (notification.type) {
      case 'like':
      case 'save':
        // Navigate to Recipe Detail
        if (notification.relatedRecipeId) {
          navigation.navigate('RecipeDetail', {
            recipeId: notification.relatedRecipeId,
          });
        }
        break;

      case 'comment':
        // Navigate to Recipe Detail with focus on comments section
        if (notification.relatedRecipeId) {
          navigation.navigate('RecipeDetail', {
            recipeId: notification.relatedRecipeId,
            focusComments: true,
          });
        }
        break;

      case 'comment_like':
        // Navigate to Recipe Detail with focus on specific comment
        if (notification.relatedRecipeId) {
          navigation.navigate('RecipeDetail', {
            recipeId: notification.relatedRecipeId,
            focusComments: true,
            highlightCommentId: notification.relatedCommentId,
          });
        }
        break;

      case 'follow':
        // Navigate to Public Profile
        if (notification.senderId) {
          navigation.navigate('PublicProfile', {
            userId: notification.senderId,
          });
        }
        break;

      case 'system':
        // System notifications - can navigate to specific pages based on targetUrl
        Alert.alert('System Notification', notification.message);
        break;

      default:
        console.warn('Unknown notification type:', notification.type);
    }
  };

  // Handle delete notification
  const handleDeleteNotification = async (notificationId) => {
    // Optimistic UI update
    setNotifications(prev => prev.filter(n => n.notificationId !== notificationId));

    // Call backend service
    const result = await notificationService.deleteNotification(notificationId);
    if (!result.success) {
      console.warn('Failed to delete notification:', result.error);
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  // Handle delete all
  const handleDeleteAll = async () => {
    if (!user?.uid) return;

    // Optimistic UI update
    setNotifications([]);
    setShowDeleteAllDialog(false);

    // Call backend service
    const result = await notificationService.deleteAllNotifications(user.uid);
    if (!result.success) {
      console.warn('Failed to delete all notifications:', result.error);
      Alert.alert('Error', 'Failed to delete all notifications');
    }
  };

  // Render notification item
  const renderNotificationItem = ({ item }) => {
    const isSystemNotification = item.type === 'system';

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.isRead && styles.notificationItemUnread,
          isSystemNotification && styles.notificationItemSystem,
        ]}
        onPress={() => handleNotificationTap(item)}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {isSystemNotification ? (
            <View style={[styles.avatar, styles.systemAvatar]}>
              <MaterialCommunityIcons name="chef-hat" size={24} color="#FFFFFF" />
            </View>
          ) : (
            <View style={[styles.avatar, styles.userAvatar]}>
              {item.senderAvatar ? (
                <Image source={{ uri: item.senderAvatar }} style={styles.avatarImage} />
              ) : (
                <MaterialCommunityIcons name="account" size={24} color={colors.textSecondary} />
              )}
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.notificationContent}>
          {/* Line 1: Pre-formatted message from database */}
          <Text style={styles.notificationText} numberOfLines={2}>
            {item.message}
          </Text>

          {/* Line 3: Time */}
          <Text style={styles.notificationTime}>
            {formatNotificationTime(item.createdAt)}
          </Text>
        </View>

        {/* Delete button (only show on hover in web, always show on mobile) */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            handleDeleteNotification(item.notificationId);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No notifications yet</Text>
    </View>
  );

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Loading indicator */}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header Bar */}
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.headerTitle}>Notifications</Text>

        {/* Empty space for symmetry */}
        <View style={styles.headerRight} />
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.notificationId}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={notifications.length === 0 ? styles.emptyListContainer : undefined}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Delete All Button (only show if there are notifications) */}
      {notifications.length > 0 && (
        <View style={[styles.deleteAllContainer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.deleteAllButton}
            onPress={() => setShowDeleteAllDialog(true)}
          >
            <Text style={styles.deleteAllText}>Delete All Notifications</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Delete All Dialog */}
      <Portal>
        <Dialog visible={showDeleteAllDialog} onDismiss={() => setShowDeleteAllDialog(false)}>
          <Dialog.Title>Delete all notifications?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.textSecondary }}>This action cannot be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => setShowDeleteAllDialog(false)}
              mode="outlined"
              textColor={colors.textSecondary}
              style={styles.dialogCancelButton}
              labelStyle={styles.dialogButtonLabel}
            >
              Cancel
            </Button>
            <Button
              onPress={handleDeleteAll}
              mode="contained"
              buttonColor={colors.primary}
              textColor="#FFFFFF"
              style={styles.dialogDeleteButton}
              labelStyle={styles.dialogButtonLabel}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 44, // Same width as back button for symmetry
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  notificationItemUnread: {
    backgroundColor: '#F0FFF4',
  },
  notificationItemSystem: {
    backgroundColor: '#E6F9F0',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
  },
  systemAvatar: {
    backgroundColor: colors.primary,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  notificationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  notificationText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: 'bold',
  },
  notificationSubtext: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 2,
  },
  notificationTime: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 4,
  },
  deleteButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
    textAlign: 'center',
  },
  deleteAllContainer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  deleteAllButton: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  deleteAllText: {
    fontSize: 14,
    color: colors.error,
  },
  dialogActions: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 12,
  },
  dialogCancelButton: {
    flex: 1,
    borderRadius: 20,
    borderColor: colors.border,
    minWidth: 120,
  },
  dialogDeleteButton: {
    flex: 1,
    borderRadius: 20,
    minWidth: 120,
  },
  dialogButtonLabel: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
});

export default NotificationsScreen;
