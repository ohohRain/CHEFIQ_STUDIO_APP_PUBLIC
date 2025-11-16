// Mock Search Data for Search Results Page
// This file contains mock data for recipe and user search results

export const MOCK_SEARCH_RESULTS = {
  'kung pao chicken': {
    recipes: [
      {
        id: 'search_recipe_1',
        title: 'Classic Kung Pao Chicken',
        imageSource: { uri: 'https://picsum.photos/seed/kungpao1/400/600' },
        aspectRatio: 1.2,
        username: 'chefwang',
        likeCount: 456,
        cuisineType: 'Chinese',
        difficulty: 'Medium',
        equipment: ['Wok', 'Stove'],
      },
      {
        id: 'search_recipe_2',
        title: 'Spicy Sichuan Kung Pao',
        imageSource: { uri: 'https://picsum.photos/seed/kungpao2/400/500' },
        aspectRatio: 0.9,
        username: 'sichuanmaster',
        likeCount: 789,
        cuisineType: 'Chinese',
        difficulty: 'Hard',
        equipment: ['Wok'],
      },
      {
        id: 'search_recipe_3',
        title: 'Quick Kung Pao Stir-Fry',
        imageSource: { uri: 'https://picsum.photos/seed/kungpao3/400/550' },
        aspectRatio: 1.1,
        username: 'easycooking',
        likeCount: 234,
        cuisineType: 'Chinese',
        difficulty: 'Easy',
        equipment: ['Wok', 'Stove'],
      },
      {
        id: 'search_recipe_4',
        title: 'Authentic Kung Pao',
        imageSource: { uri: 'https://picsum.photos/seed/kungpao4/400/600' },
        aspectRatio: 1.3,
        username: 'asiankitchen',
        likeCount: 567,
        cuisineType: 'Chinese',
        difficulty: 'Medium',
        equipment: ['Wok', 'Oven'],
      },
      {
        id: 'search_recipe_5',
        title: 'Kung Pao with Peanuts',
        imageSource: { uri: 'https://picsum.photos/seed/kungpao5/400/500' },
        aspectRatio: 0.8,
        username: 'foodlover',
        likeCount: 345,
        cuisineType: 'Chinese',
        difficulty: 'Easy',
        equipment: ['Wok'],
      },
      {
        id: 'search_recipe_6',
        title: 'Restaurant-Style Kung Pao',
        imageSource: { uri: 'https://picsum.photos/seed/kungpao6/400/600' },
        aspectRatio: 1.2,
        username: 'cheflife',
        likeCount: 678,
        cuisineType: 'Chinese',
        difficulty: 'Hard',
        equipment: ['Wok', 'Steamer'],
      },
    ],
    users: [
      {
        userId: 'user_john',  // Links to mock profile
        username: 'John Smith',
        handle: '@johnsmith',
        avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
        followersCount: 840,
      },
      {
        userId: 'user_david',  // Links to mock profile
        username: 'David Kim',
        handle: '@davidkim',
        avatar: 'https://randomuser.me/api/portraits/men/5.jpg',
        followersCount: 923,
      },
      {
        userId: 'user_emily',  // Links to mock profile
        username: 'Emily Wong',
        handle: '@emilywong',
        avatar: 'https://randomuser.me/api/portraits/women/4.jpg',
        followersCount: 1890,
      },
    ],
  },
  'pasta': {
    recipes: [
      {
        id: 'search_recipe_7',
        title: 'Classic Carbonara',
        imageSource: { uri: 'https://picsum.photos/seed/pasta1/400/500' },
        aspectRatio: 0.9,
        username: 'italianfood',
        likeCount: 892,
        cuisineType: 'Italian',
        difficulty: 'Medium',
        equipment: ['Stove'],
      },
      {
        id: 'search_recipe_8',
        title: 'Creamy Alfredo Pasta',
        imageSource: { uri: 'https://picsum.photos/seed/pasta2/400/600' },
        aspectRatio: 1.3,
        username: 'pastachef',
        likeCount: 567,
        cuisineType: 'Italian',
        difficulty: 'Easy',
        equipment: ['Stove'],
      },
      {
        id: 'search_recipe_9',
        title: 'Spicy Arrabbiata',
        imageSource: { uri: 'https://picsum.photos/seed/pasta3/400/550' },
        aspectRatio: 1.1,
        username: 'spicylover',
        likeCount: 423,
        cuisineType: 'Italian',
        difficulty: 'Easy',
        equipment: ['Stove'],
      },
      {
        id: 'search_recipe_10',
        title: 'Pesto Penne',
        imageSource: { uri: 'https://picsum.photos/seed/pasta4/400/500' },
        aspectRatio: 0.8,
        username: 'greenrecipes',
        likeCount: 356,
        cuisineType: 'Italian',
        difficulty: 'Easy',
        equipment: ['Stove', 'Oven'],
      },
    ],
    users: [
      {
        userId: 'user_mike',  // Links to mock profile
        username: 'Mike Chen',
        handle: '@mikechen',
        avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
        followersCount: 567,
      },
      {
        userId: 'user_sarah',  // Links to mock profile
        username: 'Sarah Lee',
        handle: '@sarahlee',
        avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
        followersCount: 1200,
      },
    ],
  },
  'default': {
    // Default results for any other search query
    recipes: [
      {
        id: 'search_recipe_11',
        title: 'Simple Fried Rice',
        imageSource: { uri: 'https://picsum.photos/seed/default1/400/500' },
        aspectRatio: 0.9,
        username: 'quickmeals',
        likeCount: 234,
        cuisineType: 'Chinese',
        difficulty: 'Easy',
        equipment: ['Wok', 'Stove'],
      },
      {
        id: 'search_recipe_12',
        title: 'Grilled Salmon',
        imageSource: { uri: 'https://picsum.photos/seed/default2/400/600' },
        aspectRatio: 1.2,
        username: 'healthyfood',
        likeCount: 456,
        cuisineType: 'American',
        difficulty: 'Medium',
        equipment: ['Grill'],
      },
      {
        id: 'search_recipe_13',
        title: 'Vegetable Stir-Fry',
        imageSource: { uri: 'https://picsum.photos/seed/default3/400/550' },
        aspectRatio: 1.1,
        username: 'veggiechef',
        likeCount: 345,
        cuisineType: 'Chinese',
        difficulty: 'Easy',
        equipment: ['Wok'],
      },
    ],
    users: [
      {
        userId: 'user_emily',  // Links to mock profile
        username: 'Emily Wong',
        handle: '@emilywong',
        avatar: 'https://randomuser.me/api/portraits/women/4.jpg',
        followersCount: 1890,
      },
    ],
  },
};

