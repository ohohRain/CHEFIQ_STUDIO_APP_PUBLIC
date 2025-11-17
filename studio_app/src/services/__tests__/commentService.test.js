import commentServiceModule from '../commentService';

jest.mock('firebase/firestore');

describe('commentService', () => {
  let mockFirestore;
  const { getComments, createComment, deleteComment, MAX_COMMENT_LENGTH } = commentServiceModule;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore = require('firebase/firestore');

    // Mock db import
    jest.mock('../../config/firebase', () => ({
      db: {}
    }));
  });

  describe('getComments', () => {
    it('should return comments for a recipe', async () => {
      const recipeId = 'recipe456';
      const mockComments = [
        {
          recipeId: 'recipe456',
          authorId: 'user1',
          authorUsername: 'User One',
          authorAvatar: null,
          content: 'Great recipe!',
          stats: { likesCount: 5 },
          createdAt: { seconds: 1000 },
          updatedAt: { seconds: 1000 }
        },
        {
          recipeId: 'recipe456',
          authorId: 'user2',
          authorUsername: 'User Two',
          authorAvatar: null,
          content: 'Thanks for sharing!',
          stats: { likesCount: 2 },
          createdAt: { seconds: 2000 },
          updatedAt: { seconds: 2000 }
        }
      ];

      mockFirestore.collection.mockReturnValue({});
      mockFirestore.query.mockReturnValue({});
      mockFirestore.getDocs.mockResolvedValue({
        docs: mockComments.map((comment, idx) => ({
          id: `comment${idx + 1}`,
          data: () => comment
        }))
      });

      const result = await getComments(recipeId);

      expect(result.success).toBe(true);
      expect(result.data.comments).toHaveLength(2);
      expect(result.data.count).toBe(2);
      expect(result.data.comments[0].commentId).toBe('comment1');
      expect(result.error).toBeNull();

      expect(mockFirestore.where).toHaveBeenCalledWith('recipeId', '==', recipeId);
      expect(mockFirestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('should return empty array when no comments', async () => {
      mockFirestore.collection.mockReturnValue({});
      mockFirestore.query.mockReturnValue({});
      mockFirestore.getDocs.mockResolvedValue({
        docs: []
      });

      const result = await getComments('recipe456');

      expect(result.success).toBe(true);
      expect(result.data.comments).toEqual([]);
      expect(result.data.count).toBe(0);
      expect(result.error).toBeNull();
    });

    it('should return error for invalid recipe ID', async () => {
      const result = await getComments('');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-recipe-id');
    });

    it('should return error for null recipe ID', async () => {
      const result = await getComments(null);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-recipe-id');
    });

    it('should handle Firestore errors', async () => {
      mockFirestore.collection.mockReturnValue({});
      mockFirestore.query.mockReturnValue({});
      mockFirestore.getDocs.mockRejectedValue(new Error('Network error'));

      const result = await getComments('recipe456');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/fetch-failed');
      expect(result.error.message).toContain('Network error');
    });
  });

  describe('createComment', () => {
    const userProfile = {
      userId: 'user123',
      username: 'Test User',
      avatar: 'https://example.com/avatar.jpg'
    };

    it('should successfully create a comment', async () => {
      const recipeId = 'recipe456';
      const content = 'Great recipe!';

      const mockCollectionRef = {};
      mockFirestore.collection.mockReturnValue(mockCollectionRef);
      mockFirestore.addDoc = jest.fn().mockResolvedValue({
        id: 'newComment123'
      });

      const result = await createComment(recipeId, content, userProfile);

      expect(result.success).toBe(true);
      expect(result.data.commentId).toBe('newComment123');
      expect(result.error).toBeNull();

      expect(mockFirestore.addDoc).toHaveBeenCalled();
      const commentData = mockFirestore.addDoc.mock.calls[0][1];
      expect(commentData.recipeId).toBe(recipeId);
      expect(commentData.content).toBe(content);
      expect(commentData.authorId).toBe(userProfile.userId);
      expect(commentData.authorUsername).toBe(userProfile.username);
      expect(commentData.stats.likesCount).toBe(0);
    });

    it('should trim comment content', async () => {
      const recipeId = 'recipe456';
      const content = '  Great recipe!  ';

      const mockCollectionRef = {};
      mockFirestore.collection.mockReturnValue(mockCollectionRef);
      mockFirestore.addDoc = jest.fn().mockResolvedValue({
        id: 'newComment123'
      });

      await createComment(recipeId, content, userProfile);

      const commentData = mockFirestore.addDoc.mock.calls[0][1];
      expect(commentData.content).toBe('Great recipe!');
    });

    it('should return error for empty content', async () => {
      const result = await createComment('recipe456', '', userProfile);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-content');
      expect(result.error.message).toContain('cannot be empty');
    });

    it('should return error for whitespace-only content', async () => {
      const result = await createComment('recipe456', '   ', userProfile);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-content');
    });

    it('should return error for null content', async () => {
      const result = await createComment('recipe456', null, userProfile);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-content');
    });

    it('should return error for content exceeding max length', async () => {
      const longContent = 'a'.repeat(MAX_COMMENT_LENGTH + 1);

      const result = await createComment('recipe456', longContent, userProfile);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/content-too-long');
      expect(result.error.message).toContain(`${MAX_COMMENT_LENGTH} characters`);
    });

    it('should return error for invalid recipe ID', async () => {
      const result = await createComment('', 'Great recipe!', userProfile);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-recipe-id');
    });

    it('should return error for missing user profile', async () => {
      const result = await createComment('recipe456', 'Great recipe!', null);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-user');
    });

    it('should return error for user profile without userId', async () => {
      const invalidProfile = { username: 'Test User' };

      const result = await createComment('recipe456', 'Great recipe!', invalidProfile);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-user');
    });

    it('should handle permission denied errors', async () => {
      const mockCollectionRef = {};
      mockFirestore.collection.mockReturnValue(mockCollectionRef);
      const permissionError = new Error('Permission denied');
      permissionError.code = 'permission-denied';
      mockFirestore.addDoc = jest.fn().mockRejectedValue(permissionError);

      const result = await createComment('recipe456', 'Great recipe!', userProfile);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/permission-denied');
    });

    it('should handle network errors', async () => {
      const mockCollectionRef = {};
      mockFirestore.collection.mockReturnValue(mockCollectionRef);
      mockFirestore.addDoc = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await createComment('recipe456', 'Great recipe!', userProfile);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/operation-failed');
      expect(result.error.message).toContain('Network error');
    });
  });

  describe('deleteComment', () => {
    it('should successfully delete comment', async () => {
      const commentId = 'comment123';
      const userId = 'user123';

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          commentId,
          authorId: 'user123',
          content: 'Test comment'
        })
      });
      mockFirestore.deleteDoc.mockResolvedValue();

      const result = await deleteComment(commentId, userId);

      expect(result.success).toBe(true);
      expect(result.data.deleted).toBe(true);
      expect(result.error).toBeNull();

      expect(mockFirestore.deleteDoc).toHaveBeenCalled();
    });

    it('should return error when comment not found', async () => {
      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => false
      });

      const result = await deleteComment('nonexistent', 'user123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/not-found');
    });

    it('should return error for unauthorized delete (different user)', async () => {
      const commentId = 'comment123';

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          commentId,
          authorId: 'user456', // Different user
          content: 'Test comment'
        })
      });

      const result = await deleteComment(commentId, 'user789');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/permission-denied');
      expect(result.error.message).toContain('only delete your own comments');

      expect(mockFirestore.deleteDoc).not.toHaveBeenCalled();
    });

    it('should return error for invalid comment ID', async () => {
      const result = await deleteComment('', 'user123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-comment-id');
    });

    it('should return error for null comment ID', async () => {
      const result = await deleteComment(null, 'user123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-comment-id');
    });

    it('should return error for invalid user ID', async () => {
      const result = await deleteComment('comment123', '');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-user-id');
    });

    it('should return error for null user ID', async () => {
      const result = await deleteComment('comment123', null);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/invalid-user-id');
    });

    it('should handle permission denied errors', async () => {
      mockFirestore.doc.mockReturnValue({});
      const permissionError = new Error('Permission denied');
      permissionError.code = 'permission-denied';
      mockFirestore.getDoc.mockRejectedValue(permissionError);

      const result = await deleteComment('comment123', 'user123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/operation-failed');
    });

    it('should handle network errors', async () => {
      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockRejectedValue(new Error('Network error'));

      const result = await deleteComment('comment123', 'user123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('comment/operation-failed');
      expect(result.error.message).toContain('Network error');
    });
  });

  describe('MAX_COMMENT_LENGTH constant', () => {
    it('should export MAX_COMMENT_LENGTH constant', () => {
      expect(MAX_COMMENT_LENGTH).toBeDefined();
      expect(typeof MAX_COMMENT_LENGTH).toBe('number');
      expect(MAX_COMMENT_LENGTH).toBe(1000);
    });
  });
});
