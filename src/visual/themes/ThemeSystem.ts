/**
 * Visual Theme System for Grafity Graph Visualization
 */

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  surfaceVariant: string;

  // Primary colors
  primary: string;
  primaryVariant: string;

  // Secondary colors
  secondary: string;
  secondaryVariant: string;

  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Text colors
  onBackground: string;
  onSurface: string;
  onPrimary: string;
  onSecondary: string;

  // Node type colors
  codeNode: string;
  businessNode: string;
  documentNode: string;
  conversationNode: string;
  unknownNode: string;

  // Edge colors
  defaultEdge: string;
  dependencyEdge: string;
  communicationEdge: string;
  dataFlowEdge: string;

  // UI element colors
  border: string;
  borderVariant: string;
  shadow: string;
  overlay: string;

  // Interactive states
  hover: string;
  selected: string;
  focus: string;
  disabled: string;
}

export interface ThemeTypography {
  // Font families
  fontFamily: string;
  monoFontFamily: string;

  // Font sizes
  xs: number;
  sm: number;
  base: number;
  lg: number;
  xl: number;
  xxl: number;

  // Font weights
  normal: number;
  medium: number;
  semiBold: number;
  bold: number;

  // Line heights
  tight: number;
  normal: number;
  relaxed: number;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface ThemeBorderRadius {
  none: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface ThemeAnimations {
  // Duration
  fast: number;
  normal: number;
  slow: number;

  // Easing functions
  easeInOut: string;
  easeIn: string;
  easeOut: string;
  bounce: string;
}

export interface GraphTheme {
  name: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  shadows: ThemeShadows;
  animations: ThemeAnimations;
}

/**
 * Default Light Theme
 */
export const lightTheme: GraphTheme = {
  name: 'Light',
  colors: {
    // Background colors
    background: '#ffffff',
    surface: '#f8f9fa',
    surfaceVariant: '#e9ecef',

    // Primary colors
    primary: '#007bff',
    primaryVariant: '#0056b3',

    // Secondary colors
    secondary: '#6c757d',
    secondaryVariant: '#495057',

    // Status colors
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',

    // Text colors
    onBackground: '#212529',
    onSurface: '#495057',
    onPrimary: '#ffffff',
    onSecondary: '#ffffff',

    // Node type colors
    codeNode: '#4A90E2',
    businessNode: '#50E3C2',
    documentNode: '#F5A623',
    conversationNode: '#BD10E0',
    unknownNode: '#9B9B9B',

    // Edge colors
    defaultEdge: '#dee2e6',
    dependencyEdge: '#4A90E2',
    communicationEdge: '#BD10E0',
    dataFlowEdge: '#50E3C2',

    // UI element colors
    border: '#dee2e6',
    borderVariant: '#ced4da',
    shadow: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',

    // Interactive states
    hover: 'rgba(0, 123, 255, 0.1)',
    selected: '#FFD700',
    focus: '#80bdff',
    disabled: '#6c757d'
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    monoFontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    normal: 400,
    medium: 500,
    semiBold: 600,
    bold: 700,
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48
  },
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999
  },
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.1)'
  },
  animations: {
    fast: 150,
    normal: 300,
    slow: 500,
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  }
};

/**
 * Dark Theme
 */
export const darkTheme: GraphTheme = {
  name: 'Dark',
  colors: {
    // Background colors
    background: '#1a1a1a',
    surface: '#2d2d2d',
    surfaceVariant: '#404040',

    // Primary colors
    primary: '#4dabf7',
    primaryVariant: '#339af0',

    // Secondary colors
    secondary: '#868e96',
    secondaryVariant: '#adb5bd',

    // Status colors
    success: '#51cf66',
    warning: '#ffd43b',
    error: '#ff6b6b',
    info: '#22d3ee',

    // Text colors
    onBackground: '#f8f9fa',
    onSurface: '#e9ecef',
    onPrimary: '#1a1a1a',
    onSecondary: '#1a1a1a',

    // Node type colors
    codeNode: '#74c0fc',
    businessNode: '#63e6be',
    documentNode: '#ffc947',
    conversationNode: '#d0bfff',
    unknownNode: '#adb5bd',

    // Edge colors
    defaultEdge: '#495057',
    dependencyEdge: '#74c0fc',
    communicationEdge: '#d0bfff',
    dataFlowEdge: '#63e6be',

    // UI element colors
    border: '#495057',
    borderVariant: '#6c757d',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',

    // Interactive states
    hover: 'rgba(116, 192, 252, 0.1)',
    selected: '#ffd43b',
    focus: '#74c0fc',
    disabled: '#6c757d'
  },
  typography: lightTheme.typography,
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.3)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.3)'
  },
  animations: lightTheme.animations
};

