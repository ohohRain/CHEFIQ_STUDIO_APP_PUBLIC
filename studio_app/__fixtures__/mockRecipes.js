// Mock recipe data for testing
export const mockRecipe = {
  id: 'recipe123',
  title: 'Chocolate Cake',
  description: 'A delicious chocolate cake perfect for any occasion',
  coverImage: 'https://example.com/cake.jpg',
  userId: 'user123',
  userName: 'Test User',
  userPhotoURL: 'https://example.com/avatar.jpg',
  stats: {
    likes: 42,
    views: 150,
    saves: 10,
    comments: 5
  },
  ingredients: [
    { name: 'Flour', amount: '2 cups', unit: 'cups' },
    { name: 'Sugar', amount: '1 cup', unit: 'cup' },
    { name: 'Cocoa powder', amount: '3/4 cup', unit: 'cup' },
    { name: 'Eggs', amount: '2', unit: 'pieces' },
    { name: 'Milk', amount: '1 cup', unit: 'cup' }
  ],
  steps: [
    {
      order: 1,
      instruction: 'Preheat oven to 350°F (175°C)',
      image: null,
      duration: 5
    },
    {
      order: 2,
      instruction: 'Mix dry ingredients in a large bowl',
      image: 'https://example.com/step2.jpg',
      duration: 5
    },
    {
      order: 3,
      instruction: 'Add eggs and milk, mix until smooth',
      image: 'https://example.com/step3.jpg',
      duration: 10
    },
    {
      order: 4,
      instruction: 'Pour into greased pan and bake for 30 minutes',
      image: null,
      duration: 30
    }
  ],
  servings: 8,
  prepTime: 20,
  cookTime: 30,
  difficulty: 'medium',
  cuisine: 'Dessert',
  tags: ['chocolate', 'cake', 'dessert', 'baking'],
  isPublished: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

export const mockRecipes = [
  mockRecipe,
  {
    id: 'recipe456',
    title: 'Vanilla Cupcakes',
    description: 'Light and fluffy vanilla cupcakes',
    coverImage: 'https://example.com/cupcakes.jpg',
    userId: 'user456',
    userName: 'Master Chef',
    userPhotoURL: 'https://example.com/chef.jpg',
    stats: {
      likes: 128,
      views: 450,
      saves: 35,
      comments: 12
    },
    ingredients: [
      { name: 'Flour', amount: '1.5 cups', unit: 'cups' },
      { name: 'Sugar', amount: '1 cup', unit: 'cup' },
      { name: 'Butter', amount: '1/2 cup', unit: 'cup' }
    ],
    steps: [
      {
        order: 1,
        instruction: 'Cream butter and sugar',
        image: null,
        duration: 5
      }
    ],
    servings: 12,
    prepTime: 15,
    cookTime: 20,
    difficulty: 'easy',
    cuisine: 'Dessert',
    tags: ['vanilla', 'cupcakes', 'dessert'],
    isPublished: true,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01')
  },
  {
    id: 'recipe789',
    title: 'Spaghetti Carbonara',
    description: 'Classic Italian pasta dish',
    coverImage: 'https://example.com/carbonara.jpg',
    userId: 'user123',
    userName: 'Test User',
    userPhotoURL: 'https://example.com/avatar.jpg',
    stats: {
      likes: 89,
      views: 320,
      saves: 22,
      comments: 8
    },
    ingredients: [
      { name: 'Spaghetti', amount: '400g', unit: 'grams' },
      { name: 'Eggs', amount: '4', unit: 'pieces' },
      { name: 'Parmesan', amount: '100g', unit: 'grams' }
    ],
    steps: [
      {
        order: 1,
        instruction: 'Cook pasta according to package',
        image: null,
        duration: 10
      }
    ],
    servings: 4,
    prepTime: 10,
    cookTime: 15,
    difficulty: 'medium',
    cuisine: 'Italian',
    tags: ['pasta', 'italian', 'carbonara'],
    isPublished: true,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01')
  }
];

export const mockDraftRecipe = {
  ...mockRecipe,
  id: 'draft123',
  title: 'Work in Progress Cake',
  isPublished: false,
  stats: {
    likes: 0,
    views: 0,
    saves: 0,
    comments: 0
  }
};
