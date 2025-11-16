// Mock data for Public Profile demonstration

export const MOCK_PUBLIC_USERS = {
  // User 1: John Smith (Chinese cuisine expert)
  user_john: {
    userId: 'user_john',
    username: 'John Smith',
    handle: '@johnsmith',
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    bio: 'Passionate about authentic Chinese cooking and family recipes. Sharing my grandmother\'s treasured dishes.',
    tags: ['🍳 Chinese Cuisine', '📍 NYC', '🏆 5+ Years'],
    stats: {
      recipesCount: 45,
      likesReceived: 1234,
      viewsReceived: 2567,
      followersCount: 840,
      followingCount: 123,
    },
    createdAt: new Date('2020-01-15'),
    updatedAt: new Date('2025-10-28'),
  },

  // User 2: Sarah Lee (Baking specialist)
  user_sarah: {
    userId: 'user_sarah',
    username: 'Sarah Lee',
    handle: '@sarahlee',
    avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
    bio: 'Professional pastry chef. Making complex baking simple and fun! 🧁✨',
    tags: ['🍰 Baking', '📍 LA', '👨‍🍳 Chef'],
    stats: {
      recipesCount: 28,
      likesReceived: 2345,
      viewsReceived: 4567,
      followersCount: 1200,
      followingCount: 89,
    },
    createdAt: new Date('2021-03-20'),
    updatedAt: new Date('2025-10-29'),
  },

  // User 3: Mike Chen (Italian cuisine)
  user_mike: {
    userId: 'user_mike',
    username: 'Mike Chen',
    handle: '@mikechen',
    avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
    bio: 'Italian food lover. Authentic recipes from my travels in Italy 🇮🇹',
    tags: ['🍝 Italian', '📍 SF', '🌍 Travel'],
    stats: {
      recipesCount: 32,
      likesReceived: 987,
      viewsReceived: 1876,
      followersCount: 567,
      followingCount: 234,
    },
    createdAt: new Date('2021-06-10'),
    updatedAt: new Date('2025-10-30'),
  },

  // User 4: Emily Wong (Healthy cooking)
  user_emily: {
    userId: 'user_emily',
    username: 'Emily Wong',
    handle: '@emilywong',
    avatar: 'https://randomuser.me/api/portraits/women/4.jpg',
    bio: 'Healthy eating made delicious. Nutritionist and home cook sharing wholesome recipes.',
    tags: ['🥗 Healthy', '📍 Seattle', '💪 Fitness'],
    stats: {
      recipesCount: 52,
      likesReceived: 3456,
      viewsReceived: 6789,
      followersCount: 1890,
      followingCount: 456,
    },
    createdAt: new Date('2019-11-05'),
    updatedAt: new Date('2025-10-28'),
  },

  // User 5: David Kim (Korean cuisine)
  user_david: {
    userId: 'user_david',
    username: 'David Kim',
    handle: '@davidkim',
    avatar: 'https://randomuser.me/api/portraits/men/5.jpg',
    bio: 'Korean home cooking specialist. Bringing authentic flavors to your kitchen! 🇰🇷',
    tags: ['🍜 Korean', '📍 Chicago', '🌶️ Spicy'],
    stats: {
      recipesCount: 38,
      likesReceived: 1567,
      viewsReceived: 2890,
      followersCount: 923,
      followingCount: 178,
    },
    createdAt: new Date('2020-08-22'),
    updatedAt: new Date('2025-10-29'),
  },
};

