# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---
**⚠️ CRITICAL: Claude Code must NEVER automatically deploy firebase functions. Always provide deployment commands for the user to run manually.**
# Always deploy specific functions by name to avoid overwriting

## Project Overview

**ChefiQ Studio App** is a React Native mobile application for creating, managing, and sharing recipes with AI assistance. Built with Expo and Firebase backend.

**Key Tech Stack:**
- Frontend: React Native 0.81.4 + Expo 54.0
- UI: React Native Paper 5.14
- Navigation: React Navigation 7.x (Stack + Bottom Tabs)
- Backend: Firebase (Auth, Firestore, Storage, Functions)
- AI: OpenAI API (GPT-4, GPT-4V)
- State: React Context API
- Animation: React Native Reanimated 4.1

---

## Development Commands

### Primary Workflow
```bash
# Start development server (from studio_app/)
cd studio_app
npm start

# Run on specific platforms
npm run ios        # iOS simulator (requires Xcode)
npm run android    # Android emulator
npm run web        # Web browser
```

### Firebase Commands
```bash
# Deploy functions (from studio_app/)
cd studio_app
firebase deploy --only functions

# List deployed functions
firebase functions:list

# Start local emulators for testing
firebase emulators:start

# Deploy security rules
firebase deploy --only firestore:rules,storage:rules
```

### Testing & Linting
```bash
# Lint Firebase Functions (from studio_app/functions/)
cd studio_app/functions
npm run lint

# No test suite currently configured
```

### Port Management
```bash
# If port 8081 is busy, use alternative
PORT=8082 npm start

# Firebase emulator ports (from firebase.json):
# - Functions: 5001
# - Firestore: 8080
# - Storage: 9199
# - Emulator UI: 4000
```

---

## Architecture Overview

### Directory Structure
```
ChefiQ_Studio_App/
├── studio_app/                    # Main application
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   ├── screens/               # 16 screen components (see below)
│   │   ├── navigation/            # AppNavigator.js (Stack + Bottom Tabs)
│   │   ├── contexts/              # 7 React Context providers (see below)
│   │   ├── services/              # 15 service modules (Firebase abstraction)
│   │   ├── config/                # firebase.js configuration
│   │   ├── theme/                 # colors.js (APP theme + dark mode)
│   │   ├── utils/                 # Utility functions
│   │   └── data/                  # Static data
│   ├── functions/                 # Firebase Cloud Functions
│   │   ├── index.js               # Main functions entry
│   │   ├── commentFunctions.js    # Comment aggregation logic
│   │   └── notifications.js       # Push notification handlers
│   ├── assets/                    # Images, fonts, icons
│   ├── App.js                     # Root component with Google Sign-In
│   ├── app.json                   # Expo configuration
│   ├── firebase.json              # Firebase configuration
│   └── .env                       # Environment variables (Firebase, OpenAI)
├── References/                    # Design docs and PRDs
├── design/                        # Frontend TODO list
└── README.md                      # Setup guide
```

### Screen Architecture (16 Screens)

**Navigation Structure:**
```javascript
// AppNavigator.js uses Stack + Bottom Tabs pattern
<Stack.Navigator>
  <Stack.Screen name="Login" component={LoginScreen} />
  <Stack.Screen name="SignUp" component={SignUpScreen} />
  <Stack.Screen name="MainTabs">
    <Tab.Navigator>
      <Tab.Screen name="HomeStack">        // Home feed with tabs
      <Tab.Screen name="AIInspirationStack"> // AI features
      <Tab.Screen name="CreatePlaceholder" /> // Recipe creation entry
      <Tab.Screen name="CollectionsStack">   // User collections
      <Tab.Screen name="ProfileStack">       // User profile
    </Tab.Navigator>
  </Stack.Screen>
  <Stack.Screen name="RecipeDetail" />     // Recipe viewing
  <Stack.Screen name="RecipeForm" />       // Recipe editing
  <Stack.Screen name="GuidedCooking" />    // Step-by-step cooking mode
  // ... other screens
</Stack.Navigator>
```

**Screen Categories:**
1. **Authentication**: LoginScreen, SignUpScreen
2. **Home Feed**: HomeScreen (Following/All/Trending tabs, masonry layout)
3. **AI Features**: AIInspirationScreen, AISmartInputScreen
4. **Recipe Management**: CreateRecipeScreen, RecipeFormScreen, RecipeDetailScreen, GuidedCookingScreen
5. **Collections**: CollectionsScreen, CollectionDetailScreen
6. **Social**: ProfileScreen, PublicProfileScreen, EditProfileScreen, NotificationsScreen
7. **Other**: MyRecipesScreen

### Context Providers (7 Contexts)

All contexts located in `src/contexts/`:

