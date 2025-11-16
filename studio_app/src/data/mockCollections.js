// Mock Collections Data for Phase 9.1 UI Testing
// Schema follows database_design.md v3.0

export const mockCollections = [
  {
    collectionId: 'collection_1',
    userId: 'user_123', // Should match current user in AuthContext
    name: 'My Recipes',
    emoji: '⭐',
    description: 'All your saved recipes',
    isDefault: false, // Changed: No default collection auto-created (requirement change 2025-10-28)
    stats: {
      recipesCount: 8 // Will be calculated from mockCollectionRecipes
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  },
  {
    collectionId: 'collection_2',
    userId: 'user_123',
    name: 'My Favorites',
    emoji: '❤️',
    description: 'Recipes I absolutely love',
    isDefault: false,
    stats: {
      recipesCount: 3
    },
    createdAt: new Date('2024-02-15T00:00:00Z'),
    updatedAt: new Date('2024-02-15T00:00:00Z')
  },
  {
    collectionId: 'collection_3',
    userId: 'user_123',
    name: 'Quick Meals',
    emoji: '⚡',
    description: 'Fast and easy recipes under 30 minutes',
    isDefault: false,
    stats: {
      recipesCount: 5
    },
    createdAt: new Date('2024-03-10T00:00:00Z'),
    updatedAt: new Date('2024-03-10T00:00:00Z')
  },
  {
    collectionId: 'collection_4',
    userId: 'user_123',
    name: 'Desserts',
    emoji: '🍰',
    description: 'Sweet treats and desserts',
    isDefault: false,
    stats: {
      recipesCount: 2
    },
    createdAt: new Date('2024-04-05T00:00:00Z'),
    updatedAt: new Date('2024-04-05T00:00:00Z')
  }
];