/**
 * High Contrast Theme (Accessibility)
 */
export const highContrastTheme: GraphTheme = {
  name: 'High Contrast',
  colors: {
    // Background colors
    background: '#000000',
    surface: '#1a1a1a',
    surfaceVariant: '#333333',

    // Primary colors
    primary: '#ffffff',
    primaryVariant: '#e6e6e6',

    // Secondary colors
    secondary: '#ffff00',
    secondaryVariant: '#cccc00',

    // Status colors
    success: '#00ff00',
    warning: '#ffff00',
    error: '#ff0000',
    info: '#00ffff',

    // Text colors
    onBackground: '#ffffff',
    onSurface: '#ffffff',
    onPrimary: '#000000',
    onSecondary: '#000000',

    // Node type colors
    codeNode: '#00ffff',
    businessNode: '#00ff00',
    documentNode: '#ffff00',
    conversationNode: '#ff00ff',
    unknownNode: '#ffffff',

    // Edge colors
    defaultEdge: '#ffffff',
    dependencyEdge: '#00ffff',
    communicationEdge: '#ff00ff',
    dataFlowEdge: '#00ff00',

    // UI element colors
    border: '#ffffff',
    borderVariant: '#cccccc',
    shadow: 'rgba(255, 255, 255, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.8)',

    // Interactive states
    hover: 'rgba(255, 255, 255, 0.2)',
    selected: '#ffff00',
    focus: '#ffffff',
    disabled: '#666666'
  },
  typography: {
    ...lightTheme.typography,
    bold: 700 // Stronger fonts for high contrast
  },
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
  shadows: {
    sm: '0 1px 3px rgba(255, 255, 255, 0.3)',
    md: '0 4px 6px rgba(255, 255, 255, 0.3)',
    lg: '0 10px 15px rgba(255, 255, 255, 0.3)',
    xl: '0 20px 25px rgba(255, 255, 255, 0.3)'
  },
  animations: lightTheme.animations
};

/**
 * Colorblind-friendly theme
 */
export const colorblindTheme: GraphTheme = {
  name: 'Colorblind Friendly',
  colors: {
    ...lightTheme.colors,

    // Colorblind-safe colors (Viridis palette)
    codeNode: '#440154',
    businessNode: '#31688e',
    documentNode: '#35b779',
    conversationNode: '#fde725',
    unknownNode: '#9b9b9b',

    // Edge colors using different patterns/styles
    defaultEdge: '#dee2e6',
    dependencyEdge: '#440154',
    communicationEdge: '#fde725',
    dataFlowEdge: '#31688e'
  },
  typography: lightTheme.typography,
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
  shadows: lightTheme.shadows,
  animations: lightTheme.animations
};

/**
 * Available themes
 */
export const availableThemes = {
  light: lightTheme,
  dark: darkTheme,
  highContrast: highContrastTheme,
  colorblind: colorblindTheme
};

export type ThemeName = keyof typeof availableThemes;

/**
 * Theme Context and Hooks
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ThemeContextType {
  currentTheme: GraphTheme;
  themeName: ThemeName;
  setTheme: (themeName: ThemeName) => void;
  toggleTheme: () => void;
  createCustomTheme: (baseTheme: ThemeName, overrides: Partial<GraphTheme>) => void;
  isSystemDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeName;
  enableSystemTheme?: boolean;
}

/**
 * Theme Provider Component
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme = 'light',
  enableSystemTheme = true
}) => {
  const [themeName, setThemeName] = useState<ThemeName>(initialTheme);
  const [customThemes, setCustomThemes] = useState<Record<string, GraphTheme>>({});

  // Detect system dark mode preference
  const [isSystemDarkMode] = useState(() => {
    if (!enableSystemTheme || typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Get current theme, considering system preference
  const getCurrentTheme = useCallback((): GraphTheme => {
    if (enableSystemTheme && themeName === 'light' && isSystemDarkMode) {
      return availableThemes.dark;
    }
    return customThemes[themeName] || availableThemes[themeName] || lightTheme;
  }, [themeName, isSystemDarkMode, enableSystemTheme, customThemes]);

  const setTheme = useCallback((newThemeName: ThemeName) => {
    setThemeName(newThemeName);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('grafity-theme', newThemeName);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = themeName === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [themeName, setTheme]);

  const createCustomTheme = useCallback((baseTheme: ThemeName, overrides: Partial<GraphTheme>) => {
    const base = availableThemes[baseTheme];
    const customTheme: GraphTheme = {
      ...base,
      ...overrides,
      colors: { ...base.colors, ...(overrides.colors || {}) },
      typography: { ...base.typography, ...(overrides.typography || {}) },
      spacing: { ...base.spacing, ...(overrides.spacing || {}) },
      borderRadius: { ...base.borderRadius, ...(overrides.borderRadius || {}) },
      shadows: { ...base.shadows, ...(overrides.shadows || {}) },
      animations: { ...base.animations, ...(overrides.animations || {}) }
    };

    const customThemeName = overrides.name || `custom-${Date.now()}`;
    setCustomThemes(prev => ({ ...prev, [customThemeName]: customTheme }));

    return customThemeName;
  }, []);

  const value: ThemeContextType = {
    currentTheme: getCurrentTheme(),
    themeName,
    setTheme,
    toggleTheme,
    createCustomTheme,
    isSystemDarkMode
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to use theme
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Hook to apply theme styles
 */
