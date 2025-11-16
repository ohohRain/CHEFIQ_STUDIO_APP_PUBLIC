import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Alert,
  Linking,
  ActionSheetIOS,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { getRandomRecipes } from '../data/mockRecipes';
import { generateRecipeIdeas, generateRecipeImage, recognizeIngredientsFromImage, CHEF_IQ_EQUIPMENT } from '../services/aiService';
import ProductBadge from '../components/ProductBadge';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AIInspirationScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  // State management
  const [currentStep, setCurrentStep] = useState(1); // 1, 2, or 3
  const [ingredientsInput, setIngredientsInput] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  const [showCuisineModal, setShowCuisineModal] = useState(false);
  const [expandedCards, setExpandedCards] = useState([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "Hi! I am CHEF iQ 🧑‍🍳 Tell me what ingredients you have!",
    },
  ]);

  // AI-generated recipes state
  const [aiRecipes, setAiRecipes] = useState([]);
  const [generatingRecipes, setGeneratingRecipes] = useState(false);
  const [selectedChefIQEquipment, setSelectedChefIQEquipment] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [retryingImageId, setRetryingImageId] = useState(null); // Track which image is being retried

  // NEW: Image recognition and validation state
  const [imageRecognizing, setImageRecognizing] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // NEW: Progress tracking state
  const [generationProgress, setGenerationProgress] = useState({
    currentStep: 0,
    totalSteps: 4,
    stepName: '',
    imagesCompleted: 0,
    totalImages: 3,
  });

  // Animation values
  const modalFadeAnim = useRef(new Animated.Value(0)).current;

  // Keyboard listeners
  React.useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Quick select ingredients
  const quickIngredients = [
    'Chicken',
    'Beef',
    'Shrimp',
    'Pork',
    'Salmon',
    'Eggs',
    'Tofu',
    'Broccoli',
    'Carrot',
    'Potato',
    'Tomato',
    'Onion',
    'Garlic',
    'Spinach',
    'Bell Pepper',
    'Mushroom',
    'Zucchini',
    'Rice',
    'Pasta',
    'Cheese',
  ];

  // Cuisine options
  const cuisineOptions = [
    { id: 'chinese', label: 'Chinese', emoji: '🍜' },
    { id: 'italian', label: 'Italian', emoji: '🍝' },
    { id: 'japanese', label: 'Japanese', emoji: '🍱' },
    { id: 'korean', label: 'Korean', emoji: '🥘' },
    { id: 'asian', label: 'Southeast Asian', emoji: '🍲' },
    { id: 'indian', label: 'Indian', emoji: '🍛' },
    { id: 'mexican', label: 'Mexican', emoji: '🌮' },
    { id: 'french', label: 'French', emoji: '🥖' },
    { id: 'spanish', label: 'Spanish', emoji: '🥘' },
    { id: 'mediterranean', label: 'Mediterranean', emoji: '🫒' },
    { id: 'greek', label: 'Greek', emoji: '🧆' },
    { id: 'turkish', label: 'Turkish', emoji: '🥙' },
    { id: 'middle_eastern', label: 'Middle Eastern', emoji: '🫔' },
    { id: 'american', label: 'American', emoji: '🍔' },
    { id: 'british', label: 'British', emoji: '☕' },
    { id: 'german', label: 'German', emoji: '🥨' },
    { id: 'brazilian', label: 'Brazilian', emoji: '🥩' },
    { id: 'caribbean', label: 'Caribbean', emoji: '🍹' },
    { id: 'african', label: 'African', emoji: '🍠' },
    { id: 'kosher', label: 'Kosher', emoji: '✡️' },
    { id: 'vegan', label: 'Vegan', emoji: '🌱' },
    { id: 'fusion', label: 'Fusion', emoji: '🌏' },
  ];

  // Note: Mock recipes removed - now using AI-generated recipes from aiRecipes state

  // Handle ingredient chip selection
  const toggleIngredient = (ingredient) => {
    let updatedIngredients;

    if (selectedIngredients.includes(ingredient)) {
      // Remove ingredient
      updatedIngredients = selectedIngredients.filter((i) => i !== ingredient);
    } else {
      // Add ingredient
      updatedIngredients = [...selectedIngredients, ingredient];
    }

    setSelectedIngredients(updatedIngredients);

    // Update input field with selected ingredients
    if (updatedIngredients.length > 0) {
      setIngredientsInput(updatedIngredients.join(', '));
    } else {
      setIngredientsInput('');
    }
  };

  // Handle manual input change
  const handleInputChange = (text) => {
    setIngredientsInput(text);
    setValidationError(null); // Clear error when user types

    // Parse input to update selected chips
    const inputIngredients = text
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    // Update selected chips based on input
    const newSelectedIngredients = quickIngredients.filter((ingredient) =>
      inputIngredients.some(
        (inputItem) => inputItem.toLowerCase() === ingredient.toLowerCase()
      )
    );

    setSelectedIngredients(newSelectedIngredients);
  };

  // NEW: Handle image upload for ingredient recognition
  const handleImageUpload = async () => {
    // Clear any previous errors
    setValidationError(null);

    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload ingredient images.');
      return;
    }

    // Show action sheet for iOS, Alert for Android
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            await launchCamera();
          } else if (buttonIndex === 2) {
            await launchImagePicker();
          }
        }
      );
    } else {
      // Android: Show alert with options
      Alert.alert(
        'Add Ingredient Photo',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => launchCamera() },
          { text: 'Choose from Library', onPress: () => launchImagePicker() },
        ]
      );
    }
  };

  // Launch camera
  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access to take photos of ingredients.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await recognizeIngredients(result.assets[0].uri);
    }
  };

  // Launch image picker
  const launchImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await recognizeIngredients(result.assets[0].uri);
    }
  };

  // Recognize ingredients from image
  const recognizeIngredients = async (imageUri) => {
    setImageRecognizing(true);
    setValidationError(null);

    try {
      console.log('[AIInspirationScreen] Recognizing ingredients from image:', imageUri);

      // Call AI service to recognize ingredients
      const recognizedIngredients = await recognizeIngredientsFromImage(imageUri);

      // Populate input field with recognized ingredients
      const ingredientsText = recognizedIngredients.join(', ');
      setIngredientsInput(ingredientsText);

      // Update selected chips
      const newSelectedIngredients = quickIngredients.filter((ingredient) =>
        recognizedIngredients.some(
          (recognized) => recognized.toLowerCase() === ingredient.toLowerCase()
        )
      );
      setSelectedIngredients(newSelectedIngredients);

      console.log('[AIInspirationScreen] Successfully recognized ingredients:', recognizedIngredients);

    } catch (error) {
      console.error('[AIInspirationScreen] Image recognition error:', error);
      setValidationError(error.message);
    } finally {
      setImageRecognizing(false);
    }
  };

  // Handle cuisine selection
  const toggleCuisine = (cuisineId) => {
    if (selectedCuisines.includes(cuisineId)) {
      setSelectedCuisines(selectedCuisines.filter((c) => c !== cuisineId));
    } else {
      setSelectedCuisines([...selectedCuisines, cuisineId]);
    }
  };

  // Handle green arrow click (Step 1 -> Step 2)
  const handleSubmitIngredients = () => {
    // Use the input field text directly
    const inputText = ingredientsInput.trim();

    if (!inputText) {
      alert('Please enter or select at least one ingredient');
      return;
    }

    // Show cuisine modal with fade-in animation
    setShowCuisineModal(true);
    Animated.timing(modalFadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Handle Generate Ideas button (Step 2 -> Step 3) - AI Integration
  const handleGenerateIdeas = async () => {
    if (selectedCuisines.length === 0) {
      Alert.alert('Missing Selection', 'Please select at least one cuisine');
      return;
    }

    // Close modal with fade-out animation
    Animated.timing(modalFadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setShowCuisineModal(false);
    });

    // NOW add the ingredients message (after user confirms)
    const ingredientsMessage = {
      id: chatMessages.length + 1,
      sender: 'user',
      text: ingredientsInput.trim(),
    };

    const ingredientsAiResponse = {
      id: chatMessages.length + 2,
      sender: 'ai',
      text: 'Got it! What cuisine would you like to make?',
    };

    // Get cuisine labels
    const cuisineLabels = selectedCuisines
      .map((id) => cuisineOptions.find((c) => c.id === id)?.label)
      .filter(Boolean)
      .join(', ');

    // Add cuisine selection message
    const cuisineMessage = {
      id: chatMessages.length + 3,
      sender: 'user',
      text: cuisineLabels,
    };

    // Add AI loading message
    const aiLoadingMessage = {
      id: chatMessages.length + 4,
      sender: 'ai',
      text: 'Great choice! Let me create 3 unique recipe ideas for you... 🧑‍🍳✨',
    };

    // Add all messages at once: ingredients + AI response + cuisine + AI loading
    setChatMessages([
      ...chatMessages,
      ingredientsMessage,
      ingredientsAiResponse,
      cuisineMessage,
      aiLoadingMessage
    ]);
    setCurrentStep(3);
    setGeneratingRecipes(true);

    // Initialize progress tracking
    setGenerationProgress({
      currentStep: 1,
      totalSteps: 4,
      stepName: 'Analyzing ingredients...',
      imagesCompleted: 0,
      totalImages: 3,
    });

    try {
      // Parse ingredients from input
      const ingredientsList = ingredientsInput
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      // Step 2: Generating recipes
      setGenerationProgress(prev => ({
        ...prev,
        currentStep: 2,
        stepName: 'Creating recipe ideas...',
      }));

      // Call AI service to generate recipes
      const recipes = await generateRecipeIdeas(ingredientsList, cuisineLabels.split(', '));

      // Add unique IDs to recipes for React keys
      const recipesWithIds = recipes.map((recipe, idx) => ({
        ...recipe,
        id: `ai-recipe-${Date.now()}-${idx}`,
        image: null,
        imageStatus: 'generating', // Track image generation status: 'generating' | 'success' | 'failed'
      }));

      setAiRecipes(recipesWithIds);

      // Step 3: Preparing images
      setGenerationProgress(prev => ({
        ...prev,
        currentStep: 3,
        stepName: 'Preparing recipe images...',
      }));

      // Note: We don't update messages during image generation to avoid clutter
      // The loading indicator in Step 3 will show the progress

      // Generate images for all 3 recipes in parallel with staggered start
      const imagePromises = recipesWithIds.map(async (recipe, idx) => {
        // Stagger requests by 500ms each to reduce server load
        await new Promise(resolve => setTimeout(resolve, idx * 500));

        try {
          // Step 4: Generating individual images
          setGenerationProgress(prev => ({
            ...prev,
            currentStep: 4,
            stepName: `Generating image ${idx + 1} of 3...`,
            imagesCompleted: idx,
          }));

          const imageUrl = await generateRecipeImage(recipe.title, recipe.description);

          // Update progress for completed image
          setGenerationProgress(prev => ({
            ...prev,
            imagesCompleted: idx + 1,
          }));

          return { ...recipe, image: imageUrl, imageStatus: 'success' };
        } catch (error) {
          console.error(`[AIInspirationScreen] Image generation failed for ${recipe.title}:`, error);

          // Update progress even for failed images
          setGenerationProgress(prev => ({
            ...prev,
            imagesCompleted: idx + 1,
          }));

          return { ...recipe, image: null, imageStatus: 'failed' }; // Mark as failed
        }
      });

      const recipesWithImages = await Promise.all(imagePromises);
      setAiRecipes(recipesWithImages);

      // Update final AI message to success
      const aiSuccessMessage = {
        id: chatMessages.length + 5, // After ingredients, AI response, cuisine, loading message
        sender: 'ai',
        text: 'Here are 3 delicious recipe ideas for you! Try cooking them and create your own version. 🎉',
      };

      setChatMessages(prev => [...prev, aiSuccessMessage]);
      setGeneratingRecipes(false);
    } catch (error) {
      console.error('[AIInspirationScreen] Recipe generation error:', error);
      setGeneratingRecipes(false);

      // Show user-friendly error message in chat
      const aiErrorMessage = {
        id: chatMessages.length + 5, // After ingredients, AI response, cuisine, loading message
        sender: 'ai',
        text: `Oops! ${error.message} Please try again.`,
      };

      setChatMessages(prev => [...prev, aiErrorMessage]);
      // Note: Error is already shown in chat, no need for popup alert
    }
  };

  // Toggle recipe card expansion
  const toggleCardExpansion = (recipeId) => {
    if (expandedCards.includes(recipeId)) {
      setExpandedCards(expandedCards.filter((id) => id !== recipeId));
    } else {
      setExpandedCards([...expandedCards, recipeId]);
    }
  };


  // Handle Chef iQ equipment badge click - show purchase modal
  const handleChefIQBadgeClick = (equipmentName) => {
    const equipment = CHEF_IQ_EQUIPMENT[equipmentName];
    if (equipment) {
      setSelectedChefIQEquipment(equipment);
      setShowPurchaseModal(true);
    }
  };

  // Open purchase link in browser
  const handleShopNow = async () => {
    if (selectedChefIQEquipment && selectedChefIQEquipment.url) {
      try {
        const supported = await Linking.canOpenURL(selectedChefIQEquipment.url);
        if (supported) {
          await Linking.openURL(selectedChefIQEquipment.url);
          console.log('[AIInspirationScreen] Opened purchase link:', selectedChefIQEquipment.url);
        } else {
          Alert.alert('Error', 'Cannot open this URL');
        }
      } catch (error) {
        console.error('[AIInspirationScreen] Error opening URL:', error);
        Alert.alert('Error', 'Failed to open purchase link');
      }
    }
    setShowPurchaseModal(false);
  };

  // Retry image generation for a specific recipe
  const retryImageGeneration = async (recipeId) => {
    const recipe = aiRecipes.find(r => r.id === recipeId);
    if (!recipe) return;

    setRetryingImageId(recipeId);

    try {
      console.log(`[AIInspirationScreen] Retrying image generation for: ${recipe.title}`);

      // Update recipe status to generating
      setAiRecipes(prevRecipes =>
        prevRecipes.map(r =>
          r.id === recipeId ? { ...r, imageStatus: 'generating' } : r
        )
      );

      // Retry image generation with 3 attempts
      const imageUrl = await generateRecipeImage(recipe.title, recipe.description);

      // Update recipe with new image
      setAiRecipes(prevRecipes =>
        prevRecipes.map(r =>
          r.id === recipeId ? { ...r, image: imageUrl, imageStatus: 'success' } : r
        )
      );

      console.log(`[AIInspirationScreen] Image retry successful for: ${recipe.title}`);
    } catch (error) {
      console.error(`[AIInspirationScreen] Image retry failed for ${recipe.title}:`, error);

      // Mark as failed again - user can see the failed state in the card
      setAiRecipes(prevRecipes =>
        prevRecipes.map(r =>
          r.id === recipeId ? { ...r, imageStatus: 'failed' } : r
        )
      );

      // Note: Error is visible in the recipe card UI, no popup needed
    } finally {
      setRetryingImageId(null);
    }
  };

  // Reset conversation - start new chat
  const resetConversation = () => {
    setCurrentStep(1);
    setIngredientsInput('');
    setSelectedIngredients([]);
    setSelectedCuisines([]);
    setExpandedCards([]);
    setAiRecipes([]); // Clear AI-generated recipes
    setGeneratingRecipes(false);
    setRetryingImageId(null);
    setImageRecognizing(false); // Clear image recognition state
    setValidationError(null); // Clear validation errors
    setChatMessages([
      {
        id: 1,
        sender: 'ai',
        text: "Hi! I am CHEF iQ 🧑‍🍳 Tell me what ingredients you have!",
      },
    ]);
  };

  // Render Step 1: Initial Input
  const renderStep1 = () => (
    <KeyboardAvoidingView
      style={styles.step1Container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.step1Header}>
        <Text variant="headlineSmall" style={styles.step1HeaderTitle}>
          CHEF iQ
        </Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.step1ScrollView}
        contentContainerStyle={styles.step1ScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* AI Greeting */}
        <View style={styles.greetingSection}>
          <View style={styles.chefIconContainer}>
            <MaterialCommunityIcons name="chef-hat" size={32} color="#FFFFFF" />
          </View>
          <View style={styles.speechBubble}>
            <Text style={styles.speechBubbleText}>
              Hi! I am <Text style={{ color: colors.primary, fontWeight: 'bold' }}>CHEF iQ</Text> 🧑‍🍳 Tell me what ingredients you have!
            </Text>
          </View>
        </View>

        {/* Quick Select Section */}
        <View style={styles.quickSelectSection}>
          <Text style={styles.quickSelectLabel}>Quick select:</Text>
          <View style={styles.ingredientChipsContainer}>
            {quickIngredients.map((ingredient) => (
              <TouchableOpacity
                key={ingredient}
                style={[
                  styles.ingredientChip,
                  selectedIngredients.includes(ingredient) && styles.ingredientChipSelected,
                ]}
                onPress={() => toggleIngredient(ingredient)}
              >
                <Text
                  style={[
                    styles.ingredientChipText,
                    selectedIngredients.includes(ingredient) && styles.ingredientChipTextSelected,
                  ]}
                >
                  {ingredient}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Input Field - Fixed at Bottom with KeyboardAvoidingView */}
      <View
        style={[
          styles.inputContainerWrapper,
          isKeyboardVisible && styles.inputContainerWrapperKeyboardVisible,
        ]}
      >
        {/* Error Message Display */}
        {validationError && (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={16} color="#E53935" />
            <Text style={styles.errorText}>{validationError}</Text>
          </View>
        )}

        {/* Input Container with Camera Button */}
        <View style={styles.inputContainer}>
          {/* Camera Button */}
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={handleImageUpload}
            disabled={imageRecognizing || generatingRecipes}
          >
            {imageRecognizing ? (
              <ActivityIndicator size="small" color="#00D084" />
            ) : (
              <MaterialCommunityIcons name="camera" size={24} color="#00D084" />
            )}
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            style={styles.textInput}
            placeholder={imageRecognizing ? "Recognizing ingredients..." : "e.g. chicken breast, broccoli, garlic"}
            placeholderTextColor={colors.textSecondary}
            value={ingredientsInput}
            onChangeText={handleInputChange}
            editable={!imageRecognizing && !generatingRecipes}
            clearButtonMode="while-editing"
            autoCapitalize="none"
          />

          {/* Submit Arrow Button */}
          <TouchableOpacity
            style={styles.arrowButton}
            onPress={handleSubmitIngredients}
            disabled={imageRecognizing || generatingRecipes}
          >
            <MaterialCommunityIcons name="arrow-right" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  // Render Step 3: Chat and Recipe Cards
  const renderStep3 = () => (
    <View style={styles.step3Container}>
      {/* Header with New Conversation Button */}
      <View style={styles.chatHeader}>
        <Text variant="headlineSmall" style={styles.chatHeaderTitle}>
          CHEF iQ
        </Text>
        <TouchableOpacity style={styles.newChatButton} onPress={resetConversation}>
          <MaterialCommunityIcons name="refresh" size={20} color="#00D084" />
          <Text style={styles.newChatButtonText}>New Chat</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.chatContainer} contentContainerStyle={styles.chatContent}>
        {/* Chat Messages */}
        {chatMessages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageContainer,
              message.sender === 'ai' ? styles.aiMessageContainer : styles.userMessageContainer,
            ]}
          >
            {message.sender === 'ai' && (
              <View style={styles.chefIconSmall}>
                <MaterialCommunityIcons name="chef-hat" size={20} color="#FFFFFF" />
              </View>
            )}
            <View
              style={[
                styles.messageBubble,
                message.sender === 'ai' ? styles.aiMessageBubble : styles.userMessageBubble,
              ]}
            >
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          </View>
        ))}

      {/* Loading Indicator with Progress */}
      {generatingRecipes && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D084" />

          {/* Progress Steps */}
          <Text style={styles.loadingText}>{generationProgress.stepName}</Text>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${(generationProgress.currentStep / generationProgress.totalSteps) * 100}%` }
              ]}
            />
          </View>

          {/* Step Indicators */}
          <View style={styles.stepsContainer}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                generationProgress.currentStep >= 1 && styles.stepDotActive
              ]}>
                {generationProgress.currentStep === 1 ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : generationProgress.currentStep > 1 ? (
                  <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
                ) : null}
              </View>
              <Text style={styles.stepLabel}>Analyze</Text>
            </View>

            <View style={styles.stepDivider} />

            <View style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                generationProgress.currentStep >= 2 && styles.stepDotActive
              ]}>
                {generationProgress.currentStep === 2 ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : generationProgress.currentStep > 2 ? (
                  <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
                ) : null}
              </View>
              <Text style={styles.stepLabel}>Create</Text>
            </View>

            <View style={styles.stepDivider} />

            <View style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                generationProgress.currentStep >= 3 && styles.stepDotActive
              ]}>
                {generationProgress.currentStep === 3 ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : generationProgress.currentStep > 3 ? (
                  <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
                ) : null}
              </View>
              <Text style={styles.stepLabel}>Prepare</Text>
            </View>

            <View style={styles.stepDivider} />

            <View style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                generationProgress.currentStep >= 4 && styles.stepDotActive
              ]}>
                {generationProgress.currentStep === 4 ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : generationProgress.currentStep > 4 ? (
                  <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
                ) : null}
              </View>
              <Text style={styles.stepLabel}>Images</Text>
            </View>
          </View>
        </View>
      )}

      {/* Recipe Cards */}
      {currentStep === 3 && !generatingRecipes && aiRecipes.length > 0 && (
        <View style={styles.recipeCardsContainer}>
          {aiRecipes.map((recipe) => {
            const isExpanded = expandedCards.includes(recipe.id);
            const chefIQDevice = recipe.chefIQRequired && recipe.equipment && recipe.equipment.length > 0
              ? recipe.equipment[0]
              : null;

            return (
              <View key={recipe.id} style={styles.recipeCard}>
                {/* Recipe Image with status-based rendering */}
                {recipe.imageStatus === 'success' && recipe.image ? (
                  <Image
                    source={{ uri: recipe.image }}
                    style={styles.recipeImage}
                  />
                ) : recipe.imageStatus === 'generating' ? (
                  <View style={styles.recipeImagePlaceholder}>
                    <ActivityIndicator size="large" color="#00D084" />
                    <Text style={styles.placeholderText}>
                      {retryingImageId === recipe.id ? 'Retrying image generation...' : 'Generating image...'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.recipeImagePlaceholderFailed}>
                    <MaterialCommunityIcons name="image-off-outline" size={48} color="#CCCCCC" />
                    <Text style={styles.placeholderTextFailed}>Image unavailable</Text>
                    <Text style={styles.placeholderSubtext}>Recipe details below</Text>
                    <TouchableOpacity
                      style={styles.retryImageButton}
                      onPress={() => retryImageGeneration(recipe.id)}
                      disabled={retryingImageId === recipe.id}
                    >
                      <MaterialCommunityIcons name="refresh" size={18} color="#00D084" />
                      <Text style={styles.retryImageButtonText}>Retry Image</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Recipe Content */}
                <View style={styles.recipeContent}>
                  <Text style={styles.recipeTitle}>{recipe.title}</Text>

                  <View style={styles.cuisineTag}>
                    <Text style={styles.cuisineTagText}>{recipe.cuisine}</Text>
                  </View>

                  {/* Chef iQ Badge - New line below cuisine */}
                  {chefIQDevice && CHEF_IQ_EQUIPMENT[chefIQDevice] && (
                    <View style={{ marginTop: 8, marginBottom: 8 }}>
                      <ProductBadge
                        equipment={CHEF_IQ_EQUIPMENT[chefIQDevice]}
                        size="small"
                        showLabel={true}
                        onPress={() => handleChefIQBadgeClick(chefIQDevice)}
                      />
                    </View>
                  )}

                  <Text style={styles.recipeDescription} numberOfLines={2}>
                    {recipe.description}
                  </Text>

                  {/* Difficulty and Time */}
                  <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                    <Text style={styles.recipeMetaText}>⏱️ {recipe.cookingTime} min</Text>
                    <Text style={[styles.recipeMetaText, { marginLeft: 16 }]}>
                      📊 {recipe.difficulty}
                    </Text>
                  </View>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {/* Chef iQ Purchase Link (if applicable) */}
                      {chefIQDevice && CHEF_IQ_EQUIPMENT[chefIQDevice] && (
                        <View style={styles.chefIQPurchaseSection}>
                          <View style={styles.chefIQPurchaseHeader}>
                            <ProductBadge
                              equipment={CHEF_IQ_EQUIPMENT[chefIQDevice]}
                              size="medium"
                              showLabel={false}
                            />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.chefIQPurchaseTitle}>
                                This recipe uses {CHEF_IQ_EQUIPMENT[chefIQDevice].name}
                              </Text>
                              <Text style={styles.chefIQPurchaseDescription}>
                                {CHEF_IQ_EQUIPMENT[chefIQDevice].description}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={styles.chefIQShopButton}
                            onPress={() => handleChefIQBadgeClick(chefIQDevice)}
                          >
                            <MaterialCommunityIcons name="cart" size={18} color="#FF8C42" style={{ marginRight: 6 }} />
                            <Text style={styles.chefIQShopButtonText}>Shop Now →</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Ingredients */}
                      <View style={styles.ingredientsSection}>
                        <Text style={styles.sectionTitle}>🥘 Ingredients needed:</Text>
                        {recipe.ingredients.map((ing, index) => (
                          <Text key={index} style={styles.listItem}>
                            • {ing.name}{ing.amount ? `, ${ing.amount}` : ''}
                          </Text>
                        ))}
                      </View>

                      {/* Steps */}
                      <View style={styles.stepsSection}>
                        <Text style={styles.sectionTitle}>👨‍🍳 Cooking steps:</Text>
                        {recipe.steps.map((step, index) => (
                          <Text key={index} style={styles.listItem}>
                            {step.number}. {step.description}
                          </Text>
                        ))}
                      </View>

                      {/* Equipment */}
                      {recipe.equipment && recipe.equipment.length > 0 && (
                        <View style={styles.equipmentSection}>
                          <Text style={styles.sectionTitle}>🔧 Equipment needed:</Text>
                          {recipe.equipment.map((item, index) => (
                            <Text key={index} style={styles.listItem}>
                              • {item}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Toggle Details Button */}
                  <TouchableOpacity
                    style={styles.viewRecipeButton}
                    onPress={() => toggleCardExpansion(recipe.id)}
                  >
                    <Text style={styles.viewRecipeButtonText}>
                      {isExpanded ? 'Hide Details ∧' : 'View Recipe →'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
      </ScrollView>
    </View>
  );

  // Render Cuisine Selection Modal
  const renderCuisineModal = () => {
    return (
      <Modal
        visible={showCuisineModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowCuisineModal(false)}
      >
        <Animated.View
          style={[
            styles.modalOverlay,
            {
              opacity: modalFadeAnim,
            }
          ]}
        >
          {/* Dimmed background */}
          <TouchableOpacity
            style={styles.modalDimmedBackground}
            activeOpacity={1}
            onPress={() => {
              Animated.timing(modalFadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
              }).start(() => setShowCuisineModal(false));
            }}
          />

          {/* Center Popup Window */}
          <Animated.View
            style={[
              styles.popupWindow,
              {
                opacity: modalFadeAnim,
                transform: [
                  {
                    scale: modalFadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                Animated.timing(modalFadeAnim, {
                  toValue: 0,
                  duration: 150,
                  useNativeDriver: true,
                }).start(() => setShowCuisineModal(false));
              }}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Title */}
            <Text style={styles.modalTitle}>Select Cuisine</Text>

            {/* Cuisine Options */}
            <ScrollView style={styles.cuisineList}>
              {cuisineOptions.map((cuisine) => (
                <TouchableOpacity
                  key={cuisine.id}
                  style={[
                    styles.cuisineOption,
                    selectedCuisines.includes(cuisine.id) && styles.cuisineOptionSelected,
                  ]}
                  onPress={() => toggleCuisine(cuisine.id)}
                >
                  <View style={styles.checkbox}>
                    {selectedCuisines.includes(cuisine.id) && (
                      <MaterialCommunityIcons name="check" size={20} color="#00D084" />
                    )}
                  </View>
                  <Text style={styles.cuisineEmoji}>{cuisine.emoji}</Text>
                  <Text style={styles.cuisineLabel}>{cuisine.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Generate Button */}
            <TouchableOpacity style={styles.generateButton} onPress={handleGenerateIdeas}>
              <Text style={styles.generateButtonText}>Generate Ideas</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  };

  // Render Chef iQ Purchase Modal
  const renderPurchaseModal = () => {
    if (!selectedChefIQEquipment) return null;

    return (
      <Modal
        visible={showPurchaseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPurchaseModal(false)}
      >
        <View style={styles.purchaseModalOverlay}>
          <View style={styles.purchaseModalContent}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.purchaseModalClose}
              onPress={() => setShowPurchaseModal(false)}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Product Image */}
            <ProductBadge
              equipment={selectedChefIQEquipment}
              size="large"
              showLabel={false}
            />

            {/* Equipment Name */}
            <Text style={styles.purchaseModalTitle}>{selectedChefIQEquipment.name}</Text>

            {/* Description */}
            <Text style={styles.purchaseModalDescription}>{selectedChefIQEquipment.description}</Text>

            {/* Features List */}
            {selectedChefIQEquipment.features && selectedChefIQEquipment.features.length > 0 && (
              <View style={styles.featuresList}>
                {selectedChefIQEquipment.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureItem}>
                    <Text style={styles.featureBullet}>•</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Info Text */}
            <Text style={styles.purchaseModalInfo}>
              This recipe uses Chef iQ smart cooking equipment for optimal results and guided cooking.
            </Text>

            {/* Buttons */}
            <TouchableOpacity style={styles.shopNowButton} onPress={handleShopNow}>
              <MaterialCommunityIcons name="cart" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.shopNowButtonText}>Shop Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowPurchaseModal(false)}
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {currentStep === 1 ? renderStep1() : renderStep3()}
      {renderCuisineModal()}
      {renderPurchaseModal()}
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Step 1 Styles
  step1Container: {
    flex: 1,
  },
  step1Header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  step1HeaderTitle: {
    color: '#00D084',
    fontWeight: 'bold',
  },
  step1ScrollView: {
    flex: 1,
  },
  step1ScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  greetingSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  chefIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00D084',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  speechBubble: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  speechBubbleText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  quickSelectSection: {
    marginBottom: 20,
  },
  quickSelectLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  ingredientChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4, // Compensate for chip margins
  },
  ingredientChip: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  ingredientChipSelected: {
    backgroundColor: colors.primaryLight,
  },
  ingredientChipText: {
    fontSize: 15,
    color: colors.text,
  },
  ingredientChipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  inputContainerWrapper: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // Account for tab bar when keyboard is hidden
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputContainerWrapperKeyboardVisible: {
    paddingBottom: 20, // Smaller padding when keyboard is visible
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingLeft: 4,
    paddingRight: 4,
    paddingVertical: 4,
  },
  cameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00D084',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#E53935',
    marginLeft: 8,
    flex: 1,
  },

  // Step 3: Chat Styles
  step3Container: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chatHeaderTitle: {
    color: '#00D084',
    fontWeight: 'bold',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  newChatButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100, // Extra space for bottom tab bar
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  chefIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00D084',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
  },
  aiMessageBubble: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  userMessageBubble: {
    backgroundColor: colors.primaryLight,
  },
  messageText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },

  // Recipe Cards
  recipeCardsContainer: {
    marginTop: 16,
  },
  recipeCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  recipeContent: {
    padding: 16,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  cuisineTag: {
    backgroundColor: '#FF8C42',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  cuisineTagText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  recipeDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 12,
  },
  expandedContent: {
    marginTop: 16,
  },
  ingredientsSection: {
    marginBottom: 12,
  },
  stepsSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  listItem: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
    marginLeft: 8,
  },
  viewRecipeButton: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignSelf: 'center',
    marginTop: 12,
  },
  viewRecipeButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalDimmedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  popupWindow: {
    backgroundColor: colors.card,
    borderRadius: 20,
    width: '85%',
    maxWidth: 400,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
    paddingHorizontal: 40, // Space for close button
  },
  cuisineList: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  cuisineOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    minHeight: 48,
  },
  cuisineOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#00D084',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cuisineEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  cuisineLabel: {
    fontSize: 18,
    color: colors.text,
  },
  generateButton: {
    backgroundColor: '#00D084',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#00D084',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Loading Styles
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Progress Bar Styles
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
    marginTop: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00D084',
    borderRadius: 3,
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepDotActive: {
    backgroundColor: '#00D084',
    borderColor: '#00D084',
  },
  stepLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  stepDivider: {
    width: 20,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
    marginBottom: 20,
  },
  imageProgressText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Recipe Card Updates
  recipeImagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeImagePlaceholderFailed: {
    width: '100%',
    height: 200,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999999',
  },
  placeholderTextFailed: {
    marginTop: 8,
    fontSize: 15,
    color: '#999999',
    fontWeight: '500',
  },
  placeholderSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#BBBBBB',
  },
  retryImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  retryImageButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  recipeMetaText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  equipmentSection: {
    marginBottom: 12,
  },

  // Chef iQ Purchase Section (in expanded content)
  chefIQPurchaseSection: {
    backgroundColor: colors.highlightLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.highlight,
  },
  chefIQPurchaseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  chefIQPurchaseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  chefIQPurchaseDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  chefIQShopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.highlightMedium,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  chefIQShopButtonText: {
    color: colors.highlight,
    fontSize: 15,
    fontWeight: 'bold',
  },

  // Use Recipe Button
  useRecipeButton: {
    flexDirection: 'row',
    backgroundColor: '#00D084',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D084',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  useRecipeButtonLoading: {
    backgroundColor: '#CCCCCC',
  },
  useRecipeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Purchase Modal
  purchaseModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',  // Always use overlay for both modes
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  purchaseModalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: colors.background === '#FFFDF8' ? 0 : 2,  // No border in light mode, border in dark mode
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  purchaseModalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  featuresList: {
    width: '100%',
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  featureBullet: {
    fontSize: 16,
    color: '#00D084',
    marginRight: 8,
    marginTop: 2,
  },
  featureText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  purchaseModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  purchaseModalDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  purchaseModalInfo: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  shopNowButton: {
    flexDirection: 'row',
    backgroundColor: '#00D084',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    width: '100%',
    shadowColor: '#00D084',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shopNowButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});

export default AIInspirationScreen;
