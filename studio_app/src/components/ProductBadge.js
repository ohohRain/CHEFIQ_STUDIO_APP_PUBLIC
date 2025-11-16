import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';

/**
 * ProductBadge Component
 *
 * Displays Chef iQ product images in various sizes with accessibility support.
 * Replaces emoji-based product icons with actual product photography for professional appearance.
 *
 * @param {Object} props
 * @param {Object} props.equipment - Equipment object from CHEF_IQ_EQUIPMENT
 * @param {'small'|'medium'|'large'} props.size - Size variant (small: badge, medium: expanded, large: modal)
 * @param {Function} props.onPress - Optional press handler
 * @param {boolean} props.showLabel - Whether to show product name label
 * @param {Object} props.style - Additional container styles
 */
const ProductBadge = ({ equipment, size = 'small', onPress, showLabel = false, style }) => {
  if (!equipment || !equipment.image) {
    return null;
  }

  const sizeConfig = {
    small: {
      imageSize: 24,
      containerStyle: styles.containerSmall,
      imageStyle: styles.imageSmall,
      labelStyle: styles.labelSmall,
    },
    medium: {
      imageSize: 80,
      containerStyle: styles.containerMedium,
      imageStyle: styles.imageMedium,
      labelStyle: styles.labelMedium,
    },
    large: {
      imageSize: 200,
      containerStyle: styles.containerLarge,
      imageStyle: styles.imageLarge,
      labelStyle: styles.labelLarge,
    },
  };

  const config = sizeConfig[size] || sizeConfig.small;

  const content = (
    <View style={[config.containerStyle, style]}>
      <Image
        source={equipment.image}
        style={[config.imageStyle, { width: config.imageSize, height: config.imageSize }]}
        resizeMode="contain"
        accessibilityLabel={equipment.imageAlt || equipment.name}
        accessibilityRole="image"
      />
      {showLabel && (
        <Text style={config.labelStyle} numberOfLines={1}>
          {equipment.name}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`View ${equipment.name} details`}
        accessibilityHint="Double tap to see product information and purchase options"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

ProductBadge.propTypes = {
  equipment: PropTypes.shape({
    name: PropTypes.string.isRequired,
    image: PropTypes.number.isRequired, // require() image source
    imageAlt: PropTypes.string,
  }).isRequired,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  onPress: PropTypes.func,
  showLabel: PropTypes.bool,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  // Small size (badge in recipe cards)
  containerSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFE5CC',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FF8C42',
  },
  imageSmall: {
    borderRadius: 4,
  },
  labelSmall: {
    color: '#FF8C42',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Medium size (expanded recipe card)
  containerMedium: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  imageMedium: {
    borderRadius: 8,
  },
  labelMedium: {
    color: '#2D2D2D',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },

  // Large size (purchase modal)
  containerLarge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageLarge: {
    borderRadius: 12,
  },
  labelLarge: {
    color: '#2D2D2D',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
});

export default ProductBadge;
