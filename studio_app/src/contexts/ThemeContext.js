/**
 * ThemeContext - Global theme state management with dark mode support
 * Persists user preference with AsyncStorage
 *
 * IMPORTANT: This implementation follows system theme changes automatically
 * unless the user manually sets a theme preference via toggleTheme() or setThemeMode()
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme } from '../theme/colors';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = '@chefiq_theme_mode';

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme(); // Detect system preference (updates automatically)
  const [isDarkMode, setIsDarkMode] = useState(false); // Start with false, update after loading
  const [isLoading, setIsLoading] = useState(true);
  const [hasUserPreference, setHasUserPreference] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0); // Counter to force re-evaluation

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Listen for system theme changes (only if user hasn't set a preference)
  // This effect runs whenever useColorScheme() detects a system theme change
  useEffect(() => {
    if (!hasUserPreference && !isLoading) {
      console.log('[ThemeContext] System theme detected:', systemColorScheme);
      console.log('[ThemeContext] Current isDarkMode:', isDarkMode);
      console.log('[ThemeContext] Will update to:', systemColorScheme === 'dark');
      setIsDarkMode(systemColorScheme === 'dark');
    }
  }, [systemColorScheme, hasUserPreference, isLoading]);

  // Additional listener: Check theme when app comes to foreground
  // This ensures we catch system theme changes that happened while app was backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && !hasUserPreference && !isLoading) {
        console.log('[ThemeContext] App became active, re-checking system theme');
        console.log('[ThemeContext] Current systemColorScheme from hook:', systemColorScheme);

        // Force a re-check by triggering the systemColorScheme effect
        setForceUpdate(prev => prev + 1);

        // Also directly update if we detect a change
        if (systemColorScheme !== null) {
          const shouldBeDark = systemColorScheme === 'dark';
          if (isDarkMode !== shouldBeDark) {
            console.log('[ThemeContext] Detected theme mismatch, updating from', isDarkMode, 'to', shouldBeDark);
            setIsDarkMode(shouldBeDark);
          }
        }
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [hasUserPreference, isLoading, systemColorScheme, isDarkMode]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);

      if (savedTheme !== null) {
        // User has a saved preference
        setIsDarkMode(savedTheme === 'dark');
        setHasUserPreference(true);
        console.log('[ThemeContext] Loaded user preference:', savedTheme);
      } else {
        // No saved preference, use system default and follow system changes
        setIsDarkMode(systemColorScheme === 'dark');
        setHasUserPreference(false);
        console.log('[ThemeContext] No user preference, following system:', systemColorScheme);
      }
    } catch (error) {
      console.error('[ThemeContext] Failed to load theme preference:', error);
      // Fallback to system preference
      setIsDarkMode(systemColorScheme === 'dark');
      setHasUserPreference(false);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      setHasUserPreference(true); // User now has a preference

      // Persist preference
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode ? 'dark' : 'light');

      console.log('[ThemeContext] Theme toggled to:', newMode ? 'dark' : 'light');
    } catch (error) {
      console.error('[ThemeContext] Failed to save theme preference:', error);
    }
  };

  const setThemeMode = async (mode) => {
    try {
      const isDark = mode === 'dark';
      setIsDarkMode(isDark);
      setHasUserPreference(true); // User now has a preference

      // Persist preference
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);

      console.log('[ThemeContext] Theme set to:', mode);
    } catch (error) {
      console.error('[ThemeContext] Failed to save theme preference:', error);
    }
  };

  const resetThemePreference = async () => {
    try {
      await AsyncStorage.removeItem(THEME_STORAGE_KEY);
      setHasUserPreference(false);
      setIsDarkMode(systemColorScheme === 'dark');
      console.log('[ThemeContext] Theme preference reset, now following system:', systemColorScheme);
    } catch (error) {
      console.error('[ThemeContext] Failed to reset theme preference:', error);
    }
  };

  const colors = getTheme(isDarkMode);

  const value = {
    isDarkMode,
    colors,
    toggleTheme,
    setThemeMode,
    resetThemePreference,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access theme context
 * @returns {Object} { isDarkMode, colors, toggleTheme, setThemeMode, resetThemePreference, isLoading }
 * - isDarkMode: boolean indicating current theme
 * - colors: object with all theme colors
 * - toggleTheme(): function to toggle between light and dark (sets user preference)
 * - setThemeMode(mode): function to set specific mode 'light' or 'dark' (sets user preference)
 * - resetThemePreference(): function to clear user preference and follow system theme
 * - isLoading: boolean indicating if theme is still loading from storage
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
};