// Filter options with counts (mock data)
export const FILTER_OPTIONS = {
  difficulty: [
    { value: 'Easy', label: 'Easy', count: 12 },
    { value: 'Medium', label: 'Medium', count: 8 },
    { value: 'Hard', label: 'Hard', count: 4 },
  ],
  equipment: [
    { value: 'iQ Cooker - Multi-Cooker', label: 'iQ Cooker - Multi-Cooker', count: 12 },
    { value: 'iQ Sense - Smart Thermometer', label: 'iQ Sense - Smart Thermometer', count: 8 },
    { value: 'iQ MiniOven - Air Fryer Oven', label: 'iQ MiniOven - Air Fryer Oven', count: 6 },
  ],
  cuisineType: [
    { value: 'Chinese', label: 'Chinese', count: 18 },
    { value: 'Italian', label: 'Italian', count: 8 },
    { value: 'Mexican', label: 'Mexican', count: 5 },
    { value: 'Japanese', label: 'Japanese', count: 4 },
    { value: 'Thai', label: 'Thai', count: 3 },
    { value: 'Indian', label: 'Indian', count: 2 },
    { value: 'American', label: 'American', count: 6 },
    { value: 'French', label: 'French', count: 3 },
    { value: 'Korean', label: 'Korean', count: 2 },
  ],
};

// Helper function to get search results
export const searchRecipes = (query, filters = {}) => {
  // Simulate API delay
  return new Promise((resolve) => {
    setTimeout(() => {
      const queryLower = query.toLowerCase().trim();

      // Get recipes based on query
      let results;
      if (MOCK_SEARCH_RESULTS[queryLower]) {
        results = MOCK_SEARCH_RESULTS[queryLower].recipes;
      } else {
        results = MOCK_SEARCH_RESULTS.default.recipes;
      }

      // Apply filters
      let filteredResults = results;

      if (filters.difficulty && filters.difficulty.length > 0) {
        filteredResults = filteredResults.filter(recipe =>
          filters.difficulty.includes(recipe.difficulty)
        );
      }

      if (filters.equipment && filters.equipment.length > 0) {
        filteredResults = filteredResults.filter(recipe =>
          recipe.equipment.some(eq => filters.equipment.includes(eq))
        );
      }

      if (filters.cuisineType && filters.cuisineType.length > 0) {
        filteredResults = filteredResults.filter(recipe =>
          filters.cuisineType.includes(recipe.cuisineType)
        );
      }

      resolve({
        success: true,
        data: {
          recipes: filteredResults,
          total: filteredResults.length,
        },
      });
    }, 800); // 800ms delay to simulate network request
  });
};

// Helper function to search users
export const searchUsers = (query) => {
  // Simulate API delay
  return new Promise((resolve) => {
    setTimeout(() => {
      const queryLower = query.toLowerCase().trim();

      // Get users based on query
      let results;
      if (MOCK_SEARCH_RESULTS[queryLower]) {
        results = MOCK_SEARCH_RESULTS[queryLower].users;
      } else {
        results = MOCK_SEARCH_RESULTS.default.users;
      }

      resolve({
        success: true,
        data: {
          users: results,
          total: results.length,
        },
      });
    }, 600); // 600ms delay to simulate network request
  });
};
