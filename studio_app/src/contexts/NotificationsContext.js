import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import notificationService from '../services/notificationService';

const NotificationsContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
};

export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Load unread count when user logs in
  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    // Load initial notifications to get unread count
    const loadUnreadCount = async () => {
      try {
        const result = await notificationService.loadNotifications(user.uid);
        if (result.success) {
          const count = result.data.notifications.filter(n => !n.isRead).length;
          setUnreadCount(count);
        }
      } catch (error) {
        console.warn('Failed to load unread count:', error);
      }
    };

    loadUnreadCount();
  }, [user?.uid]);

  // Mark all as read (called when NotificationsScreen opens)
  const markAllAsRead = () => {
    setUnreadCount(0);
  };

  const value = {
    unreadCount,
    markAllAsRead,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};
