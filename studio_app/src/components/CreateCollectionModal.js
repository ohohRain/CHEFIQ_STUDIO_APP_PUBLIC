import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Modal, Portal, Text, TextInput, Button, HelperText } from 'react-native-paper';
import { useCollections } from '../contexts/CollectionsContext';
import { useTheme } from '../contexts/ThemeContext';

const CreateCollectionModal = ({ visible, onDismiss, onSuccess, initialData = null }) => {
  const { createCollection, updateCollection } = useCollections();
  const { colors } = useTheme();

  // Form state
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [description, setDescription] = useState('');

  // Validation state
  const [nameError, setNameError] = useState('');
  const [emojiError, setEmojiError] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit mode detection
  const isEditMode = !!initialData;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible && initialData) {
      // Edit mode - pre-fill form
      setName(initialData.name || '');
      setEmoji(initialData.emoji || '');
      setDescription(initialData.description || '');
    } else if (visible) {
      // Create mode - clear form
      resetForm();
    }
  }, [visible, initialData]);

  const resetForm = () => {
    setName('');
    setEmoji('');
    setDescription('');
    setNameError('');
    setEmojiError('');
  };

  // Validation
  const validateForm = () => {
    let isValid = true;

    // Name validation
    if (!name.trim()) {
      setNameError('Collection name is required');
      isValid = false;
    } else if (name.trim().length > 30) {
      setNameError('Name must be 30 characters or less');
      isValid = false;
    } else {
      setNameError('');
    }

    // Emoji validation
    if (!emoji.trim()) {
      setEmojiError('Emoji is required');
      isValid = false;
    } else {
      setEmojiError('');
    }

    return isValid;
  };

  // Handle create/update
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      if (isEditMode) {
        // Update existing collection
        await updateCollection(initialData.collectionId, {
          name: name.trim(),
          emoji: emoji.trim(),
          description: description.trim()
        });
      } else {
        // Create new collection
        const newCollection = await createCollection(
          name.trim(),
          emoji.trim(),
          description.trim()
        );

        if (onSuccess) {
          onSuccess(newCollection);
        }
      }

      resetForm();
      onDismiss();
    } catch (error) {
      console.error('Error saving collection:', error);
      setNameError('Failed to save collection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleCancel}
        contentContainerStyle={[styles.modalContainer, { backgroundColor: colors.card }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text variant="headlineSmall" style={[styles.title, { color: colors.text }]}>
              {isEditMode ? 'Edit Collection' : 'Create New Collection'}
            </Text>
          </View>

          {/* Form Fields in ScrollView */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Name Input */}
            <TextInput
              label="Collection Name *"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (text.trim()) setNameError('');
              }}
              mode="outlined"
              style={[styles.input, { backgroundColor: colors.card }]}
              error={!!nameError}
              maxLength={30}
              autoFocus={!isEditMode}
              placeholder="e.g., My Favorites"
              activeOutlineColor="#00D084"
              outlineColor={colors.border}
              textColor={colors.text}
              placeholderTextColor={colors.textLight}
            />
            {nameError ? (
              <HelperText type="error" visible={!!nameError}>
                {nameError}
              </HelperText>
            ) : (
              <HelperText type="info" visible>
                {name.length}/30 characters
              </HelperText>
            )}

            {/* Emoji Input */}
            <TextInput
              label="Emoji *"
              value={emoji}
              onChangeText={(text) => {
                setEmoji(text);
                if (text.trim()) setEmojiError('');
              }}
              mode="outlined"
              style={[styles.input, { backgroundColor: colors.card }]}
              error={!!emojiError}
              maxLength={10}
              placeholder="Tap to add emoji 😊"
              returnKeyType="done"
              activeOutlineColor="#00D084"
              outlineColor={colors.border}
              textColor={colors.text}
              placeholderTextColor={colors.textLight}
            />
            {emojiError ? (
              <HelperText type="error" visible={!!emojiError}>
                {emojiError}
              </HelperText>
            ) : (
              <HelperText type="info" visible>
                Use your keyboard's emoji picker
              </HelperText>
            )}

            {/* Description Input */}
            <TextInput
              label="Description (Optional)"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              style={[styles.input, { backgroundColor: colors.card }]}
              multiline
              numberOfLines={3}
              maxLength={200}
              placeholder="Add a description..."
              activeOutlineColor="#00D084"
              outlineColor={colors.border}
              textColor={colors.text}
              placeholderTextColor={colors.textLight}
            />
            <HelperText type="info" visible>
              {description.length}/200 characters
            </HelperText>
          </ScrollView>

          {/* Action Buttons - Outside ScrollView */}
          <View style={[styles.actions, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <View style={styles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={handleCancel}
                style={styles.button}
                disabled={loading}
                textColor="#FF3B30"
                buttonColor="transparent"
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.button}
                disabled={loading || !name.trim() || !emoji.trim()}
                loading={loading}
                buttonColor="#00D084"
                textColor="#FFFFFF"
              >
                {isEditMode ? 'Update' : 'Create'}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    borderRadius: 20,
    marginHorizontal: 20,
    maxHeight: '70%',
    overflow: 'hidden',
    alignSelf: 'center',
    width: '90%'
  },
  keyboardView: {
    maxHeight: '100%'
  },
  header: {
    padding: 20,
    paddingBottom: 16
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8
  },
  input: {
    marginBottom: 4
  },
  actions: {
    borderTopWidth: 1
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12
  },
  button: {
    flex: 1
  }
});

export default CreateCollectionModal;
