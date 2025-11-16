# ChefiQ Studio App

A mobile app for creating and sharing recipes, with AI help when you want it. Built with React Native and Firebase.

## What It Does

Create recipes, follow step-by-step cooking guides, like and comment on other people's recipes. You can type in ingredients you have and get recipe ideas from AI, or just create your own from scratch.

## Tech Stack

React Native + Expo, Firebase backend, OpenAI for the AI stuff. Pretty standard mobile app setup.

## Getting Started

**You'll need:**
- Node.js (18 or 20)
- Expo Go app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

**Setup:**

```bash
git clone https://github.com/YOUR_USERNAME/chefiq-studio-app.git
cd chefiq-studio-app/studio_app
npm install
cd functions && npm install && cd ..
```

**Firebase Setup:**

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Enable Auth (email + Google), Firestore, and Storage
3. Copy `.env.example` to `.env` and add your Firebase config
4. Deploy rules: `firebase deploy --only firestore:rules,storage:rules`

**Optional - AI Features:**
Get an OpenAI API key and add it to `.env` as `EXPO_PUBLIC_OPENAI_API_KEY`

**Run it:**

```bash
npm start
```

Open Expo Go on your phone, scan the QR code, and you're good to go.

## 🏗️ Project Structure

```
studio_app/
├── src/
│   ├── components/          # Reusable UI components
│   ├── screens/             # 16 screen components
│   │   ├── HomeScreen.js           # Feed with masonry layout
│   │   ├── CreateRecipeScreen.js   # Recipe creation
│   │   ├── RecipeDetailScreen.js   # Recipe viewing
│   │   ├── GuidedCookingScreen.js  # Cooking mode
│   │   ├── ProfileScreen.js        # User profiles
│   │   └── ...
│   ├── navigation/          # Navigation configuration
│   │   └── AppNavigator.js  # Stack + Bottom Tabs
│   ├── contexts/            # 7 React Context providers
│   │   ├── AuthContext.js
│   │   ├── ThemeContext.js
│   │   ├── LikeContext.js
│   │   └── ...
│   ├── services/            # Firebase & API integrations
│   │   ├── authService.js
│   │   ├── recipeService.js
│   │   ├── storageService.js
│   │   ├── aiService.js
│   │   └── ...
│   ├── config/              # Configuration files
│   │   └── firebase.js
│   ├── theme/               # Theme and colors
│   │   └── colors.js
│   └── utils/               # Utility functions
├── assets/                  # Images, fonts, icons
├── functions/               # Firebase Cloud Functions
│   ├── index.js
│   ├── commentFunctions.js
│   └── notifications.js
├── App.js                   # Root component
├── app.json                 # Expo configuration
├── firebase.json            # Firebase configuration
├── firestore.rules          # Firestore security rules
├── storage.rules            # Storage security rules
└── package.json             # Dependencies
```

## 🔧 Available Scripts

```bash
npm start           # Start Expo development server
npm run ios         # Run on iOS simulator
npm run android     # Run on Android emulator
npm run web         # Run in web browser
npm run lint        # Lint Firebase Functions (from functions/)
```

## 🔥 Firebase Configuration

### Firestore Collections

The app uses the following Firestore collections:

- `users` - User profiles and statistics
- `recipes` - Published recipes
- `recipe_drafts` - Unpublished recipe drafts
- `likes` - Recipe likes
- `collections` - User recipe collections
- `comments` - Recipe comments
- `comment_likes` - Comment likes
- `notifications` - User notifications
- `follows` - User follow relationships
- `recipe_views` - Recipe view tracking

### Security Rules

Security rules are defined in:
- `firestore.rules` - Database security rules
- `storage.rules` - Storage security rules

Deploy rules with:
```bash
firebase deploy --only firestore:rules,storage:rules
```

### Cloud Functions

Deploy Firebase Cloud Functions:
```bash
cd studio_app
firebase deploy --only functions
```

**⚠️ Important**: Always deploy specific functions by name to avoid overwriting:
```bash
firebase deploy --only functions:onCommentCreate,functions:onCommentDelete
```

## 🎨 Features Implementation Status

### ✅ Completed Features
- User authentication (Email/Password + Google Sign-In)
- Recipe CRUD operations with draft support
- Image upload with automatic compression
- Like/unlike system with optimistic UI
- Comment system with nested replies
- Collections for organizing recipes
- Home feed with Following/All/Trending tabs
- Pinterest-style masonry layout
- Dark mode theme support
- View count tracking
- Guided cooking mode with timers
- Recipe search functionality

### 🚧 In Progress
- AI recipe generation (service implemented, UI integration pending)
- Push notifications (backend ready, frontend pending)
- User follow system (service planned)

## 🧪 Testing

### Testing on Device
1. Build the app using Expo Go (no compilation needed)
2. Test core features: auth, recipe creation, social interactions
3. Test AI features (requires OpenAI API key)

### Testing Locally
```bash
# Start Firebase emulators (optional)
firebase emulators:start

# Run the app
npm start
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
PORT=8082 npm start
```

### Firebase Connection Issues
- Verify all environment variables in `.env`
- Check Firebase project settings
- Ensure services are enabled in Firebase Console

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npx expo start --clear
```

### Image Upload Issues
- Check Firebase Storage rules
- Verify storage bucket URL in `.env`
- Ensure proper permissions in Firebase Console

## 📄 Environment Variables

All required environment variables are listed in `.env.example`. Key variables:

**Required:**
- `EXPO_PUBLIC_FIREBASE_*` - All Firebase configuration values

**Optional:**
- `EXPO_PUBLIC_OPENAI_API_KEY` - For AI recipe generation features

## 🔒 Security Notes

- **Never commit `.env`** files (already in `.gitignore`)
- Each developer needs their own `.env` file
- For production, use Expo EAS Secrets or environment-specific configs
- Keep Firebase and OpenAI credentials private
- Review security rules before deploying to production

## 🤝 Contributing

This is a public demo repository. For contributions:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📝 Development Notes

### Key Patterns

**Image Upload:**
- Images are automatically resized to max 1200px width
- Compressed to 80% quality JPEG
- Uploaded to Firebase Storage with progress tracking

**Like System:**
- Optimistic UI updates for instant feedback
- Background Firebase sync
- Denormalized like counts on recipes

**Navigation:**
- Stack navigation as primary
- Bottom tabs nested within stack
- Deep linking support configured

### Code Style
- Naming: camelCase for variables/functions, PascalCase for components
- Services: Suffix with `Service` (e.g., `authService.js`)
- Contexts: Suffix with `Context` (e.g., `AuthContext.js`)

## 📚 Documentation

Additional documentation available in the repository:
- `CLAUDE.md` - Development guide for Claude Code
- `studio_app/.env.example` - Environment variables reference
- `studio_app/firestore.rules` - Database security rules
- `studio_app/storage.rules` - Storage security rules

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev/)
- UI components from [React Native Paper](https://callstack.github.io/react-native-paper/)
- Backend powered by [Firebase](https://firebase.google.com/)
- AI features by [OpenAI](https://openai.com/)

---

**Questions or Issues?** Please open an issue on GitHub or contact the maintainers.

**Happy Cooking! 👨‍🍳🍳**