export const useThemeStyles = () => {
  const { currentTheme } = useTheme();

  return {
    // CSS-in-JS helper functions
    getNodeColor: (nodeType: string) => {
      switch (nodeType) {
        case 'code': return currentTheme.colors.codeNode;
        case 'business': return currentTheme.colors.businessNode;
        case 'document': return currentTheme.colors.documentNode;
        case 'conversation': return currentTheme.colors.conversationNode;
        default: return currentTheme.colors.unknownNode;
      }
    },

    getEdgeColor: (edgeType: string) => {
      switch (edgeType) {
        case 'dependency': return currentTheme.colors.dependencyEdge;
        case 'communication': return currentTheme.colors.communicationEdge;
        case 'dataFlow': return currentTheme.colors.dataFlowEdge;
        default: return currentTheme.colors.defaultEdge;
      }
    },

    // CSS custom properties generator
    getCSSVariables: () => {
      const variables: Record<string, string> = {};

      // Colors
      Object.entries(currentTheme.colors).forEach(([key, value]) => {
        variables[`--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = value;
      });

      // Typography
      variables['--font-family'] = currentTheme.typography.fontFamily;
      variables['--font-family-mono'] = currentTheme.typography.monoFontFamily;
      Object.entries(currentTheme.typography).forEach(([key, value]) => {
        if (typeof value === 'number') {
          variables[`--font-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = `${value}px`;
        }
      });

      // Spacing
      Object.entries(currentTheme.spacing).forEach(([key, value]) => {
        variables[`--spacing-${key}`] = `${value}px`;
      });

      // Border radius
      Object.entries(currentTheme.borderRadius).forEach(([key, value]) => {
        variables[`--radius-${key}`] = `${value}px`;
      });

      // Shadows
      Object.entries(currentTheme.shadows).forEach(([key, value]) => {
        variables[`--shadow-${key}`] = value;
      });

      // Animations
      Object.entries(currentTheme.animations).forEach(([key, value]) => {
        if (typeof value === 'number') {
          variables[`--duration-${key}`] = `${value}ms`;
        } else {
          variables[`--easing-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = value;
        }
      });

      return variables;
    }
  };
};

/**
 * CSS-in-JS theme adapter for styled-components or emotion
 */
export const createThemeAdapter = (theme: GraphTheme) => ({
  colors: theme.colors,
  typography: theme.typography,
  spacing: theme.spacing,
  borderRadius: theme.borderRadius,
  shadows: theme.shadows,
  animations: theme.animations
});

/**
 * Theme selector component
 */
export const ThemeSelector: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className = '', style = {} }) => {
  const { themeName, setTheme, currentTheme } = useTheme();

  return (
    <select
      value={themeName}
      onChange={(e) => setTheme(e.target.value as ThemeName)}
      className={className}
      style={{
        padding: '8px 12px',
        borderRadius: currentTheme.borderRadius.md,
        border: `1px solid ${currentTheme.colors.border}`,
        background: currentTheme.colors.surface,
        color: currentTheme.colors.onSurface,
        fontSize: currentTheme.typography.sm,
        ...style
      }}
    >
      {Object.entries(availableThemes).map(([key, theme]) => (
        <option key={key} value={key}>
          {theme.name}
        </option>
      ))}
    </select>
  );
};