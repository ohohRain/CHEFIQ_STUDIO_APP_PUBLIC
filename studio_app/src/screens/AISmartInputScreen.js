import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { parseRecipeText, parseRecipeImage } from '../services/aiService';
import { isConfigured } from '../config/openai';
import { useTheme } from '../contexts/ThemeContext';

const AISmartInputScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('text'); // 'text' or 'image'
  const [recipeText, setRecipeText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Animation values for swipe gesture
  const translateX = useRef(new Animated.Value(0)).current;
  const gestureStartX = useRef(0);

  const placeholderText = `Paste or type your recipe here...

For example:
Ingredients: Chicken breast 200g, broccoli 150g, garlic 3 cloves...

Steps:
1. Dice and marinate chicken
2. Stir-fry with high heat...`;

  const handleParseRecipe = async () => {
    if (!recipeText.trim()) return;

    // Check if OpenAI API key is configured
    if (!isConfigured()) {
      Alert.alert(
        'API Key Required',
        'OpenAI API key is not configured. Please set EXPO_PUBLIC_OPENAI_API_KEY in your .env file.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    console.log('[AISmartInput] Parsing recipe text:', recipeText.substring(0, 100) + '...');

    try {
      // Call AI service to parse recipe text
      const parsedData = await parseRecipeText(recipeText);
      console.log('[AISmartInput] Recipe parsed successfully:', parsedData);

      // Navigate to Recipe Form with parsed data
      navigation.navigate('RecipeForm', {
        mode: 'ai-parsed',
        parsedData: parsedData
      });
    } catch (error) {
      console.error('[AISmartInput] Parsing error:', error);

      Alert.alert(
        'Parsing Failed',
        error.message || 'Unable to parse recipe. Please try again or use manual entry.',
        [
          { text: 'Try Again', style: 'default' },
          {
            text: 'Manual Entry',
            onPress: () => navigation.navigate('RecipeForm', { mode: 'create' }),
            style: 'cancel'
          }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async () => {
    // Request permission first
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to upload recipe images.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Show action sheet: Camera or Gallery
    Alert.alert(
      'Upload Recipe Image',
      'Choose image source',
      [
        {
          text: 'Take Photo',
          onPress: handleTakePhoto,
        },
        {
          text: 'Choose from Gallery',
          onPress: handlePickImage,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        'Permission Required',
        'Please allow camera access to take photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
      console.log('Photo taken:', result.assets[0].uri);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
      console.log('Image selected:', result.assets[0].uri);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
  };

  const handleParseImage = async () => {
    if (!selectedImage) return;

    // Check if OpenAI API key is configured
    if (!isConfigured()) {
      Alert.alert(
        'API Key Required',
        'OpenAI API key is not configured. Please set EXPO_PUBLIC_OPENAI_API_KEY in your .env file.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    console.log('[AISmartInput] Parsing recipe image:', selectedImage);

    try {
      // Call AI service to parse recipe image (Phase 15 - not yet implemented)
      const parsedData = await parseRecipeImage(selectedImage);
      console.log('[AISmartInput] Recipe image parsed successfully:', parsedData);

      // Navigate to Recipe Form with parsed data
      navigation.navigate('RecipeForm', {
        mode: 'ai-parsed',
        parsedData: parsedData
      });
    } catch (error) {
      console.error('[AISmartInput] Image parsing error:', error);

      // Check if it's the "not implemented" error
      if (error.message.includes('not yet implemented')) {
        Alert.alert(
          'Coming Soon!',
          'Image parsing with OCR will be available in Phase 15. For now, please use text input or manual entry.',
          [
            { text: 'Use Text Input', onPress: () => setActiveTab('text'), style: 'default' },
            {
              text: 'Manual Entry',
              onPress: () => navigation.navigate('RecipeForm', { mode: 'create' }),
              style: 'cancel'
            }
          ]
        );
      } else {
        Alert.alert(
          'Parsing Failed',
          error.message || 'Unable to parse recipe image. Please try again or use text input.',
          [
            { text: 'Try Again', style: 'default' },
            {
              text: 'Use Text Input',
              onPress: () => setActiveTab('text'),
              style: 'cancel'
            }
          ]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle swipe gesture
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event) => {
    const { state, translationX, velocityX } = event.nativeEvent;

    // Gesture ended
    if (state === 5) { // State.END
      const swipeThreshold = 50; // Minimum swipe distance
      const velocityThreshold = 500; // Minimum swipe velocity

      // Determine if swipe was significant enough
      const shouldSwitch =
        Math.abs(translationX) > swipeThreshold ||
        Math.abs(velocityX) > velocityThreshold;

      if (shouldSwitch) {
        // Swipe left -> Image Upload tab
        if (translationX < -swipeThreshold && activeTab === 'text') {
          switchToTab('image');
        }
        // Swipe right -> Text Description tab
        else if (translationX > swipeThreshold && activeTab === 'image') {
          switchToTab('text');
        }
      }

      // Reset animation
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }).start();
    }
  };

  const switchToTab = (tab) => {
    setActiveTab(tab);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Smart Input</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('text')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'text' && styles.tabTextActive,
            ]}
          >
            Text Description
          </Text>
          {activeTab === 'text' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('image')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'image' && styles.tabTextActive,
            ]}
          >
            Image Upload
          </Text>
          {activeTab === 'image' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Content with Swipe Gesture */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-10, 10]}
        failOffsetY={[-20, 20]}
      >
        <Animated.View
          style={[
            styles.gestureContainer,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            scrollEnabled={true}
          >
            {activeTab === 'text' ? (
              // Text Description Tab
              <>
                <TextInput
                  style={styles.textInput}
                  multiline
                  placeholder={placeholderText}
                  placeholderTextColor={colors.textLight}
                  value={recipeText}
                  onChangeText={setRecipeText}
                  textAlignVertical="top"
                  clearButtonMode="while-editing"
                />

                <View style={styles.helperTip}>
                  <Text style={styles.helperIcon}>💡</Text>
                  <Text style={styles.helperText}>
                    AI will automatically identify ingredients and steps from your text
                  </Text>
                </View>
              </>
            ) : (
              // Image Upload Tab
              <View style={styles.uploadContainer}>
                {selectedImage ? (
                  // Show uploaded image
                  <View style={styles.imagePreviewContainer}>
                    <Image
                      source={{ uri: selectedImage }}
                      style={styles.imagePreview}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={handleRemoveImage}
                    >
                      <MaterialCommunityIcons name="close-circle" size={32} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Show upload box
                  <TouchableOpacity
                    style={styles.uploadBox}
                    onPress={handleImageUpload}
                  >
                    <MaterialCommunityIcons
                      name="image-plus"
                      size={64}
                      color="#00D084"
                    />
                    <Text style={styles.uploadTitle}>Upload Recipe Image</Text>
                    <Text style={styles.uploadSubtitle}>
                      Take a photo or choose from gallery
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={styles.helperTip}>
                  <Text style={styles.helperIcon}>💡</Text>
                  <Text style={styles.helperText}>
                    AI will use OCR to extract recipe content from your image
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </PanGestureHandler>

      {/* Parse Button (Fixed at bottom) */}
      <View
        style={[
          styles.buttonContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.parseButton,
            ((activeTab === 'text' && !recipeText.trim()) ||
             (activeTab === 'image' && !selectedImage)) && styles.parseButtonDisabled,
          ]}
          onPress={activeTab === 'text' ? handleParseRecipe : handleParseImage}
          disabled={
            ((activeTab === 'text' && !recipeText.trim()) ||
             (activeTab === 'image' && !selectedImage)) ||
            isLoading
          }
        >
          {isLoading && (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
              style={styles.buttonSpinner}
            />
          )}
          <Text style={styles.parseButtonText}>
            {isLoading
              ? (activeTab === 'text' ? 'Analyzing Recipe...' : 'Reading Image...')
              : (activeTab === 'text' ? 'Parse Recipe' : 'Parse Image')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerRight: {
    width: 32,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  tabText: {
    fontSize: 16,
    color: colors.textLight,
  },
  tabTextActive: {
    fontWeight: 'bold',
    color: colors.text,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#00D084',
  },
  gestureContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
  },
  textInput: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: colors.text,
    minHeight: 400,
    lineHeight: 22,
  },
  helperTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  helperIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  helperText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  uploadContainer: {
    flex: 1,
  },
  uploadBox: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
    borderWidth: 2,
    borderColor: colors.primary,
    // Note: dashed borders not supported on iOS, using solid border
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  imagePreviewContainer: {
    position: 'relative',
    backgroundColor: colors.accent,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 400,
  },
  imagePreview: {
    width: '100%',
    height: 400,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.accent,
  },
  parseButton: {
    backgroundColor: '#00D084',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#00D084',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  parseButtonDisabled: {
    backgroundColor: colors.buttonDisabled,
    shadowOpacity: 0,
  },
  parseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonSpinner: {
    marginRight: 8,
  },
});

export default AISmartInputScreen;
