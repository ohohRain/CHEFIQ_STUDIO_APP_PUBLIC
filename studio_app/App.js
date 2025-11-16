import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/contexts/AuthContext';
import { CollectionsProvider } from './src/contexts/CollectionsContext';
import { LikeProvider } from './src/contexts/LikeContext';
import { OptimisticLikeProvider } from './src/contexts/OptimisticLikeContext';
import { CommentLikeProvider } from './src/contexts/CommentLikeContext';
import { NotificationsProvider } from './src/contexts/NotificationsContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import ErrorBoundary from './src/components/ErrorBoundary';

// Suppress specific warnings that are known issues (only in development)
if (__DEV__) {
  LogBox.ignoreLogs([
    /Modal with 'pageSheet' presentation style and 'transparent' value is not supported/,
    /When setting overflow to hidden on Surface the shadow will not be displayed correctly/,
  ]);
}

// Inner component that has access to ThemeContext
function AppContent() {
  const { isDarkMode } = useTheme();

  return (
    <>
      <PaperProvider>
        <AuthProvider>
          <NotificationsProvider>
            <LikeProvider>
              <CommentLikeProvider>
                <OptimisticLikeProvider>
                  <CollectionsProvider>
                    <AppNavigator />
                  </CollectionsProvider>
                </OptimisticLikeProvider>
              </CommentLikeProvider>
            </LikeProvider>
          </NotificationsProvider>
        </AuthProvider>
        <StatusBar style={isDarkMode ? "light" : "dark"} />
      </PaperProvider>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
