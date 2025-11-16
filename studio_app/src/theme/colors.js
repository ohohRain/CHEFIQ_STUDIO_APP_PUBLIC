/**
 * Centralized Theme Configuration
 * Supports light and dark modes
 */

export const lightTheme = {
  primary: '#00D084',
  highlight: '#FF8C42',
  background: '#FFFDF8',
  card: '#FFFFFF',
  text: '#2D2D2D',
  textSecondary: '#666666',
  textLight: '#999999',
  textTertiary: '#999999',
  accent: '#F5F3EF',
  border: '#E5E5E5',
  draftBorder: '#FF8C42',
  buttonDisabled: '#E0E0E0',
  disabled: '#CCCCCC',        // Disabled text color (light mode)
  error: '#FF6B6B',
  success: '#00D084',
  warning: '#FFB800',
  // Chef iQ specific colors
  primaryLight: '#E6FAF3',    // Light green background for selected states
  primaryDark: '#00D084',     // Primary green for text on light backgrounds
  highlightLight: '#FFF8F0',  // Light orange background for Chef iQ sections
  highlightMedium: '#FFE5CC', // Medium orange for Chef iQ buttons
};

export const darkTheme = {
  primary: '#00D084',
  highlight: '#FF8C42',
  background: '#000000',      // True black background
  card: '#000000',            // True black for cards (same as background)
  text: '#FFFFFF',
  textSecondary: '#999999',   // Medium gray for secondary text
  textLight: '#666666',       // Darker gray for tertiary text
  textTertiary: '#666666',
  accent: '#1A1A1A',          // Dark grey for TextInput backgrounds (not full black)
  border: '#1A1A1A',          // Very subtle dark border (just slightly visible)
  draftBorder: '#FF8C42',
  buttonDisabled: '#333333',  // Dark gray for disabled buttons
  disabled: '#666666',        // Disabled text color (dark mode - visible against black)
  error: '#FF6B6B',
  success: '#00D084',
  warning: '#FFB800',
  // Chef iQ specific colors
  primaryLight: '#004D32',    // Dark green background for selected states (visible in dark mode)
  primaryDark: '#00D084',     // Primary green for text (same as primary, works on dark backgrounds)
  highlightLight: '#2D1F00',  // Dark orange/brown background for Chef iQ sections
  highlightMedium: '#3D2800', // Darker orange for Chef iQ buttons (visible in dark mode)
};

/**
 * Get theme colors based on mode
 * @param {boolean} isDark - Whether dark mode is enabled
 * @returns {Object} Theme colors
 */
export const getTheme = (isDark) => {
  return isDark ? darkTheme : lightTheme;
};
