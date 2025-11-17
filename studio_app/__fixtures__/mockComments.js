// Mock comment data for testing
export const mockComment = {
  id: 'comment123',
  text: 'This recipe is amazing! Made it for my family and they loved it.',
  userId: 'user456',
  userName: 'Master Chef',
  userPhotoURL: 'https://example.com/chef.jpg',
  recipeId: 'recipe123',
  parentId: null, // Top-level comment
  stats: {
    likes: 5
  },
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15')
};

export const mockReply = {
  id: 'comment456',
  text: 'Thank you so much! Glad you enjoyed it!',
  userId: 'user123',
  userName: 'Test User',
  userPhotoURL: 'https://example.com/avatar.jpg',
  recipeId: 'recipe123',
  parentId: 'comment123', // Reply to comment123
  stats: {
    likes: 2
  },
  createdAt: new Date('2024-01-16'),
  updatedAt: new Date('2024-01-16')
};

export const mockComments = [
  mockComment,
  mockReply,
  {
    id: 'comment789',
    text: 'Can I substitute almond milk for regular milk?',
    userId: 'user789',
    userName: 'Baker Bob',
    userPhotoURL: null,
    recipeId: 'recipe123',
    parentId: null,
    stats: {
      likes: 1
    },
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20')
  }
];

export const mockCommentWithReplies = {
  ...mockComment,
  replies: [mockReply]
};
