// Mock Collection-Recipe Junction Table for Phase 9.1 UI Testing
// Schema follows database_design.md v3.0
// Composite key format: {collectionId}_{recipeId}

export const mockCollectionRecipes = [
  // All Recipes collection (default) - 8 recipes
  {
    documentId: 'collection_1_recipe_1',
    collectionId: 'collection_1',
    recipeId: 'recipe_1', // Grilled Rib Eye Steak
    userId: 'user_123',
    savedAt: new Date('2024-01-15T00:00:00Z')
  },
  {
    documentId: 'collection_1_recipe_2',
    collectionId: 'collection_1',
    recipeId: 'recipe_2', // Classic Margherita Pizza
    userId: 'user_123',
    savedAt: new Date('2024-01-20T00:00:00Z')
  },
  {
    documentId: 'collection_1_recipe_3',
    collectionId: 'collection_1',
    recipeId: 'recipe_3', // Thai Green Curry
    userId: 'user_123',
    savedAt: new Date('2024-02-01T00:00:00Z')
  },
  {
    documentId: 'collection_1_recipe_4',
    collectionId: 'collection_1',
    recipeId: 'recipe_4', // Chocolate Lava Cake
    userId: 'user_123',
    savedAt: new Date('2024-02-10T00:00:00Z')
  },
  {
    documentId: 'collection_1_recipe_5',
    collectionId: 'collection_1',
    recipeId: 'recipe_5', // Caesar Salad
    userId: 'user_123',
    savedAt: new Date('2024-02-20T00:00:00Z')
  },
  {
    documentId: 'collection_1_recipe_6',
    collectionId: 'collection_1',
    recipeId: 'recipe_6', // Pad Thai
    userId: 'user_123',
    savedAt: new Date('2024-03-01T00:00:00Z')
  },
  {
    documentId: 'collection_1_recipe_7',
    collectionId: 'collection_1',
    recipeId: 'recipe_7', // Beef Tacos
    userId: 'user_123',
    savedAt: new Date('2024-03-10T00:00:00Z')
  },
  {
    documentId: 'collection_1_recipe_8',
    collectionId: 'collection_1',
    recipeId: 'recipe_8', // Chicken Tikka Masala
    userId: 'user_123',
    savedAt: new Date('2024-03-15T00:00:00Z')
  },

  // My Favorites collection - 3 recipes (subset of All Recipes)
  {
    documentId: 'collection_2_recipe_1',
    collectionId: 'collection_2',
    recipeId: 'recipe_1', // Grilled Rib Eye Steak
    userId: 'user_123',
    savedAt: new Date('2024-02-16T00:00:00Z')
  },
  {
    documentId: 'collection_2_recipe_3',
    collectionId: 'collection_2',
    recipeId: 'recipe_3', // Thai Green Curry
    userId: 'user_123',
    savedAt: new Date('2024-02-17T00:00:00Z')
  },
  {
    documentId: 'collection_2_recipe_4',
    collectionId: 'collection_2',
    recipeId: 'recipe_4', // Chocolate Lava Cake
    userId: 'user_123',
    savedAt: new Date('2024-02-18T00:00:00Z')
  },

  // Quick Meals collection - 5 recipes
  {
    documentId: 'collection_3_recipe_2',
    collectionId: 'collection_3',
    recipeId: 'recipe_2', // Classic Margherita Pizza
    userId: 'user_123',
    savedAt: new Date('2024-03-11T00:00:00Z')
  },
  {
    documentId: 'collection_3_recipe_5',
    collectionId: 'collection_3',
    recipeId: 'recipe_5', // Caesar Salad
    userId: 'user_123',
    savedAt: new Date('2024-03-12T00:00:00Z')
  },
  {
    documentId: 'collection_3_recipe_6',
    collectionId: 'collection_3',
    recipeId: 'recipe_6', // Pad Thai
    userId: 'user_123',
    savedAt: new Date('2024-03-13T00:00:00Z')
  },
  {
    documentId: 'collection_3_recipe_7',
    collectionId: 'collection_3',
    recipeId: 'recipe_7', // Beef Tacos
    userId: 'user_123',
    savedAt: new Date('2024-03-14T00:00:00Z')
  },
  {
    documentId: 'collection_3_recipe_8',
    collectionId: 'collection_3',
    recipeId: 'recipe_8', // Chicken Tikka Masala
    userId: 'user_123',
    savedAt: new Date('2024-03-15T00:00:00Z')
  },

  // Desserts collection - 2 recipes
  {
    documentId: 'collection_4_recipe_4',
    collectionId: 'collection_4',
    recipeId: 'recipe_4', // Chocolate Lava Cake
    userId: 'user_123',
    savedAt: new Date('2024-04-06T00:00:00Z')
  },
  {
    documentId: 'collection_4_recipe_9',
    collectionId: 'collection_4',
    recipeId: 'recipe_9', // Tiramisu (if exists in mockRecipes)
    userId: 'user_123',
    savedAt: new Date('2024-04-07T00:00:00Z')
  }
];

// Helper function to get recipes by collection
export const getRecipesByCollection = (collectionId) => {
  return mockCollectionRecipes
    .filter(cr => cr.collectionId === collectionId)
    .map(cr => cr.recipeId);
};

// Helper function to check if recipe is saved and get collection
export const getRecipeCollection = (recipeId, userId) => {
  const saved = mockCollectionRecipes.find(
    cr => cr.recipeId === recipeId && cr.userId === userId
  );
  return saved ? saved.collectionId : null;
};
