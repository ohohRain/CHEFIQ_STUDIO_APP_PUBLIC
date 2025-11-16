import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CreateRecipeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const handleClose = () => {
    navigation.goBack();
  };

  const handleAISmartInput = () => {
    console.log('AI Smart Input selected');
    handleClose();
    // Small delay to ensure modal closes smoothly before navigating
    setTimeout(() => {
      navigation.navigate('AISmartInput');
    }, 300);
  };

  const handleManualInput = () => {
    console.log('Manual Input selected');
    handleClose();
    // Small delay to ensure modal closes smoothly before navigating
    setTimeout(() => {
      navigation.navigate('RecipeForm', { mode: 'manual' });
    }, 300);
  };

  return (
    <View style={styles.container}>
      {/* Dimmed background overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      />

      {/* Modal card */}
      <View style={styles.modalCard}>
        {/* Modal title */}
        <Text style={styles.modalTitle}>Choose Creation Mode</Text>

        {/* Mode selection cards */}
        <View style={styles.cardsContainer}>
          {/* AI Smart Input Card */}
          <TouchableOpacity
            style={styles.modeCard}
            onPress={handleAISmartInput}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="lightning-bolt"
              size={48}
              color="#FF8C42"
              style={styles.cardIcon}
            />
            <Text style={styles.cardTitle}>AI Smart Input</Text>
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>Recommended</Text>
            </View>
            <Text style={styles.cardSubtitle}>Quick & easy</Text>
            <Text style={styles.cardDescription}>
              Let AI help you parse and structure your recipe
            </Text>
          </TouchableOpacity>

          {/* Manual Input Card */}
          <TouchableOpacity
            style={styles.modeCard}
            onPress={handleManualInput}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={48}
              color="#00D084"
              style={styles.cardIcon}
            />
            <Text style={styles.cardTitle}>Manual Input</Text>
            <View style={styles.emptyBadge} />
            <Text style={styles.cardSubtitle}>Full control</Text>
            <Text style={styles.cardDescription}>
              Traditional way to create your recipe step by step
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    backgroundColor: colors.accent, // Use accent color for better dark mode visibility
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary, // Green border to stand out in dark mode
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  cardsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  modeCard: {
    flex: 1,
    backgroundColor: colors.background, // Use background for contrast against modal
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
    minHeight: 220,
  },
  cardIcon: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  recommendedBadge: {
    backgroundColor: '#E6FAF3',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  recommendedText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyBadge: {
    height: 44,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default CreateRecipeScreen;
