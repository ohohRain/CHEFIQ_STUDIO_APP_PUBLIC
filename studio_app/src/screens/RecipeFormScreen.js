import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { collection, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import storageService from '../services/storageService';
import recipeService from '../services/recipeService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CUISINE_OPTIONS = [
  'Chinese',
  'Italian',
  'Mexican',
  'Japanese',
  'American',
  'French',
  'Indian',
  'Thai',
  'Korean',
  'Mediterranean',
  'Vietnamese',
  'Greek',
  'Spanish',
  'Middle Eastern',
  'Caribbean',
  'Dessert',
  'Other',
];

const RecipeFormScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const { user, userProfile } = useAuth();

  // Check if editing existing recipe or from AI parsing
  const isEditMode = route.params?.mode === 'edit' && route.params?.recipeId;
  const isFromAI = route.params?.mode === 'ai-parsed';
  const existingRecipeId = route.params?.recipeId;

  // Form state (empty by default)
  const [showAIAlert, setShowAIAlert] = useState(isFromAI);
  const [coverImage, setCoverImage] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [cookingTime, setCookingTime] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [equipment, setEquipment] = useState([]);
  const [customEquipmentInput, setCustomEquipmentInput] = useState('');
  const [ingredients, setIngredients] = useState([{ id: '1', name: '', amount: '' }]);
  const [steps, setSteps] = useState([{ id: '1', description: '', image: null }]);

  // UI state
  const [showCuisineModal, setShowCuisineModal] = useState(false);
  const [ingredientsEditMode, setIngredientsEditMode] = useState(false);
  const [stepsEditMode, setStepsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(isEditMode);
  const [uploadProgress, setUploadProgress] = useState({});
  const [loadingOperation, setLoadingOperation] = useState(''); // 'saving', 'publishing', 'deleting'

  // Track if we're performing a delete operation to skip confirmation dialog
  const isDeletingRef = useRef(false);

  // Load existing recipe data when in edit mode
  useEffect(() => {
    const loadRecipeData = async () => {
      if (!isEditMode || !existingRecipeId) return;

      try {
        setLoadingRecipe(true);
        console.log('[RecipeForm] Loading recipe for edit:', existingRecipeId);

        const result = await recipeService.getRecipe(existingRecipeId, user.uid);

        if (!result.success) {
          Alert.alert('Error', result.error.message);
          navigation.goBack();
          return;
        }

        const recipe = result.data.recipe;
        console.log('[RecipeForm] Recipe loaded:', recipe.title);

        // Populate form with existing data
        setCoverImage(recipe.coverImage);
        setTitle(recipe.title);
        setDescription(recipe.description || '');
        setDifficulty(recipe.difficulty);
        setCookingTime(recipe.cookingTime.toString());
        setCuisine(recipe.cuisine);
        setEquipment(recipe.equipment || []);

        // Format ingredients with IDs
        setIngredients(
          recipe.ingredients.map((ing, idx) => ({
            id: (idx + 1).toString(),
            name: ing.name,
            amount: ing.amount,
          }))
        );

        // Format steps with IDs
        setSteps(
          recipe.steps.map((step, idx) => ({
            id: (idx + 1).toString(),
            description: step.description,
            image: step.image,
          }))
        );
      } catch (error) {
        console.error('[RecipeForm] Error loading recipe:', error);
        Alert.alert('Error', 'Failed to load recipe. Please try again.');
        navigation.goBack();
      } finally {
        setLoadingRecipe(false);
      }
    };

    loadRecipeData();
  }, [isEditMode, existingRecipeId, user.uid, navigation]);

  // Load AI-parsed data when available
  useEffect(() => {
    if (isFromAI && route.params?.parsedData) {
      const data = route.params.parsedData;
      console.log('[RecipeForm] Loading AI-parsed data:', data);

      // Pre-fill form fields with parsed data
      if (data.title) setTitle(data.title);
      if (data.cuisine) setCuisine(data.cuisine);
      if (data.difficulty) setDifficulty(data.difficulty);
      if (data.cookingTime) setCookingTime(String(data.cookingTime));
      if (data.description) setDescription(data.description);

      // Set ingredients (ensure at least one row)
      if (data.ingredients && data.ingredients.length > 0) {
        setIngredients(data.ingredients);
      }

      // Set steps (ensure at least one row)
      if (data.steps && data.steps.length > 0) {
        setSteps(data.steps);
      }

      console.log('[RecipeForm] AI-parsed data loaded successfully');
    }
  }, [isFromAI, route.params?.parsedData]);

  // Equipment options
  const equipmentOptions = [
    'iQ Cooker - Multi-Cooker',
    'iQ Sense - Smart Thermometer',
    'iQ MiniOven - Air Fryer Oven',
  ];

  const handleBack = () => {
    // Skip confirmation if we're in the middle of a delete operation
    if (isDeletingRef.current) {
      navigation.goBack();
      return;
    }

    Alert.alert(
      'Discard Changes?',
      'Are you sure you want to go back? All changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  };

  const handleSaveDraft = async () => {
    try {
      setLoading(true);
      setLoadingOperation('saving');

      // Basic validation for draft
      if (!title.trim()) {
        Alert.alert('Error', 'Please enter a recipe title');
        return;
      }

      if (ingredients.length === 0 || ingredients.some((i) => !i.name.trim())) {
        Alert.alert('Error', 'Please add at least one ingredient with a name');
        return;
      }

      if (steps.length === 0 || steps.some((s) => !s.description.trim())) {
        Alert.alert('Error', 'Please add at least one cooking step with description');
        return;
      }

      if (!difficulty) {
        Alert.alert('Error', 'Please select a difficulty level');
        return;
      }
      if (!cookingTime || parseInt(cookingTime) <= 0) {
        Alert.alert('Error', 'Please enter a valid cooking time');
        return;
      }
      if (!cuisine) {
        Alert.alert('Error', 'Please select a cuisine type');
        return;
      }

      // Use existing recipe ID if editing, otherwise generate new
      const recipeId = isEditMode ? existingRecipeId : doc(collection(db, 'recipes')).id;

      // Upload cover image if it's a new local file
      let coverImageUrl = coverImage;
      if (coverImage && typeof coverImage === 'string' && coverImage.startsWith('file://')) {
        setUploadProgress({ cover: 0 });
        const coverResult = await storageService.uploadRecipeCoverImage(
          recipeId,
          coverImage,
          (progress) => setUploadProgress({ cover: progress })
        );

        if (!coverResult.success) {
          Alert.alert('Error', 'Failed to upload cover image: ' + coverResult.error.message);
          return;
        }
        coverImageUrl = coverResult.data.downloadURL;
      }

      // Upload step images if present
      const uploadedSteps = await Promise.all(
        steps.map(async (step, index) => {
          if (step.image && typeof step.image === 'string' && step.image.startsWith('file://')) {
            setUploadProgress((prev) => ({ ...prev, [`step_${index}`]: 0 }));
            const stepResult = await storageService.uploadRecipeStepImage(
              recipeId,
              index,
              step.image,
              (progress) =>
                setUploadProgress((prev) => ({ ...prev, [`step_${index}`]: progress }))
            );

            if (stepResult.success) {
              return {
                ...step,
                image: stepResult.data.downloadURL,
              };
            }
          }
          return step;
        })
      );

      // Prepare recipe data
      const recipeData = {
        title: title.trim(),
        description: description.trim(),
        coverImage: coverImageUrl,
        difficulty,
        cookingTime: parseInt(cookingTime),
        cuisine,
        equipment,
        ingredients: ingredients.map((i) => ({
          name: i.name.trim(),
          amount: i.amount.trim(),
        })),
        steps: uploadedSteps.map((s) => ({
          description: s.description.trim(),
          image: s.image && typeof s.image === 'string' && s.image.startsWith('http') ? s.image : null,
        })),
        authorId: user.uid,
        authorUsername: userProfile.username,
        authorAvatar: userProfile.avatar,
      };

      // Create or update draft recipe
      const result = isEditMode
        ? await recipeService.updateRecipe(recipeId, recipeData, user.uid)
        : await recipeService.createRecipe(recipeData, true, recipeId); // Pass recipeId for image coordination

      if (result.success) {
        Alert.alert('Success', isEditMode ? 'Recipe updated successfully!' : 'Draft saved successfully!', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to Home when coming from AI Smart Input, otherwise go back
              if (isFromAI) {
                navigation.navigate('MainTabs', { screen: 'Home' });
              } else {
                navigation.goBack();
              }
            }
          }
        ]);
      } else {
        // Extract first error message for user-friendly display
        const errorMessage = result.error.message.split(',')[0].trim();
        Alert.alert('Missing Information', errorMessage);
      }
    } catch (error) {
      console.error('Save draft error:', error);
      Alert.alert('Error', 'Failed to save draft. Please try again.');
    } finally {
      setLoading(false);
      setUploadProgress({});
    }
  };

  const handlePublish = async () => {
    try {
      setLoading(true);
      setLoadingOperation('publishing');

      // Full validation for publishing
      if (!coverImage) {
        Alert.alert('Error', 'Please upload a cover photo');
        return;
      }
      if (!title.trim()) {
        Alert.alert('Error', 'Please enter a recipe title');
        return;
      }
      if (!difficulty) {
        Alert.alert('Error', 'Please select a difficulty level');
        return;
      }
      if (!cookingTime || parseInt(cookingTime) <= 0) {
        Alert.alert('Error', 'Please enter a valid cooking time');
        return;
      }
      if (!cuisine) {
        Alert.alert('Error', 'Please select a cuisine type');
        return;
      }
      if (ingredients.length === 0 || ingredients.some((i) => !i.name.trim())) {
        Alert.alert('Error', 'Please add at least one ingredient with a name');
        return;
      }
      if (steps.length === 0 || steps.some((s) => !s.description.trim())) {
        Alert.alert('Error', 'Please add at least one cooking step with description');
        return;
      }

      // Use existing recipe ID if editing, otherwise generate new
      const recipeId = isEditMode ? existingRecipeId : doc(collection(db, 'recipes')).id;

      // Upload cover image if it's a new local file
      let coverImageUrl = coverImage;
      if (coverImage && typeof coverImage === 'string' && coverImage.startsWith('file://')) {
        setUploadProgress({ cover: 0 });
        const coverResult = await storageService.uploadRecipeCoverImage(
          recipeId,
          coverImage,
          (progress) => setUploadProgress({ cover: progress })
        );

        if (!coverResult.success) {
          Alert.alert('Error', 'Failed to upload cover image: ' + coverResult.error.message);
          return;
        }
        coverImageUrl = coverResult.data.downloadURL;
      }

      // Upload step images in parallel
      const uploadedSteps = await Promise.all(
        steps.map(async (step, index) => {
          if (step.image && typeof step.image === 'string' && step.image.startsWith('file://')) {
            setUploadProgress((prev) => ({ ...prev, [`step_${index}`]: 0 }));
            const stepResult = await storageService.uploadRecipeStepImage(
              recipeId,
              index,
              step.image,
              (progress) =>
                setUploadProgress((prev) => ({ ...prev, [`step_${index}`]: progress }))
            );

            if (stepResult.success) {
              return {
                ...step,
                image: stepResult.data.downloadURL,
              };
            }
          }
          return step;
        })
      );

      // Prepare recipe data
      const recipeData = {
        title: title.trim(),
        description: description.trim(),
        coverImage: coverImageUrl,
        difficulty,
        cookingTime: parseInt(cookingTime),
        cuisine,
        equipment,
        ingredients: ingredients.map((i) => ({
          name: i.name.trim(),
          amount: i.amount.trim(),
        })),
        steps: uploadedSteps.map((s) => ({
          description: s.description.trim(),
          image: s.image && typeof s.image === 'string' && s.image.startsWith('http') ? s.image : null,
        })),
        authorId: user.uid,
        authorUsername: userProfile.username,
        authorAvatar: userProfile.avatar,
      };

      // Create or update published recipe
      let result;
      if (isEditMode) {
        // First update the recipe data
        const updateResult = await recipeService.updateRecipe(recipeId, recipeData, user.uid);
        if (!updateResult.success) {
          // Extract first error message for user-friendly display
          const errorMessage = updateResult.error.message.split(',')[0].trim();
          Alert.alert('Missing Information', errorMessage);
          return;
        }
        // Then publish if it's a draft
        result = await recipeService.publishRecipe(recipeId, user.uid);
      } else {
        // Create new published recipe (pass recipeId for image coordination)
        result = await recipeService.createRecipe(recipeData, false, recipeId);
      }

      if (result.success) {
        Alert.alert('Success', 'Recipe published successfully!', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to Home when coming from AI Smart Input
              if (isFromAI) {
                navigation.navigate('MainTabs', { screen: 'Home' });
              } else {
                // Replace RecipeForm with RecipeDetail in the navigation stack
                // This ensures back button goes to ProfileScreen, not RecipeForm
                navigation.replace('RecipeDetail', {
                  recipeId: isEditMode ? recipeId : result.data.recipeId,
                });
              }
            },
          },
        ]);
      } else {
        // Extract first error message for user-friendly display
        const errorMessage = result.error.message.split(',')[0].trim();
        Alert.alert('Missing Information', errorMessage);
      }
    } catch (error) {
      console.error('Publish error:', error);
      Alert.alert('Error', 'Failed to publish recipe. Please try again.');
    } finally {
      setLoading(false);
      setUploadProgress({});
    }
  };

  const handleDeleteRecipe = () => {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              setLoadingOperation('deleting');
              isDeletingRef.current = true; // Mark that we're deleting
              console.log('[RecipeFormScreen] Deleting recipe:', existingRecipeId);

              const result = await recipeService.deleteRecipe(existingRecipeId, user.uid);

              if (!result.success) {
                throw new Error(result.error.message);
              }

              console.log('[RecipeFormScreen] Recipe deleted successfully');

              // Navigate back (handleBack will skip confirmation because isDeletingRef.current is true)
              navigation.goBack();
            } catch (error) {
              console.error('[RecipeFormScreen] Error deleting recipe:', error);
              isDeletingRef.current = false; // Reset on error
              Alert.alert('Delete Failed', error.message || 'Failed to delete recipe. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const pickImage = async (aspectRatio = [1, 1]) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: aspectRatio,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
      return null;
    }
  };

  const handleCoverPhotoUpload = async () => {
    const uri = await pickImage();
    if (uri) {
      setCoverImage(uri);
    }
  };

  const handleRemoveCoverPhoto = () => {
    setCoverImage(null);
  };

  const toggleEquipment = (item) => {
    if (equipment.includes(item)) {
      setEquipment(equipment.filter((e) => e !== item));
    } else {
      setEquipment([...equipment, item]);
    }
  };

  const addCustomEquipment = () => {
    const trimmedInput = customEquipmentInput.trim();
    if (!trimmedInput) {
      Alert.alert('Error', 'Please enter equipment name');
      return;
    }
    if (equipment.includes(trimmedInput)) {
      Alert.alert('Error', 'This equipment is already added');
      return;
    }
    setEquipment([...equipment, trimmedInput]);
    setCustomEquipmentInput('');
  };

  const removeCustomEquipment = (item) => {
    setEquipment(equipment.filter((e) => e !== item));
  };

  const addIngredient = () => {
    const newId = (ingredients.length + 1).toString();
    setIngredients([...ingredients, { id: newId, name: '', amount: '' }]);
  };

  const removeIngredient = (id) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((i) => i.id !== id));
    } else {
      Alert.alert('Error', 'You must have at least one ingredient');
    }
  };

  const updateIngredient = (id, field, value) => {
    setIngredients(
      ingredients.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const moveIngredient = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= ingredients.length) return;
    const newIngredients = [...ingredients];
    const [movedItem] = newIngredients.splice(fromIndex, 1);
    newIngredients.splice(toIndex, 0, movedItem);
    setIngredients(newIngredients);
  };

  const addStep = () => {
    const newId = (steps.length + 1).toString();
    setSteps([...steps, { id: newId, description: '', image: null }]);
  };

  const removeStep = (id) => {
    if (steps.length > 1) {
      setSteps(steps.filter((s) => s.id !== id));
    } else {
      Alert.alert('Error', 'You must have at least one cooking step');
    }
  };

  const updateStep = (id, field, value) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const moveStep = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= steps.length) return;
    const newSteps = [...steps];
    const [movedItem] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, movedItem);
    setSteps(newSteps);
  };

  const handleStepPhotoUpload = async (stepId) => {
    const uri = await pickImage([3, 2]); // 3:2 aspect ratio to match preview (361x240)
    if (uri) {
      updateStep(stepId, 'image', uri);
    }
  };

  const handleRemoveStepPhoto = (stepId) => {
    updateStep(stepId, 'image', null);
  };

  // Show loading state while loading recipe data
  if (loadingRecipe) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading recipe...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Recipe' : 'Create Recipe'}</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveDraft}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* AI Alert Banner */}
        {showAIAlert && (
          <View style={styles.aiAlert}>
            <Text style={styles.aiAlertIcon}>✨</Text>
            <Text style={styles.aiAlertText}>
              AI parsed your recipe. Please review before publishing.
            </Text>
            <TouchableOpacity
              style={styles.aiAlertClose}
              onPress={() => setShowAIAlert(false)}
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Cover Photo Upload */}
        <View style={styles.section}>
          {coverImage ? (
            <View style={styles.coverImageContainer}>
              <Image
                source={typeof coverImage === 'string' ? { uri: coverImage } : coverImage}
                style={styles.coverImage}
              />
              <TouchableOpacity
                style={styles.removeCoverButton}
                onPress={handleRemoveCoverPhoto}
              >
                <MaterialCommunityIcons name="delete" size={16} color={colors.error} />
                <Text style={styles.removeCoverText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.coverUploadZone}
              onPress={handleCoverPhotoUpload}
            >
              <MaterialCommunityIcons name="camera" size={48} color={colors.primary} />
              <Text style={styles.uploadTitle}>Upload Cover Photo</Text>
              <Text style={styles.uploadSubtitle}>Tap to add image</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recipe Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Recipe Title *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter recipe title..."
            placeholderTextColor="#999999"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            clearButtonMode="while-editing"
            autoCapitalize="words"
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Share the story behind this dish..."
            placeholderTextColor="#999999"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
            textAlignVertical="top"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Recipe Metadata Section Header */}
        <Text style={styles.sectionHeader}>Recipe Metadata</Text>

        {/* Difficulty Level */}
        <View style={styles.section}>
          <Text style={styles.label}>Difficulty Level *</Text>
          <View style={styles.radioGroup}>
            {['Easy', 'Medium', 'Hard'].map((level) => (
              <TouchableOpacity
                key={level}
                style={styles.radioButton}
                onPress={() => setDifficulty(level)}
              >
                <View style={styles.radioCircle}>
                  {difficulty === level && (
                    <View style={styles.radioCircleSelected} />
                  )}
                </View>
                <Text style={styles.radioLabel}>{level}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Cooking Time */}
        <View style={styles.section}>
          <Text style={styles.label}>Cooking Time *</Text>
          <View style={styles.timeInputContainer}>
            <TextInput
              style={styles.timeInput}
              placeholder="30"
              placeholderTextColor="#999999"
              value={cookingTime}
              onChangeText={setCookingTime}
              keyboardType="numeric"
              maxLength={3}
              clearButtonMode="while-editing"
            />
            <Text style={styles.timeLabel}>minutes</Text>
          </View>
        </View>

        {/* Cuisine Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Cuisine Type *</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowCuisineModal(true)}
          >
            <Text
              style={[
                styles.dropdownText,
                !cuisine && styles.dropdownPlaceholder,
              ]}
            >
              {cuisine || 'Select cuisine...'}
            </Text>
            <MaterialCommunityIcons
              name="chevron-down"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Equipment */}
        <View style={styles.section}>
          <Text style={styles.label}>Equipment (Optional)</Text>

          {/* Chef iQ Equipment Checkboxes */}
          {equipmentOptions.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.checkboxRow}
              onPress={() => toggleEquipment(item)}
            >
              <View style={[
                styles.checkbox,
                equipment.includes(item) && styles.checkboxChecked
              ]}>
                {equipment.includes(item) && (
                  <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>{item}</Text>
            </TouchableOpacity>
          ))}

          {/* Custom Equipment Input */}
          <View style={styles.customEquipmentSection}>
            <Text style={styles.customEquipmentLabel}>Other Equipment:</Text>
            <View style={styles.customEquipmentInputRow}>
              <TextInput
                style={styles.customEquipmentInput}
                placeholder="e.g. Stand mixer, Whisk, Blender..."
                placeholderTextColor="#999999"
                value={customEquipmentInput}
                onChangeText={setCustomEquipmentInput}
                maxLength={50}
                clearButtonMode="while-editing"
                autoCapitalize="words"
              />
              <TouchableOpacity
                style={[styles.outlinedButton, styles.addButton]}
                onPress={addCustomEquipment}
              >
                <Text style={[styles.outlinedButtonText, styles.addButtonText]}>
                  + Add Equipment
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Display Custom Equipment Tags */}
          {equipment.filter(item => !equipmentOptions.includes(item)).length > 0 && (
            <View style={styles.customEquipmentTags}>
              <Text style={styles.customEquipmentTagsLabel}>Added:</Text>
              <View style={styles.tagsContainer}>
                {equipment
                  .filter(item => !equipmentOptions.includes(item))
                  .map((item, index) => (
                    <View key={index} style={styles.equipmentTag}>
                      <Text style={styles.equipmentTagText}>{item}</Text>
                      <TouchableOpacity
                        onPress={() => removeCustomEquipment(item)}
                        style={styles.removeTagButton}
                      >
                        <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Ingredients Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.label}>Ingredients *</Text>
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color={colors.textSecondary}
            />
          </View>

          {/* Ingredients Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 6 }]}>
              Ingredient Name
            </Text>
            <Text style={[styles.tableHeaderText, { flex: 4 }]}>Amount</Text>
          </View>

          {/* Ingredients List */}
          {ingredientsEditMode ? (
            ingredients.map((item, index) => (
              <View key={item.id} style={styles.ingredientRow}>
                <View style={styles.reorderButtons}>
                  <TouchableOpacity
                    style={[styles.arrowButton, index === 0 && styles.arrowButtonDisabled]}
                    onPress={() => moveIngredient(index, index - 1)}
                    disabled={index === 0}
                  >
                    <MaterialCommunityIcons
                      name="chevron-up"
                      size={20}
                      color={index === 0 ? colors.border : colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.arrowButton, index === ingredients.length - 1 && styles.arrowButtonDisabled]}
                    onPress={() => moveIngredient(index, index + 1)}
                    disabled={index === ingredients.length - 1}
                  >
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={index === ingredients.length - 1 ? colors.border : colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.ingredientInput, { flex: 6 }]}
                  placeholder="e.g. Chicken breast"
                  placeholderTextColor="#999999"
                  value={item.name}
                  onChangeText={(text) =>
                    updateIngredient(item.id, 'name', text)
                  }
                  clearButtonMode="while-editing"
                  autoCapitalize="words"
                />
                <TextInput
                  style={[styles.ingredientInput, { flex: 4 }]}
                  placeholder="e.g. 200g"
                  placeholderTextColor="#999999"
                  value={item.amount}
                  onChangeText={(text) =>
                    updateIngredient(item.id, 'amount', text)
                  }
                  clearButtonMode="while-editing"
                />
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeIngredient(item.id)}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            ingredients.map((item) => (
              <View key={item.id} style={styles.ingredientRow}>
                <TextInput
                  style={[styles.ingredientInput, { flex: 6 }]}
                  placeholder="e.g. Chicken breast"
                  placeholderTextColor="#999999"
                  value={item.name}
                  onChangeText={(text) => updateIngredient(item.id, 'name', text)}
                  clearButtonMode="while-editing"
                  autoCapitalize="words"
                />
                <TextInput
                  style={[styles.ingredientInput, { flex: 4 }]}
                  placeholder="e.g. 200g"
                  placeholderTextColor="#999999"
                  value={item.amount}
                  onChangeText={(text) =>
                    updateIngredient(item.id, 'amount', text)
                  }
                  clearButtonMode="while-editing"
                />
              </View>
            ))
          )}

          {/* Ingredient Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.outlinedButton}
              onPress={() => setIngredientsEditMode(!ingredientsEditMode)}
            >
              <Text style={styles.outlinedButtonText}>
                {ingredientsEditMode ? 'Done' : 'Adjust Order'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlinedButton, styles.addButton]}
              onPress={addIngredient}
            >
              <Text style={[styles.outlinedButtonText, styles.addButtonText]}>
                + Add Ingredient
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Cooking Steps Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Cooking Steps *</Text>

          {/* Steps List */}
          {stepsEditMode ? (
            steps.map((item, index) => (
              <View key={item.id} style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <View style={styles.reorderButtons}>
                    <TouchableOpacity
                      style={[styles.arrowButton, index === 0 && styles.arrowButtonDisabled]}
                      onPress={() => moveStep(index, index - 1)}
                      disabled={index === 0}
                    >
                      <MaterialCommunityIcons
                        name="chevron-up"
                        size={20}
                        color={index === 0 ? colors.border : colors.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.arrowButton, index === steps.length - 1 && styles.arrowButtonDisabled]}
                      onPress={() => moveStep(index, index + 1)}
                      disabled={index === steps.length - 1}
                    >
                      <MaterialCommunityIcons
                        name="chevron-down"
                        size={20}
                        color={index === steps.length - 1 ? colors.border : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.stepNumber}>Step {index + 1}</Text>
                  <TouchableOpacity
                    style={styles.deleteStepButton}
                    onPress={() => removeStep(item.id)}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={20}
                      color={colors.error}
                    />
                  </TouchableOpacity>
                </View>

                {/* Step Image Upload */}
                {item.image ? (
                  <View style={styles.stepImageContainer}>
                    <Image
                      source={typeof item.image === 'string' ? { uri: item.image } : item.image}
                      style={styles.stepImage}
                    />
                    <TouchableOpacity
                      style={styles.removeStepImageButton}
                      onPress={() => handleRemoveStepPhoto(item.id)}
                    >
                      <MaterialCommunityIcons
                        name="delete"
                        size={14}
                        color={colors.error}
                      />
                      <Text style={styles.removeStepImageText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.stepUploadZone}
                    onPress={() => handleStepPhotoUpload(item.id)}
                  >
                    <Text style={styles.stepUploadText}>+ Add Step Photo</Text>
                    <Text style={styles.stepUploadSubtext}>
                      Clear photos make recipes more appealing
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Step Description */}
                <TextInput
                  style={styles.stepTextArea}
                  placeholder="Describe this step..."
                  placeholderTextColor="#999999"
                  value={item.description}
                  onChangeText={(text) =>
                    updateStep(item.id, 'description', text)
                  }
                  multiline
                  textAlignVertical="top"
                  clearButtonMode="while-editing"
                />
              </View>
            ))
          ) : (
            steps.map((item, index) => (
              <View key={item.id} style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepNumber}>Step {index + 1}</Text>
                  {steps.length > 1 && (
                    <TouchableOpacity
                      style={styles.deleteStepButton}
                      onPress={() => removeStep(item.id)}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={20}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Step Image Upload */}
                {item.image ? (
                  <View style={styles.stepImageContainer}>
                    <Image
                      source={typeof item.image === 'string' ? { uri: item.image } : item.image}
                      style={styles.stepImage}
                    />
                    <TouchableOpacity
                      style={styles.removeStepImageButton}
                      onPress={() => handleRemoveStepPhoto(item.id)}
                    >
                      <MaterialCommunityIcons
                        name="delete"
                        size={14}
                        color={colors.error}
                      />
                      <Text style={styles.removeStepImageText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.stepUploadZone}
                    onPress={() => handleStepPhotoUpload(item.id)}
                  >
                    <Text style={styles.stepUploadText}>+ Add Step Photo</Text>
                    <Text style={styles.stepUploadSubtext}>
                      Clear photos make recipes more appealing
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Step Description */}
                <TextInput
                  style={styles.stepTextArea}
                  placeholder="Describe this step..."
                  placeholderTextColor="#999999"
                  value={item.description}
                  onChangeText={(text) =>
                    updateStep(item.id, 'description', text)
                  }
                  multiline
                  textAlignVertical="top"
                  clearButtonMode="while-editing"
                />
              </View>
            ))
          )}

          {/* Step Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.outlinedButton}
              onPress={() => setStepsEditMode(!stepsEditMode)}
            >
              <Text style={styles.outlinedButtonText}>
                {stepsEditMode ? 'Done' : 'Adjust Order'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlinedButton, styles.addButton]}
              onPress={addStep}
            >
              <Text style={[styles.outlinedButtonText, styles.addButtonText]}>
                + Add Step
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Publish Button */}
        <TouchableOpacity style={styles.publishButton} onPress={handlePublish}>
          <Text style={styles.publishButtonText}>Publish Recipe</Text>
        </TouchableOpacity>

        {/* Delete Button - Only show in edit mode */}
        {isEditMode && (
          <TouchableOpacity
            style={styles.deleteRecipeButton}
            onPress={handleDeleteRecipe}
          >
            <Text style={styles.deleteRecipeButtonText}>Delete Recipe</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Cuisine Type Modal */}
      <Modal
        visible={showCuisineModal}
        transparent
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCuisineModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCuisineModal(false)}
        >
          <View
            style={[
              styles.cuisineModal,
              { paddingBottom: insets.bottom + 20 },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Cuisine Type</Text>
              <TouchableOpacity onPress={() => setShowCuisineModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.cuisineList}>
              {CUISINE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.cuisineOption}
                  onPress={() => {
                    setCuisine(option);
                    setShowCuisineModal(false);
                  }}
                >
                  <Text style={styles.cuisineOptionText}>{option}</Text>
                  {cuisine === option && (
                    <MaterialCommunityIcons
                      name="check"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {Object.keys(uploadProgress).length > 0
                ? 'Uploading images...'
                : loadingOperation === 'deleting'
                ? 'Deleting recipe...'
                : loadingOperation === 'publishing'
                ? 'Publishing recipe...'
                : 'Saving recipe...'}
            </Text>
            {uploadProgress.cover !== undefined && (
              <Text style={styles.progressText}>
                Cover: {Math.round(uploadProgress.cover * 100)}%
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
  },
  aiAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  aiAlertIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  aiAlertText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  aiAlertClose: {
    padding: 4,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  coverUploadZone: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.accent,
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginTop: 12,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  coverImageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 360,
    borderRadius: 12,
  },
  removeCoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  removeCoverText: {
    fontSize: 14,
    color: colors.error,
    marginLeft: 4,
  },
  textInput: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    height: 48,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 24,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioCircleSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    fontSize: 15,
    color: colors.text,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    width: 80,
    textAlign: 'center',
  },
  timeLabel: {
    fontSize: 15,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  dropdownButton: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 15,
    color: colors.text,
  },
  dropdownPlaceholder: {
    color: colors.textSecondary,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: colors.card,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 15,
    color: colors.text,
  },
  customEquipmentSection: {
    marginTop: 16,
  },
  customEquipmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  customEquipmentInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  customEquipmentInput: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    height: 48,
  },
  customEquipmentTags: {
    marginTop: 12,
  },
  customEquipmentTagsLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  equipmentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
  },
  equipmentTagText: {
    fontSize: 14,
    color: colors.text,
  },
  removeTagButton: {
    padding: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.accent,
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    paddingHorizontal: 4,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    backgroundColor: colors.card,
  },
  reorderButtons: {
    flexDirection: 'column',
    marginRight: 8,
    gap: 4,
  },
  arrowButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonDisabled: {
    opacity: 0.3,
  },
  ingredientInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 10,
    fontSize: 15,
    color: colors.text,
  },
  deleteButton: {
    padding: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  outlinedButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  outlinedButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  addButton: {
    borderColor: colors.primary,
  },
  addButtonText: {
    color: colors.primary,
  },
  stepCard: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  deleteStepButton: {
    padding: 4,
  },
  stepUploadZone: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepUploadText: {
    fontSize: 15,
    color: colors.primary,
  },
  stepUploadSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  stepImageContainer: {
    marginBottom: 12,
  },
  stepImage: {
    width: '100%',
    height: 280,
    borderRadius: 8,
  },
  removeStepImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  removeStepImageText: {
    fontSize: 12,
    color: colors.error,
    marginLeft: 4,
  },
  stepTextArea: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  publishButton: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 20,
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteRecipeButton: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.error,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteRecipeButtonText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  cuisineModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  cuisineList: {
    paddingHorizontal: 20,
  },
  cuisineOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cuisineOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginTop: 16,
  },
  progressText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
});

export default RecipeFormScreen;