1. **AuthContext.js** - User authentication state (Firebase Auth)
2. **ThemeContext.js** - Dark mode and APP theme colors
3. **LikeContext.js** - Recipe like/unlike functionality
4. **OptimisticLikeContext.js** - Optimistic UI updates for likes
5. **CommentLikeContext.js** - Comment like/unlike functionality
6. **CollectionsContext.js** - Recipe collections management
7. **NotificationsContext.js** - In-app notification state

**Usage Pattern:**
```javascript
// App.js wraps with all providers
<AuthProvider>
  <ThemeProvider>
    <LikeProvider>
      <OptimisticLikeProvider>
        {/* ... other providers ... */}
        <AppNavigator />
      </OptimisticLikeProvider>
    </LikeProvider>
  </ThemeProvider>
</AuthProvider>
```

### Service Layer (15 Services)

**Implemented Services (~107KB code):**
1. **authService.js** - Authentication (email/password, Google Sign-In)
2. **user.service.js** - User profile CRUD operations
3. **storageService.js** - Firebase Storage (image upload with compression)
4. **recipeService.js** - Recipe CRUD, publishing, drafts
5. **likeService.js** - Recipe like/unlike with denormalized counts
6. **pendingLikesManager.js** - Optimistic like queue management
7. **collectionService.js** - Recipe collections (create, add/remove recipes)
8. **feedService.js** - Home feed aggregation (Following/All/Trending)
9. **viewService.js** - Recipe view count tracking
10. **commentService.js** - Comment CRUD operations
11. **commentLikeService.js** - Comment like/unlike functionality
12. **searchService.js** - Recipe search functionality

**Not Yet Implemented:**
- **followService.js** - User follow/unfollow (Phase 12)
- **notificationService.js** - In-app notifications (Phase 11)
- **aiService.js** - OpenAI integration (Phases 15-17)

**Service Pattern:**
```javascript
// All services follow consistent pattern:
import { db, auth, storage } from '../config/firebase';
import { collection, doc, getDoc, setDoc, ... } from 'firebase/firestore';

export const serviceMethod = async (params) => {
  try {
    // Firebase operation
    return result;
  } catch (error) {
    console.error('[ServiceName] Error:', error);
    throw error;
  }
};
```

### Firebase Cloud Functions

**Location:** `studio_app/functions/`

**Deployed Functions:**
1. **commentFunctions.js** - Auto-update comment counts on recipes
2. **notifications.js** - Push notification triggers

**Deployment:**
```bash
cd studio_app
firebase deploy --only functions
```

**⚠️ CRITICAL RULE:** Never automatically deploy functions. Always provide deployment commands for manual execution.

---

## Key Implementation Patterns

### 1. Image Upload Pattern
```javascript
// From storageService.js - used across recipe/profile screens
import { uploadImage } from '../services/storageService';

// Resize to max 1200px, compress to 80% quality
const { uri, width, height } = await ImageManipulator.manipulateAsync(
  imageUri,
  [{ resize: { width: 1200 } }],
  { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
);

// Upload to Firebase Storage with progress callback
const downloadURL = await uploadImage(
  blob,
  `recipes/${userId}/${Date.now()}.jpg`,
  (progress) => console.log(`Upload: ${progress}%`)
);
```

### 2. Like System Pattern
```javascript
// Optimistic UI updates via contexts
import { useLike } from '../contexts/LikeContext';
import { useOptimisticLike } from '../contexts/OptimisticLikeContext';

const { likedRecipes, toggleLike } = useLike();
const { optimisticLikes, toggleOptimistic } = useOptimisticLike();

// On user action:
toggleOptimistic(recipeId); // Immediate UI update
toggleLike(recipeId);       // Background Firebase operation

// Display state:
const isLiked = optimisticLikes[recipeId] ?? likedRecipes.has(recipeId);
```

### 3. Feed Loading Pattern
```javascript
// From HomeScreen.js - masonry layout with infinite scroll
import { getFeed } from '../services/feedService';
import MasonryList from 'react-native-masonry-list';

const loadRecipes = async () => {
  const recipes = await getFeed(feedType, lastDoc);
  setRecipes(prev => [...prev, ...recipes]);
};

<MasonryList
  data={recipes}
  numColumns={2}
  onEndReached={loadMoreRecipes}
  renderItem={({ item }) => <RecipeCard recipe={item} />}
/>
```

### 4. Navigation Pattern
```javascript
// Stack navigation is primary, tabs are nested
navigation.navigate('RecipeDetail', { recipeId });
navigation.navigate('HomeStack', {
  screen: 'Home',
  params: { refresh: true }
});
```

### 5. Theme Pattern
```javascript
// From ThemeContext.js + theme/colors.js
import { useTheme } from '../contexts/ThemeContext';

const { isDarkMode, colors } = useTheme();

// Colors object contains:
// - primary, secondary, background, text, border
// - Full dark mode variants
// - Always use colors.* instead of hardcoded values
```

