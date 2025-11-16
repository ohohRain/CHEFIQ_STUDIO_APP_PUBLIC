import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { IconButton, Checkbox } from 'react-native-paper';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';
import WheelPicker from '@quidone/react-native-wheel-picker';
import { useTheme } from '../contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const HEADER_HEIGHT = 60;
const BUTTON_HEIGHT = 80;

const GuidedCookingScreen = () => {
  // Keep screen awake while cooking
  useKeepAwake();

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { recipe } = route.params || {};

  console.log('🍳 [GuidedCooking] Screen mounted');
  console.log('🍳 [GuidedCooking] Recipe:', recipe?.title);
  console.log('🍳 [GuidedCooking] Instructions count:', recipe?.instructions?.length);
  console.log('🍳 [GuidedCooking] Ingredients count:', recipe?.ingredients?.length);

  // State
  const [showingPreparation, setShowingPreparation] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);

  // Timer states
  const [timerActive, setTimerActive] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(5);
  const [selectedSeconds, setSelectedSeconds] = useState(0);

  // Get data from recipe
  const ingredients = recipe?.ingredients || [];
  const steps = recipe?.instructions || [];
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex];

  // Safety check - if no steps, go back immediately
  useEffect(() => {
    if (totalSteps === 0) {
      console.error('🍳 [GuidedCooking] No steps found, returning to previous screen');
      navigation.goBack();
    }
  }, [totalSteps, navigation]);

  // Timer countdown effect
  useEffect(() => {
    if (timerActive && timerRemaining > 0) {
      const interval = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 1) {
            setTimerActive(false);
            Alert.alert('Timer Complete!', 'Your cooking timer has finished.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timerActive, timerRemaining]);

  // Timer handlers
  const handleTimerPress = (seconds) => {
    setTimerRemaining(seconds);
    setTimerActive(true);
    console.log('🍳 [GuidedCooking] Timer started:', Math.floor(seconds / 60), 'minutes', seconds % 60, 'seconds');
  };

  const handleStopTimer = () => {
    setTimerActive(false);
    setTimerRemaining(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Ingredient toggle handler
  const toggleIngredient = (index) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Ready to Cook handler
  const handleReadyToCook = () => {
    try {
      console.log('🍳 [GuidedCooking] Ready to Cook pressed');
      setShowingPreparation(false);
      setCurrentStepIndex(0);
    } catch (error) {
      console.error('🍳 [GuidedCooking] Error in handleReadyToCook:', error);
    }
  };

  // Navigation handlers
  const handlePrevious = () => {
    try {
      console.log('🍳 [GuidedCooking] Previous button pressed, current:', currentStepIndex);
      if (currentStepIndex > 0) {
        setCurrentStepIndex(currentStepIndex - 1);
      } else if (currentStepIndex === 0 && !showingPreparation) {
        setShowingPreparation(true);
      }
    } catch (error) {
      console.error('🍳 [GuidedCooking] Error in handlePrevious:', error);
    }
  };

  const handleNext = () => {
    try {
      console.log('🍳 [GuidedCooking] Next button pressed, current:', currentStepIndex);
      if (currentStepIndex < totalSteps - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      }
    } catch (error) {
      console.error('🍳 [GuidedCooking] Error in handleNext:', error);
    }
  };

  const handleDone = () => {
    try {
      console.log('🍳 [GuidedCooking] Done button pressed - showing completion screen');
      setShowCompletionScreen(true);
    } catch (error) {
      console.error('🍳 [GuidedCooking] Error in handleDone:', error);
    }
  };

  const handleExit = () => {
    try {
      console.log('🍳 [GuidedCooking] Exit button pressed');
      navigation.goBack();
    } catch (error) {
      console.error('🍳 [GuidedCooking] Error in handleExit:', error);
    }
  };

  // Confetti ref
  const confettiRef = useRef(null);

  // Handle completion screen effects
  useEffect(() => {
    if (showCompletionScreen) {
      confettiRef.current?.start();
      const timer = setTimeout(() => {
        console.log('🍳 [GuidedCooking] Auto-exit after 3 seconds');
        navigation.goBack();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showCompletionScreen, navigation]);

  // Render completion screen
  if (showCompletionScreen) {
    return (
      <View style={styles.completionContainer}>
        <ConfettiCannon
          ref={confettiRef}
          count={80}
          origin={{ x: SCREEN_WIDTH / 2, y: -10 }}
          autoStart={false}
          fadeOut={true}
          fallSpeed={3000}
          colors={['#FF8C42', '#00D084', '#FFD700', '#FF6B6B']}
        />

        <Text style={styles.congratsTitle}>Congratulations!</Text>
        <Text style={styles.congratsSubtitle}>You've Completed the Recipe!</Text>

        {recipe?.image && (
          <Image
            source={{ uri: recipe.image }}
            style={styles.recipePhoto}
            resizeMode="contain"
          />
        )}

        <Text style={styles.recipeName}>{recipe?.title || 'Recipe'}</Text>

        <TouchableOpacity
          style={styles.exitCompletionButton}
          onPress={() => {
            console.log('🍳 [GuidedCooking] Manual exit from completion screen');
            navigation.goBack();
          }}
        >
          <Text style={styles.exitCompletionButtonText}>Back to Recipe Details</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render preparation step
  if (showingPreparation) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={handleExit} style={styles.exitButton}>
            <IconButton icon="close" size={24} iconColor={colors.text} />
          </TouchableOpacity>
          <Text style={styles.stepCounter}>Preparation</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.preparationContainer}
          contentContainerStyle={styles.preparationContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.preparationTitle}>Check Your Ingredients</Text>
          <Text style={styles.preparationSubtitle}>
            Make sure you have everything ready before you start cooking
          </Text>

          <View style={styles.ingredientsList}>
            {ingredients.map((ingredient, index) => (
              <TouchableOpacity
                key={index}
                style={styles.ingredientItem}
                onPress={() => toggleIngredient(index)}
                activeOpacity={0.7}
              >
                <View style={styles.checkboxWrapper}>
                  <View style={styles.checkboxBorder} />
                  <Checkbox
                    status={checkedIngredients[index] ? 'checked' : 'unchecked'}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.ingredientTextContainer}>
                  <Text style={styles.ingredientName}>{ingredient.name}</Text>
                  <Text style={styles.ingredientAmount}>{ingredient.amount}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.navigationContainer, { paddingBottom: insets.bottom }]}>
          <TouchableOpacity
            onPress={handleReadyToCook}
            style={[styles.navButton, styles.readyButton]}
          >
            <Text style={[styles.navButtonText, styles.readyButtonText]}>Ready to Cook</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Parse step description for tips and warnings
  const parseStepContent = (description) => {
    if (!description) return { main: '', tips: [], warnings: [] };

    const lines = description.split('\n');
    const main = [];
    const tips = [];
    const warnings = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check for tip patterns
      if (trimmed.toLowerCase().startsWith('tip:') ||
          trimmed.toLowerCase().startsWith('💡') ||
          trimmed.toLowerCase().includes('pro tip')) {
        tips.push(trimmed.replace(/^(tip:|💡|pro tip:?)\s*/i, ''));
      }
      // Check for warning patterns
      else if (trimmed.toLowerCase().startsWith('warning:') ||
               trimmed.toLowerCase().startsWith('⚠️') ||
               trimmed.toLowerCase().startsWith('note:') ||
               trimmed.toLowerCase().startsWith('important:')) {
        warnings.push(trimmed.replace(/^(warning:|⚠️|note:|important:)\s*/i, ''));
      }
      // Regular instruction
      else {
        main.push(trimmed);
      }
    });

    return {
      main: main.join('\n'),
      tips,
      warnings
    };
  };

  const stepContent = parseStepContent(currentStep?.description);

  // Render cooking steps
  const hasStepImage = currentStep?.image !== undefined && currentStep?.image !== null;

  return (
    <View style={styles.container}>
      {/* Header with Safe Area */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleExit} style={styles.exitButton}>
          <IconButton icon="close" size={24} iconColor={colors.text} />
        </TouchableOpacity>
        <Text style={styles.stepCounter}>
          Step {currentStepIndex + 1}/{totalSteps}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Linear Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
                backgroundColor: colors.primary,
              }
            ]}
          />
        </View>
      </View>

      {/* Step Image (only show if image exists) */}
      {hasStepImage && (
        <Image
          source={{ uri: currentStep.image }}
          style={styles.stepImage}
          resizeMode="contain"
        />
      )}

      {/* Step Content with Enhanced Formatting */}
      <ScrollView
        style={styles.descriptionContainer}
        contentContainerStyle={styles.descriptionContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Instructions Card */}
        {stepContent.main ? (
          <View style={styles.instructionsCard}>
            <Text style={styles.sectionHeader}>INSTRUCTIONS</Text>
            <View style={styles.sectionDivider} />
            <Text style={styles.stepDescription}>{stepContent.main}</Text>
          </View>
        ) : null}

        {/* Tips Section */}
        {stepContent.tips.length > 0 && (
          <View style={styles.tipSection}>
            <View style={styles.tipHeader}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={styles.tipTitle}>Pro Tips</Text>
            </View>
            <View style={styles.sectionDivider} />
            {stepContent.tips.map((tip, index) => (
              <Text key={index} style={styles.tipText}>• {tip}</Text>
            ))}
          </View>
        )}

        {/* Warnings/Notes Section */}
        {stepContent.warnings.length > 0 && (
          <View style={styles.warningSection}>
            <View style={styles.warningHeader}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningTitle}>Important</Text>
            </View>
            <View style={styles.sectionDivider} />
            {stepContent.warnings.map((warning, index) => (
              <Text key={index} style={styles.warningText}>• {warning}</Text>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Timer Picker Modal */}
      <Modal
        visible={showTimerPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimerPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowTimerPicker(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Timer</Text>

            <View style={styles.pickerContainer}>
              <View style={styles.wheelPickersRow}>
                {/* Minutes Picker */}
                <View style={styles.wheelPickerColumn}>
                  <WheelPicker
                    value={selectedMinutes}
                    data={Array.from({ length: 60 }, (_, i) => ({
                      value: i,
                      label: i.toString().padStart(2, '0')
                    }))}
                    onValueChanged={({ item }) => setSelectedMinutes(item.value)}
                    itemHeight={50}
                    width={100}
                    visibleItemCount={5}
                    itemTextStyle={{
                      fontSize: 24,
                      color: colors.text,
                    }}
                    selectedItemTextStyle={{
                      fontSize: 28,
                      fontWeight: '600',
                      color: colors.primary,
                    }}
                    overlayItemStyle={{
                      borderTopWidth: 2,
                      borderBottomWidth: 2,
                      borderColor: colors.primary,
                      backgroundColor: colors.primary + '10',
                    }}
                  />
                  <Text style={styles.wheelPickerLabel}>min</Text>
                </View>

                {/* Seconds Picker */}
                <View style={styles.wheelPickerColumn}>
                  <WheelPicker
                    value={selectedSeconds}
                    data={Array.from({ length: 60 }, (_, i) => ({
                      value: i,
                      label: i.toString().padStart(2, '0')
                    }))}
                    onValueChanged={({ item }) => setSelectedSeconds(item.value)}
                    itemHeight={50}
                    width={100}
                    visibleItemCount={5}
                    itemTextStyle={{
                      fontSize: 24,
                      color: colors.text,
                    }}
                    selectedItemTextStyle={{
                      fontSize: 28,
                      fontWeight: '600',
                      color: colors.primary,
                    }}
                    overlayItemStyle={{
                      borderTopWidth: 2,
                      borderBottomWidth: 2,
                      borderColor: colors.primary,
                      backgroundColor: colors.primary + '10',
                    }}
                  />
                  <Text style={styles.wheelPickerLabel}>sec</Text>
                </View>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowTimerPicker(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() => {
                  const totalSeconds = selectedMinutes * 60 + selectedSeconds;
                  if (totalSeconds > 0) {
                    handleTimerPress(totalSeconds);
                    setShowTimerPicker(false);
                  } else {
                    Alert.alert('Invalid Time', 'Please set a time greater than 0 seconds');
                  }
                }}
              >
                <Text style={styles.modalButtonTextConfirm}>Start Timer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Timer Button (right bottom corner) */}
      <TouchableOpacity
        style={[styles.timerButton, { bottom: BUTTON_HEIGHT + insets.bottom + 16 }]}
        onPress={() => {
          if (timerActive) {
            handleStopTimer();
          } else {
            setShowTimerPicker(true);
          }
        }}
        activeOpacity={0.8}
      >
        <IconButton
          icon={timerActive ? 'stop' : 'timer-outline'}
          size={28}
          iconColor="#FFFFFF"
        />
        {timerActive && (
          <Text style={styles.timerText}>{formatTime(timerRemaining)}</Text>
        )}
      </TouchableOpacity>

      {/* Pill Navigation Buttons */}
      <View style={[styles.pillNavContainer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          onPress={handlePrevious}
          style={styles.pillButton}
          activeOpacity={0.8}
        >
          <Text style={styles.pillButtonText}>
            {currentStepIndex === 0 ? 'Preparation' : 'Previous'}
          </Text>
        </TouchableOpacity>

        {currentStepIndex === totalSteps - 1 ? (
          <TouchableOpacity
            onPress={handleDone}
            style={[styles.pillButton, styles.donePillButton]}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillButtonText, styles.donePillButtonText]}>Done</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleNext}
            style={[styles.pillButton, styles.nextPillButton]}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillButtonText, styles.nextPillButtonText]}>Next</Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exitButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCounter: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  // Progress Bar
  progressBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  stepImage: {
    width: '100%',
    aspectRatio: 1, // Maintain original aspect ratio
    backgroundColor: colors.surface,
  },
  descriptionContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  descriptionContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  // Section Divider
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
    opacity: 0.5,
  },
  // Instructions Card
  instructionsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  stepDescription: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.text,
    fontWeight: '400',
  },
  // Tip Section
  tipSection: {
    backgroundColor: colors.primary + '15', // 15% opacity
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  tipText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    marginTop: 6,
  },
  // Warning Section
  warningSection: {
    backgroundColor: '#FF9800' + '15', // Orange with 15% opacity
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF9800' + '30',
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF9800',
  },
  warningText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    marginTop: 6,
  },
  // Floating Timer Button (right bottom corner)
  timerButton: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  timerText: {
    position: 'absolute',
    bottom: -20,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  // Pill Navigation Buttons
  pillNavContainer: {
    height: BUTTON_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    backgroundColor: colors.background,
  },
  pillButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nextPillButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  donePillButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  nextPillButtonText: {
    color: '#FFFFFF',
  },
  donePillButtonText: {
    color: '#FFFFFF',
  },
  // Preparation screen styles
  preparationContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  preparationContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  preparationTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  preparationSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  ingredientsList: {
    gap: 8,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkboxWrapper: {
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBorder: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  ingredientTextContainer: {
    flex: 1,
    marginLeft: 4,
  },
  ingredientName: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  ingredientAmount: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  navigationContainer: {
    minHeight: BUTTON_HEIGHT,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  navButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: BUTTON_HEIGHT,
  },
  readyButton: {
    backgroundColor: colors.primary,
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  readyButtonText: {
    color: '#FFFFFF',
  },
  // Completion screen styles
  completionContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  congratsTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  congratsSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 32,
    textAlign: 'center',
  },
  recipePhoto: {
    width: '80%',
    aspectRatio: 1, // Maintain original aspect ratio
    borderRadius: 16,
    marginBottom: 16,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 40,
  },
  exitCompletionButton: {
    width: '100%',
    height: 60,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitCompletionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Timer Picker Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    width: SCREEN_WIDTH * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerContainer: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  wheelPickersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
  },
  wheelPickerColumn: {
    alignItems: 'center',
    width: 100,
  },
  wheelPickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonConfirm: {
    backgroundColor: colors.primary,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default GuidedCookingScreen;
