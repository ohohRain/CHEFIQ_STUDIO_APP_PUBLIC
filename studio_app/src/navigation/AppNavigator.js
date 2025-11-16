import React from 'react';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import HomeScreen from '../screens/HomeScreen';
import AIInspirationScreen from '../screens/AIInspirationScreen';
import CreateRecipeScreen from '../screens/CreateRecipeScreen';
import AISmartInputScreen from '../screens/AISmartInputScreen';
import RecipeFormScreen from '../screens/RecipeFormScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import CollectionsScreen from '../screens/CollectionsScreen';
import CollectionDetailScreen from '../screens/CollectionDetailScreen';
import MyRecipesScreen from '../screens/MyRecipesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import GuidedCookingScreen from '../screens/GuidedCookingScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Brand colors
const COLORS = {
  primary: '#00D084',
  background: '#FFFDF8',
  inactive: '#666666',
};

// Home Stack Navigator (for future nested navigation)
const HomeStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // Hide header for home since we have custom header
      }}
    >
      <Stack.Screen name="HomeScreen" component={HomeScreen} />
    </Stack.Navigator>
  );
};

// AI Inspiration Stack Navigator
const AIInspirationStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // Hide header since screen has custom layout
      }}
    >
      <Stack.Screen name="AIInspirationScreen" component={AIInspirationScreen} />
    </Stack.Navigator>
  );
};

// Collections Stack Navigator
const CollectionsStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // Hide header since screen has custom layout
      }}
    >
      <Stack.Screen name="CollectionsScreen" component={CollectionsScreen} />
    </Stack.Navigator>
  );
};

// Profile Stack Navigator
const ProfileStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // Hide header since screen has custom layout
      }}
    >
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
    </Stack.Navigator>
  );
};

// Dummy component for Create tab (never actually shown)
const CreatePlaceholder = () => null;

// Main Tab Navigator
const MainTabs = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        return {
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'AIInspiration') {
              iconName = focused ? 'chef-hat' : 'chef-hat';
            } else if (route.name === 'Create') {
              iconName = 'plus-circle';
            } else if (route.name === 'Collections') {
              iconName = focused ? 'star' : 'star-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'account' : 'account-outline';
            }

            return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: Platform.OS === 'ios' ? 85 : 65,
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
            paddingTop: 8,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginBottom: Platform.OS === 'ios' ? 0 : 4,
          },
          headerShown: false,
        };
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="AIInspiration"
        component={AIInspirationStack}
        options={{ title: 'CHEF iQ' }}
      />
      <Tab.Screen
        name="Create"
        component={CreatePlaceholder}
        options={{ title: 'Create' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Prevent default navigation
            e.preventDefault();
            // Open modal instead
            navigation.navigate('CreateModal');
          },
        })}
      />
      <Tab.Screen
        name="Collections"
        component={CollectionsStack}
        options={{ title: 'Collections' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  // Show loading screen while checking authentication state
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!user ? (
          // Auth screens (not authenticated)
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SignUp"
              component={SignUpScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          // Main app screens (authenticated)
          <>
            {/* Main app with tabs */}
            <Stack.Screen name="MainTabs" component={MainTabs} />

            {/* Modal screens */}
            <Stack.Screen
              name="CreateModal"
              component={CreateRecipeScreen}
              options={{
                presentation: 'transparentModal',
                cardStyle: { backgroundColor: 'transparent' },
                cardOverlayEnabled: true,
                cardStyleInterpolator: ({ current: { progress } }) => ({
                  cardStyle: {
                    opacity: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  },
                }),
              }}
            />

            {/* AI Smart Input screen */}
            <Stack.Screen
              name="AISmartInput"
              component={AISmartInputScreen}
              options={{
                headerShown: false,
                presentation: 'card', // Use card presentation to avoid pageSheet warning
                gestureEnabled: true,
              }}
            />

            {/* Recipe Form screen */}
            <Stack.Screen
              name="RecipeForm"
              component={RecipeFormScreen}
              options={{
                headerShown: false,
                presentation: 'card',
                gestureEnabled: true,
              }}
            />

            {/* Recipe Detail screen */}
            <Stack.Screen
              name="RecipeDetail"
              component={RecipeDetailScreen}
              options={{
                headerShown: false,
                presentation: 'card',
                gestureEnabled: true,
              }}
            />

            {/* Collection Detail screen */}
            <Stack.Screen
              name="CollectionDetail"
              component={CollectionDetailScreen}
              options={{
                headerShown: false,
                presentation: 'card',
                gestureEnabled: true,
              }}
            />

            {/* Notifications screen */}
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                headerShown: false,
                presentation: 'card',
                gestureEnabled: true,
              }}
            />

            {/* Public Profile screen */}
            <Stack.Screen
              name="PublicProfile"
              component={PublicProfileScreen}
              options={{
                headerShown: false,
                presentation: 'card',
                gestureEnabled: true,
              }}
            />

            {/* Edit Profile screen */}
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{
                headerShown: false,
                presentation: 'card',
                gestureEnabled: true,
              }}
            />

            {/* Guided Cooking screen */}
            <Stack.Screen
              name="GuidedCooking"
              component={GuidedCookingScreen}
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                gestureEnabled: true, // Allow swipe-to-dismiss to exit cooking mode
                animationEnabled: true,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor is set dynamically via inline style
  },
});

export default AppNavigator;
