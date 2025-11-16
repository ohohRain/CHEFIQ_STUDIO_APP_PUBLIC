import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { useTheme } from '../contexts/ThemeContext';

// Preset tags grouped by category (20 total)
const PRESET_TAGS_GROUPED = {
  cuisine: {
    title: 'Cuisine',
    tags: [
      '🍳 Chinese Cuisine',
      '🍝 Italian',
      '🍛 Indian',
      '🍣 Japanese',
      '🌮 Mexican',
      '🍔 American',
      '🥖 French',
      '🥘 Mediterranean',
    ],
  },
  location: {
    title: 'Location',
    tags: [
      '📍 New York',
      '📍 Los Angeles',
      '📍 Chicago',
      '📍 San Francisco',
    ],
  },
  cookingStyle: {
    title: 'Cooking Style',
    tags: [
      '🏠 Home Cook',
      '👨‍🍳 Professional Chef',
      '🌱 Vegan',
      '🥗 Healthy Eating',
      '🍰 Baking',
      '🔥 Grilling',
      '⚡ Quick Meals',
      '🎂 Desserts',
    ],
  },
};

const EditProfileScreen = ({ navigation }) => {
  const { userProfile, user, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Form state
  const [username, setUsername] = useState(userProfile?.username || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [selectedTags, setSelectedTags] = useState(userProfile?.tags || []);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [tagPickerVisible, setTagPickerVisible] = useState(false);
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [errors, setErrors] = useState({});

  // Refs for custom tag input and scroll view
  const customTagInputRef = useRef(null);
  const tagPickerScrollRef = useRef(null);

  // Validation functions
  const validateUsername = (value) => {
    if (!value || value.trim().length === 0) {
      return 'Username is required';
    }
    if (value.trim().length < 2) {
      return 'Username must be at least 2 characters';
    }
    if (value.length > 30) {
      return 'Username cannot exceed 30 characters';
    }
    if (!/^[a-zA-Z0-9 _-]+$/.test(value)) {
      return 'Username can only contain letters, numbers, spaces, dash, and underscore';
    }
    return null;
  };

  const validateBio = (value) => {
    if (value.length > 120) {
      return 'Bio cannot exceed 120 characters';
    }
    return null;
  };

  const validateTags = (tagsArray) => {
    if (tagsArray.length > 5) {
      return 'Maximum 5 tags allowed';
    }
    return null;
  };

  // Real-time validation
  useEffect(() => {
    const newErrors = {};

    const usernameError = validateUsername(username);
    if (usernameError) newErrors.username = usernameError;

    const bioError = validateBio(bio);
    if (bioError) newErrors.bio = bioError;

    const tagsError = validateTags(selectedTags);
    if (tagsError) newErrors.tags = tagsError;

    setErrors(newErrors);
  }, [username, bio, selectedTags]);

  // Detect changes
  const hasChanges = useMemo(() => {
    return (
      username !== userProfile?.username ||
      bio !== (userProfile?.bio || '') ||
      JSON.stringify(selectedTags) !== JSON.stringify(userProfile?.tags || [])
    );
  }, [username, bio, selectedTags, userProfile]);

  // Enable save button
  const canSave = useMemo(() => {
    return (
      hasChanges &&
      username.trim().length >= 2 &&
      username.length <= 30 &&
      bio.length <= 120 &&
      selectedTags.length <= 5 &&
      Object.keys(errors).length === 0
    );
  }, [hasChanges, username, bio, selectedTags, errors]);

  // Handle cancel with confirmation
  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ],
        { cancelable: true }
      );
    } else {
      navigation.goBack();
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('Validation Error', 'Please fix all errors before saving.');
      return;
    }

    try {
      setIsSaving(true);

      const updates = {
        username: username.trim(),
        bio: bio.trim(),
        tags: selectedTags,
        updatedAt: serverTimestamp(),
      };

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updates);

      console.log('[EditProfileScreen] Profile updated successfully');

      // Refresh user profile in AuthContext
      await refreshProfile();

      // Show success feedback
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('[EditProfileScreen] Error updating profile:', error);

      let errorMessage = 'Failed to save profile. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Save Failed', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle tag selection
  const toggleTag = (tag) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        // Remove tag
        return prev.filter((t) => t !== tag);
      } else {
        // Add tag (max 5)
        if (prev.length >= 5) {
          Alert.alert('Maximum Tags', 'You can select up to 5 tags only.');
          return prev;
        }
        return [...prev, tag];
      }
    });
  };

  const removeTag = (tag) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  };

  // Auto-scroll to bottom when custom tag input appears
  useEffect(() => {
    if (showCustomTagInput && tagPickerScrollRef.current) {
      // Scroll to bottom after a short delay to allow layout
      setTimeout(() => {
        tagPickerScrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [showCustomTagInput]);

  // Handle custom tag creation
  const handleCustomTagPress = () => {
    setCustomTagInput('');
    setShowCustomTagInput(true);

    // Focus input and scroll to bottom
    setTimeout(() => {
      customTagInputRef.current?.focus();
      tagPickerScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const validateCustomTag = (value) => {
    if (!value || value.trim().length === 0) {
      return 'Tag cannot be empty';
    }
    if (value.length > 20) {
      return 'Tag cannot exceed 20 characters';
    }
    // Check if tag already exists
    if (selectedTags.includes(value.trim())) {
      return 'This tag is already selected';
    }
    return null;
  };

  const handleCustomTagSave = () => {
    const trimmedTag = customTagInput.trim();
    const error = validateCustomTag(trimmedTag);

    if (error) {
      Alert.alert('Invalid Tag', error);
      return;
    }

    if (selectedTags.length >= 5) {
      Alert.alert('Maximum Tags', 'You can select up to 5 tags only.');
      return;
    }

    // Add custom tag to selected tags
    setSelectedTags((prev) => [...prev, trimmedTag]);
    setShowCustomTagInput(false);
    setCustomTagInput('');
  };

  const handleCustomTagCancel = () => {
    setShowCustomTagInput(false);
    setCustomTagInput('');
  };

  // Render tag picker modal with groups
  const renderTagPicker = () => {
    // Render preset tag categories
    const renderPresetSections = () => {
      return Object.keys(PRESET_TAGS_GROUPED).map((categoryKey) => {
        const category = PRESET_TAGS_GROUPED[categoryKey];
        return (
          <View key={categoryKey} style={styles.tagCategory}>
            {/* Category Title */}
            <Text style={styles.tagCategoryTitle}>{category.title}</Text>

            {/* Category Tags */}
            {category.tags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              const isDisabled = !isSelected && selectedTags.length >= 5;

              return (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagPickerItem,
                    isSelected && styles.tagPickerItemSelected,
                    isDisabled && styles.tagPickerItemDisabled,
                  ]}
                  onPress={() => !isDisabled && toggleTag(tag)}
                  disabled={isDisabled}
                >
                  <Text
                    style={[
                      styles.tagPickerItemText,
                      isDisabled && styles.tagPickerItemTextDisabled,
                    ]}
                  >
                    {tag}
                  </Text>
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      });
    };

    // Render Other (Custom) section
    const renderOtherSection = () => {
      return (
        <View style={styles.tagCategory}>
          {/* Category Title */}
          <Text style={styles.tagCategoryTitle}>Other</Text>

          {showCustomTagInput ? (
            // Custom Tag Input Form
            <View style={styles.customTagInputContainer}>
              <Text style={styles.customTagInputLabel}>Create Custom Tag</Text>
              <TextInput
                ref={customTagInputRef}
                style={styles.customTagInputField}
                value={customTagInput}
                onChangeText={setCustomTagInput}
                placeholder="Enter tag name (max 20 characters)"
                placeholderTextColor={colors.textLight}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={handleCustomTagSave}
                clearButtonMode="while-editing"
              />
              <View style={styles.customTagInputFooter}>
                <Text style={styles.customTagInputCounter}>
                  {customTagInput.length}/20
                </Text>
              </View>
              <View style={styles.customTagInputButtons}>
                <TouchableOpacity
                  style={[styles.customTagInputButton, styles.customTagInputCancelButton]}
                  onPress={handleCustomTagCancel}
                >
                  <Text style={styles.customTagInputCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.customTagInputButton, styles.customTagInputSaveButton]}
                  onPress={handleCustomTagSave}
                  disabled={!customTagInput.trim()}
                >
                  <Text
                    style={[
                      styles.customTagInputSaveText,
                      !customTagInput.trim() && { color: colors.disabled },
                    ]}
                  >
                    Add Tag
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Custom Tag Button
            <TouchableOpacity
              style={[
                styles.tagPickerItem,
                styles.tagPickerOtherItem,
              ]}
              onPress={handleCustomTagPress}
              disabled={selectedTags.length >= 5}
            >
              <Text style={styles.tagPickerOtherText}>
                ✏️ Create Custom Tag
              </Text>
              <MaterialCommunityIcons
                name="pencil-outline"
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      );
    };

    return (
      <Modal
        visible={tagPickerVisible}
        animationType="slide"
        transparent={true}
        presentationStyle="pageSheet"
        onRequestClose={() => setTagPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tagPickerContainer}>
            {/* Header */}
            <View style={styles.tagPickerHeader}>
              <Text style={styles.tagPickerTitle}>Select Tags (max 5)</Text>
              <TouchableOpacity
                onPress={() => setTagPickerVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Tag list with categories */}
            <ScrollView
              ref={tagPickerScrollRef}
              style={styles.tagPickerScroll}
              contentContainerStyle={styles.tagPickerList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {renderPresetSections()}
              {renderOtherSection()}
              {/* Extra space at bottom for keyboard - only show when input is open */}
              {showCustomTagInput && <View style={{ height: 150 }} />}
            </ScrollView>

            {/* Done button */}
            <TouchableOpacity
              style={styles.tagPickerDoneButton}
              onPress={() => setTagPickerVisible(false)}
            >
              <Text style={styles.tagPickerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
          <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Edit Profile</Text>

        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveButton}
          disabled={!canSave || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text
              style={[
                styles.saveText,
                !canSave && { color: colors.disabled },
              ]}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Username Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Username</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.textInput,
                errors.username && styles.textInputError,
              ]}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              placeholderTextColor={colors.textLight}
              maxLength={30}
              autoCapitalize="words"
              clearButtonMode="while-editing"
              textContentType="username"
              autoComplete="username"
            />
            <View style={styles.inputFooter}>
              <Text
                style={[
                  styles.charCounter,
                  username.length > 30 && { color: colors.error },
                ]}
              >
                {username.length}/30
              </Text>
              {!errors.username && username.length >= 2 && (
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={colors.primary}
                  style={styles.validIcon}
                />
              )}
            </View>
          </View>
          {errors.username && (
            <Text style={styles.errorText}>{errors.username}</Text>
          )}
        </View>

        {/* Handle Field (Read-Only) */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelWithInfo}>
            <Text style={styles.fieldLabelReadOnly}>Handle (cannot be changed)</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'About Handles',
                  'Your handle is auto-generated from your username and cannot be changed.'
                )
              }
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={16}
                color={colors.textLight}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.readOnlyInput}>
            <Text style={styles.readOnlyText}>{userProfile?.handle || '@user'}</Text>
          </View>
        </View>

        {/* Bio Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Bio</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.textInput,
                styles.textInputMultiline,
                errors.bio && styles.textInputError,
              ]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people about yourself..."
              placeholderTextColor={colors.textLight}
              maxLength={120}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              clearButtonMode="while-editing"
            />
            <View style={styles.inputFooter}>
              <Text
                style={[
                  styles.charCounter,
                  bio.length > 120 && { color: colors.error },
                ]}
              >
                {bio.length}/120
              </Text>
              {!errors.bio && bio.length > 0 && (
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={colors.primary}
                  style={styles.validIcon}
                />
              )}
            </View>
          </View>
          {errors.bio && <Text style={styles.errorText}>{errors.bio}</Text>}
        </View>

        {/* Tags Section */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Tags (max 5)</Text>
          <View style={styles.tagsContainer}>
            {selectedTags.map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagPillText}>{tag}</Text>
                <TouchableOpacity
                  onPress={() => removeTag(tag)}
                  style={styles.tagRemoveButton}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={14}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            ))}
            {selectedTags.length < 5 && (
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={() => setTagPickerVisible(true)}
              >
                <Text style={styles.addTagText}>+ Add Tag</Text>
              </TouchableOpacity>
            )}
          </View>
          {errors.tags && <Text style={styles.errorText}>{errors.tags}</Text>}
        </View>
      </ScrollView>

      {/* Tag Picker Modal */}
      {renderTagPicker()}
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cancelText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  saveButton: {
    paddingHorizontal: 8,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  fieldLabelReadOnly: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textLight,
  },
  labelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  textInput: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    height: 48,
  },
  textInputMultiline: {
    height: 80,
    paddingTop: 12,
  },
  textInputError: {
    borderColor: colors.error,
  },
  inputFooter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  charCounter: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  validIcon: {
    marginLeft: 2,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  readOnlyInput: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    height: 48,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontSize: 16,
    color: colors.textLight,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  tagPillText: {
    fontSize: 14,
    color: colors.text,
  },
  tagRemoveButton: {
    padding: 2,
  },
  addTagButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  addTagText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },

  // Tag Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  tagPickerContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    flexDirection: 'column',
  },
  tagPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tagPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  tagPickerScroll: {
    flex: 1,
  },
  tagPickerList: {
    paddingBottom: 16,
  },
  tagCategory: {
    marginBottom: 8,
  },
  tagCategoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tagPickerItemSelected: {
    backgroundColor: `${colors.primary}10`,
  },
  tagPickerItemDisabled: {
    opacity: 0.5,
  },
  tagPickerItemText: {
    fontSize: 16,
    color: colors.text,
  },
  tagPickerItemTextDisabled: {
    color: colors.textLight,
  },
  tagPickerDoneButton: {
    backgroundColor: colors.primary,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  tagPickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tagPickerOtherItem: {
    backgroundColor: `${colors.primary}08`,
    borderBottomColor: colors.primary,
  },
  tagPickerOtherText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },

  // Custom Tag Input (inside tag picker)
  customTagInputContainer: {
    backgroundColor: colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  customTagInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  customTagInputField: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  customTagInputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  customTagInputCounter: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  customTagInputButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  customTagInputButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  customTagInputCancelButton: {
    backgroundColor: colors.accent,
  },
  customTagInputSaveButton: {
    backgroundColor: colors.primary,
  },
  customTagInputCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  customTagInputSaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default EditProfileScreen;
