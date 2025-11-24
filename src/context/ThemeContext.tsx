import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  themeMode: ThemeMode;
  theme: Theme;
  setThemeMode: (mode: ThemeMode) => void;
  colors: ColorScheme;
}

export interface ColorScheme {
  // Backgrounds
  background: string;
  surface: string;
  card: string;
  
  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  
  // Primary
  primary: string;
  primaryLight: string;
  primaryDark: string;
  
  // Status
  success: string;
  error: string;
  warning: string;
  info: string;
  
  // Borders & Dividers
  border: string;
  divider: string;
  
  // Other
  shadow: string;
  overlay: string;
}

const lightColors: ColorScheme = {
  background: '#f1f5f9',
  surface: '#ffffff',
  card: '#ffffff',
  
  text: '#0f172a',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  
  primary: '#3182ce',
  primaryLight: '#eff6ff',
  primaryDark: '#1e40af',
  
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3182ce',
  
  border: '#e2e8f0',
  divider: '#f1f5f9',
  
  shadow: '#0f172a',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

const darkColors: ColorScheme = {
  background: '#000000',
  surface: '#0a0a0a',
  card: '#121212',
  
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  textTertiary: '#808080',
  
  primary: '#60a5fa',
  primaryLight: '#1e3a8a',
  primaryDark: '#3b82f6',
  
  success: '#4ade80',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
  
  border: '#1f1f1f',
  divider: '#1a1a1a',
  
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.85)',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@theme_mode';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  
  // Load saved theme preference
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  // Determine actual theme to use
  const theme: Theme = themeMode === 'system' 
    ? (systemColorScheme || 'light') 
    : themeMode;

  const colors = theme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ themeMode, theme, setThemeMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return default light theme if context not available
    console.warn('useTheme called outside ThemeProvider, using default theme');
    return {
      themeMode: 'light',
      theme: 'light',
      setThemeMode: () => {},
      colors: lightColors,
    };
  }
  return context;
};