// Mock published recipes for each user
export const MOCK_USER_RECIPES = {
  user_john: [
    {
      id: 'recipe_john_1',
      recipeId: 'recipe_john_1',
      title: 'Garlic Baby Bok Choy',
      imageSource: { uri: 'https://picsum.photos/seed/bok1/400/500' },
      aspectRatio: 0.8,
      authorId: 'user_john',
      authorUsername: 'John Smith',
      username: 'John Smith',
      likeCount: 234,
      commentCount: 12,
      viewCount: 456,
      status: 'published',
      cuisineType: 'Chinese',
      difficulty: 'Easy',
      cookingTime: 20,
    },
    {
      id: 'recipe_john_2',
      recipeId: 'recipe_john_2',
      title: 'Mapo Tofu',
      imageSource: { uri: 'https://picsum.photos/seed/mapo1/400/600' },
      aspectRatio: 1.5,
      authorId: 'user_john',
      authorUsername: 'John Smith',
      username: 'John Smith',
      likeCount: 567,
      commentCount: 28,
      viewCount: 890,
      status: 'published',
      cuisineType: 'Chinese',
      difficulty: 'Medium',
      cookingTime: 45,
    },
    {
      id: 'recipe_john_3',
      recipeId: 'recipe_john_3',
      title: 'Kung Pao Chicken',
      imageSource: { uri: 'https://picsum.photos/seed/kungpao1/400/550' },
      aspectRatio: 1.1,
      authorId: 'user_john',
      authorUsername: 'John Smith',
      username: 'John Smith',
      likeCount: 789,
      commentCount: 45,
      viewCount: 1234,
      status: 'published',
      cuisineType: 'Chinese',
      difficulty: 'Medium',
      cookingTime: 30,
    },
  ],

  user_sarah: [
    {
      id: 'recipe_sarah_1',
      recipeId: 'recipe_sarah_1',
      title: 'Chocolate Chip Cookies',
      imageSource: { uri: 'https://picsum.photos/seed/cookies1/400/450' },
      aspectRatio: 0.9,
      authorId: 'user_sarah',
      authorUsername: 'Sarah Lee',
      username: 'Sarah Lee',
      likeCount: 456,
      commentCount: 23,
      viewCount: 678,
      status: 'published',
      cuisineType: 'Baking',
      difficulty: 'Easy',
      cookingTime: 25,
    },
    {
      id: 'recipe_sarah_2',
      recipeId: 'recipe_sarah_2',
      title: 'French Macarons',
      imageSource: { uri: 'https://picsum.photos/seed/macarons1/400/500' },
      aspectRatio: 0.8,
      authorId: 'user_sarah',
      authorUsername: 'Sarah Lee',
      username: 'Sarah Lee',
      likeCount: 890,
      commentCount: 56,
      viewCount: 1456,
      status: 'published',
      cuisineType: 'Baking',
      difficulty: 'Hard',
      cookingTime: 120,
    },
  ],

  user_mike: [
    {
      id: 'recipe_mike_1',
      recipeId: 'recipe_mike_1',
      title: 'Classic Carbonara',
      imageSource: { uri: 'https://picsum.photos/seed/carbonara1/400/600' },
      aspectRatio: 1.5,
      authorId: 'user_mike',
      authorUsername: 'Mike Chen',
      username: 'Mike Chen',
      likeCount: 345,
      commentCount: 18,
      viewCount: 567,
      status: 'published',
      cuisineType: 'Italian',
      difficulty: 'Medium',
      cookingTime: 30,
    },
  ],

  user_emily: [
    {
      id: 'recipe_emily_1',
      recipeId: 'recipe_emily_1',
      title: 'Quinoa Buddha Bowl',
      imageSource: { uri: 'https://picsum.photos/seed/buddha1/400/500' },
      aspectRatio: 0.8,
      authorId: 'user_emily',
      authorUsername: 'Emily Wong',
      username: 'Emily Wong',
      likeCount: 678,
      commentCount: 34,
      viewCount: 890,
      status: 'published',
      cuisineType: 'Healthy',
      difficulty: 'Easy',
      cookingTime: 20,
    },
  ],

  user_david: [
    {
      id: 'recipe_david_1',
      recipeId: 'recipe_david_1',
      title: 'Kimchi Fried Rice',
      imageSource: { uri: 'https://picsum.photos/seed/kimchi1/400/450' },
      aspectRatio: 0.9,
      authorId: 'user_david',
      authorUsername: 'David Kim',
      username: 'David Kim',
      likeCount: 567,
      commentCount: 29,
      viewCount: 789,
      status: 'published',
      cuisineType: 'Korean',
      difficulty: 'Easy',
      cookingTime: 15,
    },
  ],
};

// Helper function to get user profile by userId
export const getMockUserProfile = (userId) => {
  return MOCK_PUBLIC_USERS[userId] || null;
};

// Helper function to get user's published recipes
export const getMockUserRecipes = (userId) => {
  return MOCK_USER_RECIPES[userId] || [];
};

// Mock follow status (for demonstration)
export const MOCK_FOLLOW_STATUS = {
  user_john: false,
  user_sarah: true,
  user_mike: false,
  user_emily: true,
  user_david: false,
};
