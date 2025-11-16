import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

const CommentInputSheet = ({ visible, onDismiss, onSubmit, recipeTitle }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  const MAX_CHARS = 500;
  const MIN_CHARS = 1;

  // Auto-focus input when sheet opens
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      // Reset state when sheet closes
      setCommentText('');
      setSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const trimmedText = commentText.trim();

    // Validation
    if (trimmedText.length < MIN_CHARS) {
      return;
    }

    if (trimmedText.length > MAX_CHARS) {
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(trimmedText);
      // Success - parent will handle closing the sheet
    } catch (error) {
      console.error('Error submitting comment:', error);
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    onDismiss();
  };

  const isValid = commentText.trim().length >= MIN_CHARS && commentText.length <= MAX_CHARS;
  const charCount = commentText.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleCancel}
      />

      {/* Bottom Sheet with KeyboardAvoidingView */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.cancelButton}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>
              Comment on {recipeTitle}
            </Text>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
              disabled={!isValid || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.submitText, !isValid && styles.submitTextDisabled]}>
                  Post
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Text Input */}
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Write a comment..."
              placeholderTextColor={colors.textLight}
              value={commentText}
              onChangeText={setCommentText}
              multiline={true}
              maxLength={MAX_CHARS + 50} // Allow typing over limit to show error
              editable={!submitting}
              returnKeyType="default"
              blurOnSubmit={false}
            />

            {/* Character Counter */}
            <View style={styles.footer}>
              <Text style={[styles.charCount, isOverLimit && styles.charCountError]}>
                {charCount}/{MAX_CHARS}
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (colors) => StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitTextDisabled: {
    color: colors.textLight,
  },
  inputContainer: {
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    minHeight: 120,
    maxHeight: 200,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.accent,
    borderRadius: 12,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  charCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  charCountError: {
    color: colors.error,
    fontWeight: '600',
  },
});

export default CommentInputSheet;