---

## Database Schema (Firestore)

**10 Core Collections:**

1. **users** - User profiles
   - Fields: displayName, email, photoURL, bio, stats (followers, following, recipes)

2. **recipes** - Published recipes
   - Fields: title, description, coverImage, steps[], ingredients[], userId, stats (likes, saves, views, comments)

3. **recipe_drafts** - Unpublished drafts
   - Fields: Same as recipes + isDraft: true

4. **likes** - User like records
   - Document ID: `{userId}_{recipeId}`

5. **collections** - User-created collections
   - Fields: name, description, recipeIds[], userId, isPublic

6. **follows** - Follow relationships
   - Document ID: `{followerId}_{followingId}`

7. **notifications** - In-app notifications
   - Fields: type, recipientId, senderId, recipeId, isRead, createdAt

8. **comments** - Recipe comments
   - Fields: text, userId, recipeId, parentId (for replies), stats (likes)

9. **comment_likes** - Comment like records
   - Document ID: `{userId}_{commentId}`

10. **recipe_views** - View tracking
    - Document ID: `{userId}_{recipeId}`

**Security Rules:** `studio_app/firestore.rules` and `studio_app/storage.rules`

---

## Current Development Status

**✅ Completed (Phases 1-10, 14):**
- Firebase integration (Auth, Firestore, Storage)
- User authentication (email/password + Google Sign-In)
- Recipe CRUD operations
- Image upload with compression
- Like system with optimistic UI
- Collections management
- Home feed (Following/All/Trending tabs with masonry layout)
- Comment system
- View tracking
- Dark mode support
- Pinterest-style masonry layout
- Guided cooking mode with timer

**⏳ In Progress (Phases 11-17):**
- Phase 4: Cloud Functions for auto stats updates
- Phase 11: Notification system (context exists, service pending)
- Phase 12: Follow system (service pending)
- Phases 15-17: AI features (OpenAI integration pending)

**Known Design Decisions:**
- Using `resizeMode: 'cover'` for all images (may crop edges but no blank space)
- Cover images: 1:1 aspect ratio (square)
- Step images: 3:2 aspect ratio (landscape)
- Image previews: Cover 360px, Steps 240px
- Guided cooking: 50% screen for image, pill-shaped navigation, floating timer

---

## Important Notes

### Code Style Conventions
- **Language**: All code and comments in English
- **Naming**: camelCase for JS variables/functions, PascalCase for components
- **File naming**: camelCase for services/utils, PascalCase for screens/components
- **Context naming**: Suffix with "Context" (e.g., AuthContext.js)
- **Service naming**: Suffix with "Service" (e.g., authService.js) - NO DOTS in filenames

### Firebase Configuration
- **Never commit** `.env` file (contains Firebase config and OpenAI API key)
- Use `.env.example` as template for new environments
- Firebase config is in `src/config/firebase.js` with AsyncStorage persistence

### Working with Images
1. Always compress images before upload (max 1200px, 80% quality)
2. Use `storageService.uploadImage()` for all uploads
3. Delete old images from Storage when updating (prevent storage bloat)
4. Cover images: 1:1 aspect, Steps: 3:2 aspect

### Frontend Development Workflow
- Check `design/FRONTEND_TODO_LIST.md` for active UI issues
- Small fixes: Implement directly → Update TODO
- Large changes: Confirm understanding → Get "可以改了" approval → Implement → Update TODO
- Always test on physical device via Expo Go, not just simulator

### Google Sign-In Setup
- Configured in App.js with `@react-native-google-signin/google-signin`
- Uses Firebase Auth integration
- iOS and Web client IDs in config

### Memory and Context
- Project memory available: `prd_review_2025-10-28` (backend integration status)
- Use Serena's `read_memory()` for project context across sessions

---

## Reference Documentation

**In-Repo Docs:**
- `README.md` - Setup guide for fresh MacBook
- `design/FRONTEND_TODO_LIST.md` - Active UI issues and fixes
- `References/` - Design documents and development plans
- `studio_app/DARK_MODE_IMPLEMENTATION.md` - Dark mode implementation guide
- `studio_app/STORAGE_SERVICE_API.md` - Storage service API reference
- `studio_app/AVATAR_UPLOAD_TEST_GUIDE.md` - Avatar upload testing guide

**Tech Stack Docs:**
- React Native: https://reactnative.dev/
- Expo: https://docs.expo.dev/
- React Navigation: https://reactnavigation.org/
- Firebase: https://firebase.google.com/docs
- React Native Paper: https://callstack.github.io/react-native-paper/

---

**Last Updated:** 2025-11-08
**Version:** 1.0
