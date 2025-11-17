import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { LikeProvider, useLikes } from '../LikeContext';
import likeServiceModule from '../../services/likeService';

// Mock the service module
jest.mock('../../services/likeService');

// Mock AuthContext
jest.mock('../AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'test-user-id' } }),
}));

describe('LikeContext', () => {
  const { likeRecipe, unlikeRecipe, getUserLikes } = likeServiceModule;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const wrapper = ({ children }) => <LikeProvider>{children}</LikeProvider>;

  describe('useLikes hook', () => {
    it('should provide like functionality', () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: { likes: [], count: 0 },
        error: null,
      });

      const { result } = renderHook(() => useLikes(), { wrapper });

      expect(result.current.toggleLike).toBeDefined();
      expect(result.current.likedRecipes).toBeInstanceOf(Set);
      expect(result.current.likeCounts).toBeDefined();
      expect(result.current.getDisplayCount).toBeDefined();
      expect(result.current.isLiked).toBeDefined();
    });

    it('should load liked recipes on mount', async () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: {
          likes: [
            { recipeId: 'recipe1', userId: 'test-user-id', createdAt: new Date() },
            { recipeId: 'recipe2', userId: 'test-user-id', createdAt: new Date() },
            { recipeId: 'recipe3', userId: 'test-user-id', createdAt: new Date() },
          ],
          count: 3,
        },
        error: null,
      });

      const { result } = renderHook(() => useLikes(), { wrapper });

      await waitFor(() => {
        expect(result.current.likedRecipes.size).toBe(3);
      });

      expect(result.current.likedRecipes.has('recipe1')).toBe(true);
      expect(result.current.likedRecipes.has('recipe2')).toBe(true);
      expect(result.current.likedRecipes.has('recipe3')).toBe(true);
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useLikes());
      }).toThrow('useLikes must be used within LikeProvider');

      console.error = originalError;
    });
  });

  describe('toggleLike', () => {
    it('should add recipe to liked set when liking', async () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: { likes: [], count: 0 },
        error: null,
      });
      likeRecipe.mockResolvedValue({
        success: true,
        data: { likeId: 'test-user-id_recipe123', alreadyLiked: false },
        error: null,
      });

      const { result } = renderHook(() => useLikes(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleLike('recipe123', 0);
      });

      expect(result.current.likedRecipes.has('recipe123')).toBe(true);
      expect(result.current.likeCounts['recipe123']).toBe(1);
    });

    it('should remove recipe from liked set when unliking', async () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: {
          likes: [{ recipeId: 'recipe123', userId: 'test-user-id' }],
          count: 1,
        },
        error: null,
      });
      unlikeRecipe.mockResolvedValue({
        success: true,
        data: { deleted: true, notLiked: false },
        error: null,
      });

      const { result } = renderHook(() => useLikes(), { wrapper });

      await waitFor(() => {
        expect(result.current.likedRecipes.has('recipe123')).toBe(true);
      });

      await act(async () => {
        await result.current.toggleLike('recipe123', 1);
      });

      expect(result.current.likedRecipes.has('recipe123')).toBe(false);
      expect(result.current.likeCounts['recipe123']).toBe(0);
    });

    it('should call service likeRecipe when liking', async () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: { likes: [], count: 0 },
        error: null,
      });
      likeRecipe.mockResolvedValue({
        success: true,
        data: { likeId: 'test-user-id_recipe123' },
        error: null,
      });

      const { result } = renderHook(() => useLikes(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleLike('recipe123', 0);
      });

      expect(likeRecipe).toHaveBeenCalledWith('test-user-id', 'recipe123');
    });

    it('should handle errors gracefully', async () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: { likes: [], count: 0 },
        error: null,
      });
      likeRecipe.mockResolvedValue({
        success: false,
        data: null,
        error: { code: 'like/operation-failed', message: 'Network error' },
      });

      const { result } = renderHook(() => useLikes(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let response;
      await act(async () => {
        response = await result.current.toggleLike('recipe123', 0);
      });

      // Should return error response
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should rollback on error', async () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: {
          likes: [{ recipeId: 'recipe123', userId: 'test-user-id' }],
          count: 1,
        },
        error: null,
      });
      unlikeRecipe.mockResolvedValue({
        success: false,
        data: null,
        error: { code: 'like/operation-failed', message: 'Failed' },
      });

      const { result } = renderHook(() => useLikes(), { wrapper });

      await waitFor(() => {
        expect(result.current.likedRecipes.has('recipe123')).toBe(true);
      });

      await act(async () => {
        await result.current.toggleLike('recipe123', 1);
      });

      // Should rollback to original state
      expect(result.current.likedRecipes.has('recipe123')).toBe(true);
      expect(result.current.likeCounts['recipe123']).toBe(1);
    });
  });

  describe('State management', () => {
    it('should maintain state across multiple toggles', async () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: { likes: [], count: 0 },
        error: null,
      });
      likeRecipe.mockResolvedValue({
        success: true,
        data: { likeId: 'mock-like-id' },
        error: null,
      });

      const { result } = renderHook(() => useLikes(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleLike('recipe1', 0);
        await result.current.toggleLike('recipe2', 0);
        await result.current.toggleLike('recipe3', 0);
      });

      expect(result.current.likedRecipes.size).toBe(3);
      expect(result.current.likedRecipes.has('recipe1')).toBe(true);
      expect(result.current.likedRecipes.has('recipe2')).toBe(true);
      expect(result.current.likedRecipes.has('recipe3')).toBe(true);
    });

    it('should handle rapid toggles correctly', async () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: { likes: [], count: 0 },
        error: null,
      });
      likeRecipe.mockResolvedValue({
        success: true,
        data: { likeId: 'mock-like-id' },
        error: null,
      });
      unlikeRecipe.mockResolvedValue({
        success: true,
        data: { deleted: true },
        error: null,
      });

      const { result } = renderHook(() => useLikes(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Rapid toggle same recipe
      await act(async () => {
        await result.current.toggleLike('recipe123', 0); // like
        await result.current.toggleLike('recipe123', 1); // unlike
      });

      // Should end up in original state (not liked)
      expect(result.current.likedRecipes.has('recipe123')).toBe(false);
    });
  });

  describe('Helper methods', () => {
    it('getDisplayCount should return optimistic count over Firestore count', async () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: { likes: [], count: 0 },
        error: null,
      });
      likeRecipe.mockResolvedValue({
        success: true,
        data: { likeId: 'mock-like-id' },
        error: null,
      });

      const { result } = renderHook(() => useLikes(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Initially should use Firestore count
      expect(result.current.getDisplayCount('recipe123', 5)).toBe(5);

      // After toggle, should use optimistic count
      await act(async () => {
        await result.current.toggleLike('recipe123', 5);
      });

      expect(result.current.getDisplayCount('recipe123', 5)).toBe(6);
    });

    it('isLiked should return correct liked state', async () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: {
          likes: [{ recipeId: 'recipe1', userId: 'test-user-id' }],
          count: 1,
        },
        error: null,
      });

      const { result } = renderHook(() => useLikes(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isLiked('recipe1')).toBe(true);
      expect(result.current.isLiked('recipe2')).toBe(false);
    });
  });

  describe('Multiple consumers', () => {
    it('should share state between multiple hooks', async () => {
      getUserLikes.mockResolvedValue({
        success: true,
        data: { likes: [], count: 0 },
        error: null,
      });
      likeRecipe.mockResolvedValue({
        success: true,
        data: { likeId: 'mock-like-id' },
        error: null,
      });

      // Render the hook once and check that the state is shared
      const { result, rerender } = renderHook(() => useLikes(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Perform like action
      await act(async () => {
        await result.current.toggleLike('recipe123', 0);
      });

      // Verify the state is updated
      expect(result.current.likedRecipes.has('recipe123')).toBe(true);

      // Rerender should maintain the same state (context is shared)
      rerender();
      expect(result.current.likedRecipes.has('recipe123')).toBe(true);
      expect(result.current.likeCounts['recipe123']).toBe(1);
    });
  });
});
