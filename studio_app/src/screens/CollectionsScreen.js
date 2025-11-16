import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useCollections } from '../contexts/CollectionsContext';
import CreateCollectionModal from '../components/CreateCollectionModal';

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = 16;
const CARD_MARGIN = 12;
const COLUMNS = 2;
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 85 : 65;
const FAB_SIZE = 56;
const CARD_WIDTH = (width - (HORIZONTAL_PADDING * 2) - (CARD_MARGIN * (COLUMNS - 1))) / COLUMNS;

const CollectionsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { getUserCollections } = useCollections();
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const collections = getUserCollections();

  const handleCollectionPress = (collection) => {
    navigation.navigate('CollectionDetail', {
      collectionId: collection.collectionId,
      collectionName: collection.name
    });
  };

  const handleCreateCollection = () => {
    setCreateModalVisible(true);
  };


  const renderCollectionCard = (collection) => (
    <TouchableOpacity
      onPress={() => handleCollectionPress(collection)}
      activeOpacity={0.8}
      style={styles.collectionCard}
    >
      <View style={styles.cardContent}>
        <Text style={styles.collectionEmoji}>{collection.emoji}</Text>
        <Text style={styles.collectionName} numberOfLines={2}>
          {collection.name}
        </Text>
        <Text style={styles.collectionCount}>
          {collection.stats.recipesCount} {collection.stats.recipesCount === 1 ? 'recipe' : 'recipes'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>Collections</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: TAB_BAR_HEIGHT + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Collections Grid or Empty State */}
        {collections.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="folder-star-outline" size={64} color={colors.border} />
            <Text style={styles.emptyStateTitle}>No collections yet</Text>
            <Text style={styles.emptyStateText}>
              Create your first collection to organize recipes
            </Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {collections.map((collection) => (
              <React.Fragment key={collection.collectionId}>
                {renderCollectionCard(collection)}
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { bottom: TAB_BAR_HEIGHT + 16 }]}
        onPress={handleCreateCollection}
        color={colors.card}
        customSize={56}
      />

      {/* Create Collection Modal */}
      <CreateCollectionModal
        visible={createModalVisible}
        onDismiss={() => setCreateModalVisible(false)}
      />
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  collectionCard: {
    width: CARD_WIDTH,
    marginBottom: CARD_MARGIN,
    borderRadius: 16,
    backgroundColor: colors.card,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
  collectionEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  collectionCount: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: 16,
    backgroundColor: colors.primary,
    borderRadius: 28,
  },
});

export default CollectionsScreen;
